#!/usr/bin/env node
/**
 * Share live posts on LinkedIn from a local checkout, with a small ledger of what has already
 * been shared. This mirrors the Medium cross-post workflow: list pending posts, target specific
 * posts by id/slug, or post every pending one.
 *
 *   npm run linkedin:publish                    list live posts not yet on LinkedIn
 *   npm run linkedin:publish -- <post>… [--dry-run] [--force]
 *   npm run linkedin:publish -- --all-pending [--dry-run] [--force]
 *   npm run linkedin:publish -- --refresh-ledger
 *   npm run linkedin:publish-pending [-- --dry-run] [--force]
 *
 * <post> is an id, slug or unique part of one. Only live posts are eligible. The canonical URL
 * must be live, because LinkedIn shares it as an article link and the copy comes from the live
 * page's og: tags.
 *
 * Posted ids are recorded in src/data/linkedin-posted.json. To catch posts shared automatically
 * by GitHub Actions, --refresh-ledger also scrapes successful LinkedIn shares from recent GitHub
 * Actions logs via `gh run`.
 *
 * Needs LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR in the environment for real posts. Listing and
 * --refresh-ledger work without LinkedIn credentials; --refresh-ledger needs an authenticated `gh`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';
import astroConfig from '../astro.config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = path.join(root, 'src/content/posts');
const LEDGER = path.join(root, 'src/data/linkedin-posted.json');
const SITE = String(astroConfig.site).replace(/\/$/, '');
const VERSION = process.env.LINKEDIN_VERSION ?? '202511';
const POST_PATH = /^\/[^/]+\/\d{4}\/\d{2}\/\d{2}\/[^/]+\.html$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'all-pending': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'refresh-ledger': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    'gh-limit': { type: 'string', default: '60' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (opts.help) {
  console.log(`Usage: npm run linkedin:publish [-- <post>… | --all-pending] [--dry-run] [--force]
  (no args)         list live posts not yet on LinkedIn
  --all-pending     post every pending live post (oldest first)
  --dry-run         print what would be posted; post nothing
  --force           post even if the ledger/logs say it was already shared
  --refresh-ledger  merge successful GitHub Actions shares into src/data/linkedin-posted.json
  --gh-limit N      inspect at most N runs per workflow when scraping GitHub logs (default: 60)`);
  process.exit(0);
}

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pad = (n) => String(n).padStart(2, '0');
const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const fetchText = async (url) => {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
};
const meta = (html, prop) => {
  const m =
    html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, 'i')) ??
    html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, 'i'));
  return m ? decode(m[1]) : '';
};
const byKey = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

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
        description: fm.description ? String(fm.description) : '',
        unpublished: fm.draft === true || fm.published === false || date.valueOf() > Date.now(),
        published: `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
        path: `/${urlPath}.html`,
        url: `${SITE}/${urlPath}.html`,
      };
    }),
  );
}

function pickPosts(posts, queries) {
  return queries.map((q) => {
    const key = path.basename(q).replace(/\.md$/, '');
    const exact = posts.find((p) => p.id === key || p.slug === key);
    if (exact) return exact;
    const hits = posts.filter((p) => p.id.includes(key));
    if (hits.length === 1) return hits[0];
    throw new Error(
      hits.length
        ? `"${q}" is ambiguous: ${hits.map((p) => p.id).join(', ')}`
        : `"${q}" matches no live post (draft, scheduled or unknown?)`,
    );
  });
}

function readLedger() {
  return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {};
}

async function writeLedger(entries) {
  await writeFile(LEDGER, JSON.stringify(byKey(entries), null, 2) + '\n');
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
}

function ghText(args) {
  return execFileSync('gh', args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function discoverSharedFromLog(text, workflow, runId, createdAt, idsByPath) {
  const found = {};
  let currentUrl = null;
  for (const line of text.split(/\r?\n/)) {
    const url = line.match(/LinkedIn: (https:\/\/\S+\.html)\s*$/)?.[1];
    if (url) {
      currentUrl = url;
      continue;
    }
    const urn = line.match(/LinkedIn: shared \(([^)]+)\)\./)?.[1];
    if (!urn || !currentUrl) continue;
    let pathname;
    try {
      pathname = new URL(currentUrl).pathname;
    } catch {
      currentUrl = null;
      continue;
    }
    const id = idsByPath.get(pathname);
    if (id && !found[id]) {
      found[id] = {
        url: currentUrl,
        shareUrn: urn,
        at: createdAt,
        source: { kind: 'github-actions', workflow, runId },
      };
    }
    currentUrl = null;
  }
  return found;
}

async function scrapeGitHubLedger(idsByPath, limit) {
  try {
    ghText(['auth', 'status']);
  } catch {
    return { found: {}, error: 'gh auth unavailable; using committed ledger only' };
  }

  const workflows = ['Deploy to GitHub Pages', 'Share post on LinkedIn'];
  const found = {};
  try {
    for (const workflow of workflows) {
      const runs = ghJson(['run', 'list', '--workflow', workflow, '--limit', String(limit), '--json', 'databaseId,createdAt,status,conclusion']);
      for (const run of runs) {
        if (run.status !== 'completed' || run.conclusion !== 'success') continue;
        const log = ghText(['run', 'view', String(run.databaseId), '--log']);
        Object.assign(found, discoverSharedFromLog(log, workflow, Number(run.databaseId), run.createdAt, idsByPath));
      }
    }
    return { found };
  } catch (err) {
    return { found, error: `gh log scrape failed: ${err.message}` };
  }
}

const posts = await loadPosts();
const live = posts.filter((p) => !p.unpublished);
const idsByPath = new Map(live.map((p) => [p.path, p.id]));
const ghLimit = Math.max(1, Number.parseInt(opts['gh-limit'], 10) || 60);

let posted = byKey(readLedger());
if (opts['refresh-ledger']) {
  const { found: ghLedger, error: ghError } = await scrapeGitHubLedger(idsByPath, ghLimit);
  if (ghError) console.log(`Note: ${ghError}`);
  const discoveredOnly = Object.fromEntries(Object.entries(ghLedger).filter(([id]) => !posted[id]));
  posted = byKey({ ...ghLedger, ...posted });
  await writeLedger(posted);
  console.log(
    Object.keys(discoveredOnly).length
      ? `Ledger refreshed: added ${Object.keys(discoveredOnly).length} post(s) from GitHub Actions.`
      : 'Ledger refreshed: no new GitHub Actions shares found.',
  );
}

const pending = live.filter((p) => !posted[p.id]);

if (!opts['all-pending'] && positionals.length === 0) {
  console.log(pending.length ? `Not yet on LinkedIn (${pending.length}):` : 'Nothing pending.');
  for (const post of pending) console.log(`  ${post.id}`);
  if (!opts['refresh-ledger']) {
    console.log(`\nLedger: ${path.relative(root, LEDGER)}. Run with --refresh-ledger to merge successful GitHub Actions shares via gh.`);
  }
  process.exit(0);
}

let targets;
if (opts['all-pending']) targets = [...pending];
else targets = pickPosts(live, positionals);
targets = [...targets].sort((a, b) => a.id.localeCompare(b.id));

const todo = targets.filter((post) => {
  if (posted[post.id] && !opts.force) {
    console.log(`- ${post.id}: already shared (${posted[post.id].url}), skipped`);
    return false;
  }
  return true;
});
if (!todo.length) process.exit(0);

const token = process.env.LINKEDIN_ACCESS_TOKEN;
const author = process.env.LINKEDIN_AUTHOR;
if (!opts['dry-run'] && (!token || !author)) {
  console.error('LINKEDIN_ACCESS_TOKEN or LINKEDIN_AUTHOR is not set.');
  process.exit(1);
}

let failed = 0;
const nextLedger = { ...posted };
for (const post of todo) {
  try {
    if (!POST_PATH.test(new URL(post.url).pathname)) throw new Error(`not a post URL: ${post.url}`);
    const html = await fetchText(post.url);
    const title = meta(html, 'og:title') || post.title;
    const description = meta(html, 'og:description') || post.description;
    const commentary = description ? `${title}\n\n${description}` : title;
    console.log(`LinkedIn: ${post.url}\n${commentary}`);

    if (opts['dry-run']) continue;

    const body = {
      author,
      commentary,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { article: { source: post.url, title, description } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };
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
    if (res.status !== 201) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).trim()}`.trim());

    const shareUrn = res.headers.get('x-restli-id') ?? '';
    nextLedger[post.id] = {
      url: post.url,
      title,
      description,
      shareUrn,
      at: new Date().toISOString(),
      source: { kind: 'local-cli' },
    };
    await writeLedger(nextLedger);
    console.log(`LinkedIn: shared (${shareUrn}).`);
  } catch (err) {
    failed++;
    console.error(`✗ ${post.id}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
