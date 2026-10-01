#!/usr/bin/env node
/**
 * Export blog posts as Medium-friendly HTML + images, ready to paste into Medium's editor.
 *
 *   npm run medium -- <post>… [--out dir] [--image-base https://…]
 *   npm run medium -- <post>… --publish
 *   npm run medium -- --all [--live]
 *   npm run medium -- --list          print the ids of live posts as JSON and exit
 *
 * <post> is a file id (2026-05-06-ai-native-workflow-with-pi), a slug (ai-native-workflow-with-pi)
 * or any unique part of one. Drafts and scheduled posts can be exported too.
 *
 * How it works: it starts the Astro dev server, opens each post in headless Chrome (so Shiki,
 * Mermaid and raw HTML render exactly as on the site) and then rewrites the article for Medium:
 *   - Mermaid diagrams and tables (Medium has neither) become PNG screenshots
 *   - images are copied into images/ and referenced relatively
 *   - headings become h3/h4 (Medium's two heading sizes), code blocks become plain <pre>
 *   - site-relative links become absolute; footnote refs become [n]
 *   - everything Medium doesn't support (classes, styles, spans, divs…) is stripped
 * Output: <out>/<post-id>/index.html and <out>/<post-id>/images/*.
 *
 * Medium's "Import a story" only accepts a public http(s) URL. With --publish the export is
 * written to public/medium/<post-id>/ with absolute image URLs, plus public/medium/index.json
 * listing the import URLs. The page's canonical link points at the original post.
 *
 * CI runs `--all --live --publish` before every build, so each live post has a copy at
 * https://<site>/medium/<post-id>/ ready to import. public/medium/ is git-ignored: don't commit it.
 * --live skips drafts and scheduled posts, so their content isn't published early; a scheduled
 * post gets its copy from the daily rebuild on the day it goes live.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { dev } from 'astro';
import { chromium } from 'playwright-core';
import { parse as parseYaml } from 'yaml';
import astroConfig from '../astro.config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'src/content/posts');
const SITE = String(astroConfig.site).replace(/\/$/, '');

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    all: { type: 'boolean', default: false },
    live: { type: 'boolean', default: false },
    list: { type: 'boolean', default: false },
    out: { type: 'string', default: 'medium-export' },
    'image-base': { type: 'string' },
    publish: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (opts.help || (!opts.all && !opts.list && positionals.length === 0)) {
  console.log(`Usage: npm run medium -- <post>… [--out dir] [--image-base https://host/path]
       npm run medium -- <post>… --publish
       npm run medium -- --all

  <post>          post file id, slug, or a unique part of one
  --all           export every post
  --live          skip drafts and scheduled posts (what CI uses)
  --publish       write to public/medium/<post-id>/ (deployed with the site) using absolute
                  image URLs, so Medium can import https://…/medium/<post-id>/
  --out           output directory (default: medium-export)
  --image-base    public URL where you will host each post's images/ folder; image src
                  becomes <image-base>/<post-id>/images/<file> so Medium can fetch them`);
  process.exit(opts.help ? 0 : 1);
}

if (opts.publish) {
  opts.out = 'public/medium';
  opts['image-base'] = `${SITE}/medium`;
}

// ---------------------------------------------------------------------------------------------
// Posts: mirror src/utils.ts postPath() so we know each post's URL.

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pad = (n) => String(n).padStart(2, '0');

async function loadPosts() {
  const files = (await readdir(postsDir)).filter((f) => f.endsWith('.md')).sort();
  return Promise.all(
    files.map(async (file) => {
      const id = file.replace(/\.md$/, '');
      const src = await readFile(path.join(postsDir, file), 'utf8');
      const fm = parseYaml(src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '') ?? {};
      const date = new Date(fm.date);
      const slug = id.replace(/^\d{4}-\d{2}-\d{2}-/, '');
      const urlPath = [
        ...(fm.categories ?? []).map((c) => slugify(String(c))),
        date.getUTCFullYear(),
        pad(date.getUTCMonth() + 1),
        pad(date.getUTCDate()),
        slug,
      ].join('/');
      return {
        id,
        slug,
        title: String(fm.title ?? slug),
        // UTC, matching the date in the post URL.
        published: `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
        description: fm.description ? String(fm.description) : '',
        tags: [...(fm.categories ?? []), ...(fm.tags ?? [])].map(String),
        unpublished: fm.draft === true || fm.published === false || date.valueOf() > Date.now(),
        path: `/${urlPath}.html`,
        mermaidCount: (src.match(/^\s*```mermaid\b/gm) ?? []).length,
      };
    }),
  );
}

function pickPosts(posts) {
  if (opts.all) return posts.filter((p) => !p.id.startsWith('_'));
  return positionals.map((q) => {
    const key = path.basename(q).replace(/\.md$/, '');
    const exact = posts.find((p) => p.id === key || p.slug === key);
    if (exact) return exact;
    const hits = posts.filter((p) => p.id.includes(key));
    if (hits.length === 1) return hits[0];
    const reason = hits.length ? `is ambiguous:\n  ${hits.map((p) => p.id).join('\n  ')}` : 'matches no post';
    throw new Error(`"${q}" ${reason}`);
  });
}

// ---------------------------------------------------------------------------------------------
// Browser

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome' }); // installed Google Chrome
  } catch {
    try {
      return await chromium.launch(); // Playwright-managed Chromium, if present
    } catch {
      throw new Error(
        'No Chrome found. Install Google Chrome, or run: npx playwright-core install chromium',
      );
    }
  }
}

const extFor = (contentType, url) => {
  const fromType = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif' }[
    (contentType ?? '').split(';')[0].trim()
  ];
  return fromType ?? (path.extname(new URL(url).pathname) || '.img');
};

const baseName = (url) =>
  slugify(path.basename(new URL(url).pathname).replace(/\.[a-z0-9]+$/i, '')) || 'image';

/** Runs in the page: tag the elements that must become images, return their count per kind. */
function markShots() {
  const prose = document.querySelector('.prose');
  if (!prose) throw new Error('No .prose element on page');
  let n = 0;
  for (const el of prose.querySelectorAll('pre.mermaid, table')) {
    el.dataset.mediumShot = String(n++);
    if (el.tagName === 'TABLE') {
      // Show the whole table (the site scrolls wide tables horizontally).
      Object.assign(el.style, { display: 'table', overflow: 'visible', width: 'auto', maxWidth: 'none', background: '#fff' });
    } else {
      Object.assign(el.style, { background: '#fff', border: 'none' });
    }
  }
  return n;
}

