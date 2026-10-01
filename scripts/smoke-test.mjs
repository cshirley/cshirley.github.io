#!/usr/bin/env node
/**
 * Smoke test a deployed site: the home page, feed, sitemap and every page the sitemap lists
 * must return 200 with the expected content type. Every live post must also have a Medium
 * import copy: /medium/index.json is checked against the sitemap's posts, and each copy is fetched.
 *
 *   npm run smoke                                   # production (site in astro.config.mjs)
 *   npm run smoke -- http://localhost:4321          # e.g. against `npm run preview`
 *
 * Runs in CI after each deploy. Retries failures for a while, since GitHub Pages can take a
 * short time to serve a new deploy. Uses only Node built-ins so CI can run it without `npm ci`.
 */
import { annotate } from './lib/dist.mjs';

const DEFAULT_SITE = 'https://www.shirleyconsulting.co.uk/';
const ATTEMPTS = Number(process.env.SMOKE_ATTEMPTS ?? 5);
const RETRY_DELAY_MS = Number(process.env.SMOKE_RETRY_DELAY_MS ?? 10_000);
const CONCURRENCY = 6;

const base = new URL(process.argv[2] || DEFAULT_SITE);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch with retries; resolves to an error string, or null if OK. */
async function check(url, expectType) {
  let last = '';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(15_000),
      });
      const type = res.headers.get('content-type') ?? '';
      if (res.status !== 200) last = `HTTP ${res.status}`;
      else if (!expectType.test(type)) last = `unexpected content-type "${type}"`;
      else return { error: null, body: await res.text() };
    } catch (err) {
      last = err.cause?.code ?? err.message;
    }
    if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
  return { error: last, body: '' };
}

const HTML = /text\/html/;
const XML = /xml/;

const sitemap = await check(new URL('sitemap.xml', base), XML);
if (sitemap.error) {
  annotate('error', `Smoke test: ${new URL('sitemap.xml', base)} failed: ${sitemap.error}`);
  process.exit(1);
}

// Sitemap <loc>s use the canonical domain; rebase them so the test also works against preview.
const pages = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
  const u = new URL(m[1]);
  return new URL(u.pathname + u.search, base).href;
});
if (pages.length === 0) {
  annotate('error', 'Smoke test: sitemap.xml lists no pages.');
  process.exit(1);
}

const targets = [
  ...pages.map((url) => ({ url, type: HTML })),
  { url: new URL('feed.xml', base).href, type: XML },
];

const failures = [];

// Medium copies (generated in CI by `npm run medium -- --all --live --publish`).
const mediumIndex = await check(new URL('medium/index.json', base), /json/);
if (mediumIndex.error) {
  failures.push(`${new URL('medium/index.json', base)}: ${mediumIndex.error}`);
} else {
  const copies = JSON.parse(mediumIndex.body);
  const copied = new Set(copies.map((c) => new URL(c.original).pathname));
  for (const url of pages.filter((u) => u.endsWith('.html'))) {
    const p = new URL(url).pathname;
    if (!copied.has(p)) failures.push(`${url}: no Medium copy in medium/index.json`);
  }
  // ?preview stops the copy's script from redirecting to the original post.
  targets.push(...copies.map((c) => ({ url: new URL(`medium/${c.id}/?preview`, base).href, type: HTML })));
}

let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < targets.length) {
      const { url, type } = targets[next++];
      const { error } = await check(url, type);
      if (error) failures.push(`${url}: ${error}`);
    }
  }),
);

if (failures.length) {
  annotate('error', `Smoke test: ${failures.length} of ${targets.length} URLs failed:\n${failures.sort().join('\n')}`);
  process.exit(1);
}
console.log(`Smoke test OK: ${targets.length} URLs on ${base.origin} returned 200.`);
