#!/usr/bin/env node
/**
 * Cross-post live posts to Medium through Medium's API, with the canonical link set to the
 * original post. Builds the Medium HTML locally (scripts/medium-export.mjs), uploads the images
 * to Medium, then creates the story. It does not depend on CI or on the site being deployed.
 *
 *   npm run medium:publish                    list live posts not yet cross-posted
 *   npm run medium:publish -- <post>… [--public] [--dry-run]
 *   npm run medium:publish -- --all-pending [--public] [--dry-run]
 *   npm run medium:publish-pending [-- --public] [--dry-run]   same as --all-pending
 *
 * --publication <slug|name|id> (or MEDIUM_PUBLICATION) posts under that publication instead of your
 * profile. You need to be an editor for --public to publish directly; writers' posts become drafts.
 *
 * <post> is an id, slug or unique part of one. Only live posts are eligible: the canonical URL
 * must exist. Posts are created as Medium DRAFTS unless --public is given. Posted ids are
 * recorded in src/data/medium-posted.json (commit it) so a post is never cross-posted twice.
 * Needs MEDIUM_TOKEN (an integration token) in the environment.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = path.join(root, 'scripts/medium-export.mjs');
const OUT = path.join(root, 'medium-export');
const LEDGER = path.join(root, 'src/data/medium-posted.json');
const API = 'https://api.medium.com/v1';
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.tif': 'image/tiff', '.tiff': 'image/tiff' };

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'all-pending': { type: 'boolean', default: false },
    public: { type: 'boolean', default: false },
    publication: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (opts.help) {
  console.log(`Usage: npm run medium:publish [-- <post>… | --all-pending] [--public] [--dry-run]
  (no args)       list live posts not yet on Medium
  --publication X post into publication X (slug, name or id; default env MEDIUM_PUBLICATION)
  --public        publish immediately (default: create a Medium draft)
  --dry-run       build and show what would be sent; upload and post nothing`);
  process.exit(0);
}

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const headers = () => ({ Authorization: `Bearer ${process.env.MEDIUM_TOKEN}`, Accept: 'application/json' });

async function call(method, route, { json, form } = {}) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: json ? { ...headers(), 'Content-Type': 'application/json' } : headers(),
    body: json ? JSON.stringify(json) : form,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Medium ${method} ${route} -> HTTP ${res.status} ${JSON.stringify(out.errors ?? out)}`);
  return out.data;
}

async function uploadImage(file) {
  const type = MIME[path.extname(file).toLowerCase()];
  if (!type) throw new Error(`Medium cannot take ${path.extname(file)} images (png, jpeg, gif, tiff only): ${file}`);
  const form = new FormData();
  form.append('image', new Blob([await readFile(file)], { type }), path.basename(file));
  return (await call('POST', '/images', { form })).url;
}

const ledger = existsSync(LEDGER) ? JSON.parse(await readFile(LEDGER, 'utf8')) : {};
const live = JSON.parse(execFileSync('node', [EXPORT, '--list'], { cwd: root, encoding: 'utf8' }).trim().split('\n').pop());
const pending = live.filter((id) => !ledger[id]);

let targets;
if (opts['all-pending']) targets = [...pending].reverse(); // oldest first
else if (positionals.length) {
  targets = positionals.map((q) => {
    const hits = live.filter((id) => id === q || id.includes(q));
    const exact = hits.find((id) => id === q);
    if (!exact && hits.length !== 1) {
      throw new Error(`"${q}" matches ${hits.length} live posts${hits.length ? ': ' + hits.join(', ') : ' (draft, scheduled or unknown? see npm run schedule)'}`);
    }
    return exact ?? hits[0];
  });
} else {
  console.log(pending.length ? `Not yet on Medium (${pending.length}):` : 'Nothing pending.');
  for (const id of pending) console.log(`  ${id}`);
  process.exit(0);
}

const todo = targets.filter((id) => {
  if (ledger[id]) console.log(`- ${id}: already posted (${ledger[id].url}), skipped`);
  return !ledger[id];
});
if (!todo.length) process.exit(0);

if (!opts['dry-run'] && !process.env.MEDIUM_TOKEN) {
  console.error('MEDIUM_TOKEN is not set.');
  process.exit(1);
}

// One export run for every target (one dev server, one Chrome).
const built = spawnSync('node', [EXPORT, ...todo, '--out', OUT], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
if (built.status !== 0) console.error('! some posts failed to export; posting the ones that built');

const pubQuery = opts.publication ?? process.env.MEDIUM_PUBLICATION;
let userId;
let publication;

async function resolvePublication() {
  const q = pubQuery.toLowerCase();
  const pubs = await call('GET', `/users/${userId}/publications`);
  const hit = pubs.find((x) => x.id === pubQuery || x.url.toLowerCase().endsWith(`/${q}`) || x.name.toLowerCase() === q);
  if (!hit) throw new Error(`publication "${pubQuery}" not found among: ${pubs.map((x) => x.name).join(', ')}`);
  return hit;
}

let failed = 0;
for (const id of todo) {
  try {
    const dir = path.join(OUT, id);
    const file = path.join(dir, 'index.html');
    if (!existsSync(file)) throw new Error('export failed, no index.html');
    const html = await readFile(file, 'utf8');
    let content = html.match(/<article>([\s\S]*?)<\/article>/)?.[1].trim();
    if (!content) throw new Error('no <article> in export');
    const title = decode(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? id);
    const canonicalUrl = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (!canonicalUrl) throw new Error('no canonical link in export');
    const tags = decode(html.match(/<meta name="medium-tags" content="([^"]*)"/)?.[1] ?? '')
      .split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5);
    const local = [...new Set([...content.matchAll(/<img [^>]*src="(images\/[^"]+)"/g)].map((m) => m[1]))];
    const status = opts.public ? 'public' : 'draft';

    if (opts['dry-run']) {
      console.log(`[dry-run] ${id}: ${status}${pubQuery ? ` in ${pubQuery}` : ''}, tags [${tags.join(', ')}], ${local.length} image(s), canonical ${canonicalUrl}, ${content.length} chars`);
      continue;
    }

    userId ??= (await call('GET', '/me')).id;
    if (pubQuery) publication ??= await resolvePublication();
    for (const src of local) content = content.split(`"${src}"`).join(`"${await uploadImage(path.join(dir, src))}"`);

    const route = publication ? `/publications/${publication.id}/posts` : `/users/${userId}/posts`;
    const post = await call('POST', route, {
      json: { title, contentFormat: 'html', content, canonicalUrl, tags, publishStatus: status },
    });
    ledger[id] = {
      mediumId: post.id,
      url: post.url,
      status: post.publishStatus,
      ...(publication && { publication: publication.name }),
      at: new Date().toISOString(),
    };
    await writeFile(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
    console.log(`✓ ${id} -> ${post.url} (${post.publishStatus})`);
  } catch (err) {
    failed++;
    console.error(`✗ ${id}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