/** Runs in the page: rewrite .prose into the subset of HTML Medium's editor understands. */
function toMediumHtml({ site, canonical, shots, images }) {
  const src = document.querySelector('.prose').cloneNode(true);
  const doc = document.implementation.createHTMLDocument('');
  const out = doc.createElement('div');

  const abs = (href) => {
    if (!href) return href;
    if (href.startsWith('#')) return canonical + href;
    try {
      const u = new URL(href, location.href);
      return u.origin === location.origin ? site + u.pathname + u.search + u.hash : u.href;
    } catch {
      return href;
    }
  };

  const figure = (img) => {
    const fig = doc.createElement('figure');
    const el = doc.createElement('img');
    el.setAttribute('src', img.src);
    if (img.alt) el.alt = img.alt;
    fig.append(el);
    if (img.caption) {
      const cap = doc.createElement('figcaption');
      cap.textContent = img.caption;
      fig.append(cap);
    }
    return fig;
  };

  const RENAME = { H1: 'h3', H2: 'h3', H3: 'h4', H4: 'h4', H5: 'h4', H6: 'h4', B: 'strong', I: 'em', S: 's', DEL: 's' };
  const KEEP = new Set(['P', 'A', 'STRONG', 'EM', 'CODE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'HR', 'BR', 'FIGURE', 'FIGCAPTION']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'BUTTON', 'TEMPLATE', 'SVG', 'IFRAME']);

  /** Convert node's children and append them to target. */
  function walk(node, target) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        target.append(doc.createTextNode(child.textContent));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child;
      const tag = el.tagName.toUpperCase();

      if (el.dataset.mediumShot !== undefined) {
        target.append(figure(shots[Number(el.dataset.mediumShot)]));
        continue;
      }
      if (DROP.has(tag) || el.matches('.sr-only, .visually-hidden, [aria-hidden="true"], .data-footnote-backref, [data-footnote-backref]')) continue;

      if (tag === 'IMG') {
        const img = images[el.getAttribute('src')];
        if (img) target.append(figure({ ...img, alt: el.alt }));
        continue;
      }
      if (tag === 'FIGURE' && el.querySelector('img')) {
        const img = images[el.querySelector('img').getAttribute('src')];
        const caption = el.querySelector('figcaption')?.textContent.trim();
        if (img) target.append(figure({ ...img, alt: el.querySelector('img').alt, caption }));
        continue;
      }
      if (tag === 'PICTURE') {
        walk(el, target);
        continue;
      }
      if (tag === 'PRE') {
        const pre = doc.createElement('pre');
        pre.textContent = el.textContent.replace(/\n+$/, '');
        target.append(pre);
        continue;
      }
      if (tag === 'INPUT' && el.type === 'checkbox') {
        target.append(doc.createTextNode(el.checked ? '☑ ' : '☐ '));
        continue;
      }
      if (tag === 'SUP' && el.querySelector('a[href^="#"]')) {
        target.append(doc.createTextNode(`[${el.textContent.trim()}]`)); // footnote reference
        continue;
      }
      if (tag === 'DETAILS') {
        walk(el, target);
        continue;
      }
      if (tag === 'SUMMARY') {
        const p = doc.createElement('p');
        const strong = doc.createElement('strong');
        walk(el, strong);
        p.append(strong);
        target.append(p);
        continue;
      }
      if (tag === 'SECTION' && el.matches('.footnotes, [data-footnotes]')) {
        target.append(doc.createElement('hr'));
        const h = doc.createElement('h4');
        h.textContent = 'Notes';
        target.append(h);
        walk(el, target);
        continue;
      }

      const name = RENAME[tag] ?? (KEEP.has(tag) ? tag.toLowerCase() : null);
      if (!name) {
        walk(el, target); // unwrap span, div, section, mark, etc.
        continue;
      }
      const copy = doc.createElement(name);
      if (name === 'a') {
        const href = abs(el.getAttribute('href'));
        if (href) copy.setAttribute('href', href);
      }
      walk(el, copy);
      target.append(copy);
    }
  }

  walk(src, out);

  // Figures must be top-level blocks: unwrap image links, lift figures out of paragraphs.
  for (const fig of out.querySelectorAll('figure')) {
    const a = fig.parentElement;
    if (a?.tagName === 'A' && a.textContent.trim() === fig.textContent.trim()) a.replaceWith(...a.childNodes);
    const block = fig.parentElement?.closest('p, h3, h4, a, strong, em');
    if (block) (block.closest('p, h3, h4') ?? block).before(fig);
  }
  // Drop blocks left empty.
  for (const el of out.querySelectorAll('p, h3, h4, li, a')) {
    if (!el.textContent.trim() && !el.querySelector('img, br')) el.remove();
  }
  return out.innerHTML
    .replace(/>\s*\n\s*</g, '>\n<')
    .replace(/<\/(p|h3|h4|pre|blockquote|ul|ol|figure|hr)>/g, '</$1>\n');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Hosted copies exist for Medium's importer (which doesn't run JavaScript). Send people who land
 *  here, e.g. from Medium's "Originally published at" link, to the real post. ?preview skips this. */
