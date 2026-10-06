#!/usr/bin/env node
/**
 * Check every internal link and asset reference in the built site (dist/).
 *
 *   npm run build && npm run check:links
 *
 * Scans href, src, srcset and poster attributes plus og:image/twitter:image in every HTML page.
 * Same-site links (site-relative, page-relative or absolute to the site's own domain) must resolve
 * to a file in dist/. External links are not fetched. Exits 1 if any link is broken.
 */
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import astroConfig from '../astro.config.mjs';
import { annotate, dist, distFiles, urlPathFor } from './lib/dist.mjs';

const site = new URL(String(astroConfig.site));
const SKIP_SCHEMES = /^(mailto|tel|javascript|data|blob):/i;

const ATTR = /\s(href|src|srcset|poster)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const META_IMAGE = /<meta\s[^>]*(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/gi;

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'");

/** Strip <pre>, <script> and <style> bodies so code samples aren't read as links. */
const stripCode = (html) =>
  html.replace(/<(pre|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (_m, tag) => `<${tag}></${tag}>`);

function refsIn(html) {
  const refs = [];
  for (const [, attr, dq, sq] of html.matchAll(ATTR)) {
    const value = decode(dq ?? sq ?? '').trim();
    if (!value) continue;
    if (attr.toLowerCase() === 'srcset') {
      refs.push(...value.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean));
    } else refs.push(value);
  }
  for (const [tag] of html.matchAll(META_IMAGE)) {
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) refs.push(decode(content));
  }
  return refs;
}

/** dist/ file a site URL path is served from, or null. Mirrors GitHub Pages' lookup. */
function resolve(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const file = path.join(dist, p);
  if (!file.startsWith(dist)) return null;
  const candidates = p.endsWith('/')
    ? [path.join(file, 'index.html')]
    : [file, `${file}.html`, path.join(file, 'index.html')];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

const pages = (await distFiles()).filter((f) => f.endsWith('.html'));
const broken = new Map(); // page -> Set of refs
let checked = 0;

for (const page of pages) {
  const html = stripCode(await readFile(path.join(dist, page), 'utf8'));
  const base = new URL(urlPathFor(page), site);
  for (const ref of refsIn(html)) {
    if (ref.startsWith('#') || SKIP_SCHEMES.test(ref)) continue;
    let url;
    try {
      url = new URL(ref, base);
    } catch {
      (broken.get(page) ?? broken.set(page, new Set()).get(page)).add(`${ref} (invalid URL)`);
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || url.host !== site.host) continue;
    checked++;
    if (!resolve(url.pathname)) {
      (broken.get(page) ?? broken.set(page, new Set()).get(page)).add(ref);
    }
  }
}

if (broken.size) {
  let total = 0;
  for (const [page, refs] of broken) {
    total += refs.size;
    annotate('error', `Broken links in ${urlPathFor(page)}:\n${[...refs].map((r) => `  ${r}`).join('\n')}`);
  }
  console.error(`\n${total} broken internal link(s) across ${broken.size} page(s).`);
  process.exit(1);
}
console.log(`Links OK: ${checked} internal links across ${pages.length} pages.`);
