#!/usr/bin/env node
/**
 * Tell IndexNow search engines (Bing, Yandex, Seznam, Naver; not Google) about new pages.
 *
 *   node scripts/indexnow.mjs --snapshot <file>   # save the live sitemap's URLs (before deploy)
 *   node scripts/indexnow.mjs --since <file>      # submit live sitemap URLs not in <file> (after deploy)
 *   npm run indexnow -- --all                     # submit every URL in the live sitemap
 *   npm run indexnow -- <url> [<url>...]          # submit specific URLs (e.g. an edited post)
 *   add --dry-run to print the URLs without submitting
 *
 * CI snapshots the sitemap before each deploy and submits the difference afterwards, so newly
 * published (including scheduled) posts are pinged once. The key file must be live at
 * public/<KEY>.txt. Uses only Node built-ins so CI can run it without `npm ci`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { annotate } from './lib/dist.mjs';

const SITE = 'https://www.shirleyconsulting.co.uk/';
const KEY = 'a35398744d135bf0cdd53a5bcef00334';
const KEY_LOCATION = new URL(`${KEY}.txt`, SITE).href;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function liveSitemapUrls() {
  const xml = await fetchText(new URL('sitemap.xml', SITE));
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const snapshotFile = flag('--snapshot');
if (snapshotFile) {
  // Before the first deploy there may be no sitemap; an empty snapshot is still valid.
  const urls = await liveSitemapUrls().catch((err) => {
    annotate('warning', `IndexNow: could not read live sitemap (${err.message}); snapshot is empty.`);
    return [];
  });
  await writeFile(snapshotFile, urls.join('\n') + '\n');
  console.log(`Saved ${urls.length} URLs to ${snapshotFile}.`);
  process.exit(0);
}

let urls;
const sinceFile = flag('--since');
if (sinceFile) {
  const before = new Set((await readFile(sinceFile, 'utf8')).split('\n').filter(Boolean));
  if (before.size === 0) {
    // No baseline: submitting the whole site on every failed snapshot would be noisy.
    console.log('IndexNow: empty snapshot, nothing to compare against. Skipping.');
    process.exit(0);
  }
  urls = (await liveSitemapUrls()).filter((u) => !before.has(u));
} else if (args.includes('--all')) {
  urls = await liveSitemapUrls();
} else {
  urls = args.filter((a) => !a.startsWith('--'));
}

const host = new URL(SITE).host;
const wrongHost = urls.filter((u) => new URL(u).host !== host);
if (wrongHost.length) {
  annotate('error', `IndexNow: URLs must be on ${host}:\n${wrongHost.join('\n')}`);
  process.exit(1);
}

if (urls.length === 0) {
  console.log('IndexNow: no new URLs to submit.');
  process.exit(0);
}

console.log(`IndexNow: ${urls.length} URL(s):\n${urls.join('\n')}`);
if (dryRun) process.exit(0);

// Search engines reject the request if the key file isn't served, so fail early with a clear message.
const served = (await fetchText(KEY_LOCATION).catch(() => '')).trim();
if (served !== KEY) {
  annotate('error', `IndexNow: key file ${KEY_LOCATION} is not live or doesn't match the key.`);
  process.exit(1);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
  signal: AbortSignal.timeout(30_000),
});
// 200 = accepted, 202 = accepted, key validation pending.
if (res.status === 200 || res.status === 202) {
  console.log(`IndexNow: submitted (HTTP ${res.status}).`);
} else {
  annotate('error', `IndexNow: HTTP ${res.status} ${await res.text().catch(() => '')}`.trim());
  process.exit(1);
}