const redirect = (canonical) =>
  `<script>if (!new URLSearchParams(location.search).has('preview')) location.replace(${JSON.stringify(canonical)});</script>\n`;

function page({ post, canonical, body }) {
  // No subtitle: Medium's importer folds a <p> straight after <h1> into the title, so separate them.
  const description = post.description ? `<h4>${escapeHtml(post.description)}</h4>\n` : '<hr>\n';
  const tags = post.tags.slice(0, 5).join(', ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(post.title)}</title>
<link rel="canonical" href="${canonical}">
<meta name="medium-tags" content="${escapeHtml(tags)}">
${opts.publish ? redirect(canonical) : ''}<style>
  /* Preview only: none of this is copied into Medium. */
  body { max-width: 680px; margin: 3rem auto; padding: 0 1rem; font: 20px/1.6 Georgia, serif; color: #242424; }
  h3 { font: 700 1.5em/1.25 system-ui, sans-serif; margin-top: 2em; }
  h4 { font: 600 1.15em/1.3 system-ui, sans-serif; margin-top: 1.5em; }
  pre { background: #f2f2f2; padding: 1em; font-size: 15px; overflow-x: auto; }
  code { background: #f2f2f2; font-size: 0.85em; }
  figure { margin: 2em 0; } img { max-width: 100%; }
  figcaption { text-align: center; font-size: 0.75em; color: #6b6b6b; }
  blockquote { border-left: 3px solid #242424; margin-left: 0; padding-left: 1.2em; font-style: italic; }
</style>
</head>
<body>
<article>
<h1>${escapeHtml(post.title)}</h1>
${description}${body}
<hr>
<p><em>Originally published at <a href="${canonical}">${canonical.replace(/^https?:\/\//, '')}</a> on ${post.published}.</em></p>
</article>
</body>
</html>
`;
}

/** index.json: every copy in the output dir, for finding import URLs and for the smoke test. */
async function writeIndex(allPosts) {
  const outRoot = path.resolve(root, opts.out);
  const dirs = new Set(
    (await readdir(outRoot, { withFileTypes: true }).catch(() => []))
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
  );
  const entries = allPosts
    .filter((p) => dirs.has(p.id))
    .map((p) => ({ id: p.id, title: p.title, import: `${SITE}/medium/${p.id}/`, original: SITE + p.path }))
    .reverse(); // newest first
  await mkdir(outRoot, { recursive: true });
  await writeFile(path.join(outRoot, 'index.json'), `${JSON.stringify(entries, null, 2)}\n`);
}

// ---------------------------------------------------------------------------------------------

async function exportPost(browser, origin, post) {
  const canonical = SITE + post.path;
  const outDir = path.resolve(root, opts.out, post.id);
  const imgDir = path.join(outDir, 'images');
  const imageRef = (file) =>
    opts['image-base'] ? `${opts['image-base'].replace(/\/$/, '')}/${post.id}/images/${file}` : `images/${file}`;

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  await context.addInitScript(() => localStorage.setItem('theme', 'light'));
  const tab = await context.newPage();
  try {
    const res = await tab.goto(origin + post.path, { waitUntil: 'networkidle' });
    if (!res?.ok()) throw new Error(`${post.path} returned HTTP ${res?.status()}`);

    await tab.waitForFunction(
      (n) => document.querySelectorAll('.prose pre.mermaid svg').length >= n,
      post.mermaidCount,
      { timeout: 60_000 },
    );
    await tab.evaluate(() => document.fonts.ready);

    await rm(outDir, { recursive: true, force: true });
    await mkdir(imgDir, { recursive: true });

    // 1. Screenshots for diagrams and tables.
    const shotCount = await tab.evaluate(markShots);
    const shots = [];
    let seq = 0;
    const nextName = (base, ext) => `${pad(++seq)}-${base}${ext}`;
    for (let i = 0; i < shotCount; i++) {
      const el = tab.locator(`[data-medium-shot="${i}"]`);
      const isTable = (await el.evaluate((e) => e.tagName)) === 'TABLE';
      const target = isTable ? el : el.locator('svg').first();
      const file = nextName(isTable ? 'table' : 'diagram', '.png');
      await target.screenshot({ path: path.join(imgDir, file), animations: 'disabled' });
      const alt = isTable
        ? 'Table: ' + (await el.locator('th').allTextContents()).map((s) => s.trim()).join(' · ')
        : (await el.evaluate((e) => e.querySelector('svg')?.getAttribute('aria-roledescription') ?? '')) + ' diagram';
      shots.push({ src: imageRef(file), alt: alt.trim() });
    }

    // 2. Copy <img> files (outside screenshotted elements).
    const srcs = await tab.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll('.prose img')]
          .filter((img) => !img.closest('[data-medium-shot]'))
          .map((img) => img.getAttribute('src'))
          .filter(Boolean),
      ),
    ]);
    const images = {};
    for (const src of srcs) {
      const url = new URL(src, origin + post.path).href;
      const r = await tab.request.get(url);
      if (!r.ok()) {
        console.warn(`  ! could not fetch image ${src} (HTTP ${r.status()}), skipped`);
        continue;
      }
      const file = nextName(baseName(url), extFor(r.headers()['content-type'], url));
      await writeFile(path.join(imgDir, file), await r.body());
      images[src] = { src: imageRef(file) };
    }

    // 3. Rewrite the article.
    const body = await tab.evaluate(toMediumHtml, { site: SITE, canonical, shots, images });
    await writeFile(path.join(outDir, 'index.html'), page({ post, canonical, body }));

    const rel = path.relative(root, outDir);
    console.log(`✓ ${post.id}\n    ${rel}/index.html  (${seq} image${seq === 1 ? '' : 's'})`);
    if (opts.publish) {
      console.log(`    import URL (after deploy): ${SITE}/medium/${post.id}/`);
      if (post.unpublished) {
        console.warn(`    ! this post is a draft or scheduled: publishing the export makes it public now`);
      }
    }
  } finally {
    await context.close();
  }
}

const allPosts = await loadPosts();
if (opts.list) {
  console.log(JSON.stringify(allPosts.filter((p) => !p.unpublished && !p.id.startsWith('_')).map((p) => p.id)));
  process.exit(0);
}
let posts = pickPosts(allPosts);
if (opts.live) {
  for (const p of posts.filter((p) => p.unpublished)) console.log(`- ${p.id}: draft or scheduled, skipped (--live)`);
  posts = posts.filter((p) => !p.unpublished);
}
// A full publish replaces every copy, so posts that are no longer live (e.g. moved back to
// draft) don't keep a public copy.
if (opts.publish && opts.all) await rm(path.resolve(root, opts.out), { recursive: true, force: true });
const server = await dev({
  root,
  logLevel: 'error',
  devToolbar: { enabled: false },
  server: { port: 4399, host: '127.0.0.1' },
});
const origin = `http://127.0.0.1:${server.address.port}`;
const browser = await launchBrowser();
let failed = 0;
try {
  for (const post of posts) {
    try {
      await exportPost(browser, origin, post);
    } catch (err) {
      failed++;
      console.error(`✗ ${post.id}: ${err.message}`);
    }
  }
} finally {
  await browser.close();
  await server.stop();
}

if (opts.publish) await writeIndex(allPosts);

if (!failed && opts.publish) {
  console.log(`
Wrote ${path.join(opts.out, 'index.json')}. CI generates these copies on every deploy, so there is
nothing to commit (public/medium/ is git-ignored). Once a post is live, import its copy at
medium.com/p/import. Check the draft, add up to 5 tags and, under Story settings → Advanced settings,
make sure the canonical link is the original post (not the /medium/ copy).`);
} else if (!failed) {
  console.log(`
Next: open index.html in Chrome, select the article (⌘A), copy (⌘C) and paste into a new
Medium story (medium.com/new-story). Then check images, add up to 5 tags and, under
Story settings → Advanced settings, customise the canonical link to the original post.`);
}
process.exit(failed ? 1 : 0);
