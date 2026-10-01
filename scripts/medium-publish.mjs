#!/usr/bin/env node
/**
 * Cross-post live posts to Medium through Medium's API, with the canonical link set to the
 * original post. Reads the hosted import copies (/medium/index.json) that CI builds on deploy.
 *
 *   npm run medium:publish                    list live posts not yet cross-posted
 *   npm run medium:publish -- <post>… [--public] [--dry-run]
 *   npm run medium:publish -- --all-pending [--public] [--dry-run]
 *   npm run medium:publish-pending [-- --public] [--dry-run]   same as --all-pending
 *
 * --publication <slug|name|id> (or MEDIUM_PUBLICATION) posts under that publication instead of your
 * profile. You need to be an editor for --public to publish directly; writers' posts become drafts.
 *
 * <post> is an id, slug or unique part of one. Posts are created as Medium DRAFTS unless
 * --public is given. Posted ids are recorded in src/data/medium-posted.json (commit it) so a
 * post is never cross-posted twice. Needs MEDIUM_TOKEN (an integration token) in the environment.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import astroConfig from '../astro.config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = String(astroConfig.site).replace(/\/$/, '');
const LEDGER = path.join(root, 'src/data/medium-posted.json');
const API = 'https://api.medium.com/v1';

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
  --dry-run       show what would be sent; call nothing that writes`);
  process.exit(0);
}

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res;
}

async function medium(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.MEDIUM_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body && JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Medium ${method} ${route} -> HTTP ${res.status} ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}

const ledger = existsSync(LEDGER) ? JSON.parse(await readFile(LEDGER, 'utf8')) : {};
const index = await (await get(`${SITE}/medium/index.json`)).json();
const pending = index.filter((p) => !ledger[p.id]);

let targets;
if (opts['all-pending']) targets = [...pending].reverse(); // oldest first
else if (positionals.length) {
  targets = positionals.map((q) => {
    const hits = index.filter((p) => p.id === q || p.id.includes(q));
    const exact = hits.find((p) => p.id === q);
    if (!exact && hits.length !== 1) {
      throw new Error(`"${q}" matches ${hits.length} live posts${hits.length ? ': ' + hits.map((h) => h.id).join(', ') : ' (not live yet? see npm run schedule)'}`);
    }
    return exact ?? hits[0];
  });
} else {
  console.log(pending.length ? `Not yet on Medium (${pending.length}):` : 'Nothing pending.');
  for (const p of pending) console.log(`  ${p.id}`);
  process.exit(0);
}

if (!opts['dry-run'] && !process.env.MEDIUM_TOKEN) {
  console.error('MEDIUM_TOKEN is not set.');
  process.exit(1);
}

let userId;
let publication; // { id, name, url } once resolved
const pubQuery = opts.publication ?? process.env.MEDIUM_PUBLICATION;

async function resolvePublication() {
  userId ??= (await medium('GET', '/me')).id;
  const q = pubQuery.toLowerCase();
  const pubs = await medium('GET', `/users/${userId}/publications`);
  const hit = pubs.find((x) => x.id === pubQuery || x.url.toLowerCase().endsWith(`/${q}`) || x.name.toLowerCase() === q);
  if (!hit) throw new Error(`publication "${pubQuery}" not found among: ${pubs.map((x) => x.name).join(', ')}`);
  return hit;
}
let failed = 0;
for (const p of targets) {
  if (ledger[p.id]) {
    console.log(`- ${p.id}: already posted (${ledger[p.id].url}), skipped`);
    continue;
  }
  try {
    const html = await (await get(p.import)).text();
    const content = html.match(/<article>([\s\S]*?)<\/article>/)?.[1].trim();
    if (!content) throw new Error('no <article> in import copy');
    const tags = decode(html.match(/<meta name="medium-tags" content="([^"]*)"/)?.[1] ?? '')
      .split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5);
    const payload = {
      title: p.title,
      contentFormat: 'html',
      content,
      canonicalUrl: p.original,
      tags,
      publishStatus: opts.public ? 'public' : 'draft',
    };
    if (opts['dry-run']) {
      console.log(`[dry-run] ${p.id}: ${payload.publishStatus}${pubQuery ? ` in ${pubQuery}` : ''}, tags [${tags.join(', ')}], canonical ${p.original}, ${content.length} chars`);
      continue;
    }
    userId ??= (await medium('GET', '/me')).id;
    if (pubQuery) publication ??= await resolvePublication();
    const route = publication ? `/publications/${publication.id}/posts` : `/users/${userId}/posts`;
    const post = await medium('POST', route, payload);
    ledger[p.id] = {
      mediumId: post.id,
      url: post.url,
      status: post.publishStatus,
      ...(publication && { publication: publication.name }),
      at: new Date().toISOString(),
    };
    await writeFile(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
    console.log(`✓ ${p.id} -> ${post.url} (${post.publishStatus})`);
  } catch (err) {
    failed++;
    console.error(`✗ ${p.id}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
