#!/usr/bin/env node
/**
 * Share newly published posts on LinkedIn (article link post, via the Posts API).
 *
 *   node scripts/linkedin-post.mjs --since <file> [--dry-run]   # live sitemap URLs not in <file>
 *   node scripts/linkedin-post.mjs [--dry-run] <url>...         # specific post URLs
 *
 * CI runs this after deploy with the sitemap snapshot taken before it, so each newly live
 * (including scheduled) post is shared once. Only post URLs (/<category>/yyyy/mm/dd/slug.html)
 * are shared. Title and description come from the live page's og: tags.
 *
 * Env: LINKEDIN_ACCESS_TOKEN (3-legged OAuth, scope w_member_social; expires about every 60 days)
 *      LINKEDIN_AUTHOR       (urn:li:person:<id>, or urn:li:organization:<id> for a page)
 *      LINKEDIN_VERSION      (optional, YYYYMM; default below)
 * Missing credentials skip with a warning rather than failing. Uses only Node built-ins.
 */
import { readFile } from 'node:fs/promises';

const SITE = 'https://www.shirleyconsulting.co.uk/';
const POST_PATH = /^\/[^/]+\/\d{4}\/\d{2}\/\d{2}\/[^/]+\.html$/;
const VERSION = process.env.LINKEDIN_VERSION ?? '202511';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sinceIdx = args.indexOf('--since');
const sinceFile = sinceIdx === -1 ? null : args[sinceIdx + 1];

const annotate = (level, msg) => console.log(`::${level}::${msg}`);
const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

const meta = (html, prop) => {
  const m =
    html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, 'i')) ??
    html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, 'i'));
  return m ? decode(m[1]) : '';
};

let urls;
if (sinceFile) {
  const before = new Set((await readFile(sinceFile, 'utf8')).split('\n').filter(Boolean));
  if (before.size === 0) {
    console.log('LinkedIn: empty snapshot, nothing to compare against. Skipping.');
    process.exit(0);
  }
  const xml = await fetchText(new URL('sitemap.xml', SITE));
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !before.has(u));
} else {
  urls = args.filter((a) => !a.startsWith('--'));
}
urls = urls.filter((u) => POST_PATH.test(new URL(u).pathname));

if (urls.length === 0) {
  console.log('LinkedIn: no new posts to share.');
  process.exit(0);
}

const token = process.env.LINKEDIN_ACCESS_TOKEN;
const author = process.env.LINKEDIN_AUTHOR;
if (!dryRun && (!token || !author)) {
  annotate('warning', 'LinkedIn: LINKEDIN_ACCESS_TOKEN / LINKEDIN_AUTHOR not set; skipping.');
  process.exit(0);
}

let failed = false;
for (const url of urls) {
  try {
    const html = await fetchText(url);
    const title = meta(html, 'og:title');
    const description = meta(html, 'og:description');
    const body = {
      author,
      commentary: description ? `${title}\n\n${description}` : title,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { article: { source: url, title, description } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };
    console.log(`LinkedIn: ${url}\n${body.commentary}`);
    if (dryRun) continue;
    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'Linkedin-Version': VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 201) console.log(`LinkedIn: shared (${res.headers.get('x-restli-id')}).`);
    else throw new Error(`HTTP ${res.status} ${await res.text().catch(() => '')}`.trim());
  } catch (err) {
    failed = true;
    annotate('error', `LinkedIn: ${url}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
