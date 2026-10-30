// Editorial approval for posts: a fingerprint of what the author reviewed, stored in front matter.
// Approval never publishes anything; it only records that this exact content was reviewed.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const BASELINE_FILE = 'src/data/approval-baseline.json';
const FINGERPRINT_VERSION = 1;

const sha = (data) => createHash('sha256').update(data).digest('hex');

/** Root-relative local files a post body references (images, downloads), e.g. /assets/a.png. */
export function localAssetRefs(body) {
  const refs = new Set();
  for (const m of body.matchAll(/(?:src=|href=|\]\()\s*["']?(\/[^"')\s>#?]+)/g)) refs.add(m[1]);
  return [...refs].sort();
}

/**
 * Deterministic fingerprint of the reviewed content: title, description, categories, tags, author,
 * body and the bytes of referenced local assets. The date, draft flag and approval metadata are
 * deliberately excluded, so scheduling and re-dating never invalidate an approval.
 */
export async function fingerprint(sourceRoot, fm, body) {
  const assets = {};
  for (const ref of localAssetRefs(body)) {
    const file = path.join(sourceRoot, 'public', ref);
    if (existsSync(file)) assets[ref] = sha(await readFile(file));
    else if (ref.startsWith('/assets/')) assets[ref] = 'missing';
  }
  const editorial = {
    v: FINGERPRINT_VERSION,
    title: fm.title ?? null,
    description: fm.description ?? null,
    categories: fm.categories ?? [],
    tags: fm.tags ?? [],
    author: fm.author ?? null,
    body: body.replace(/\r\n/g, '\n').trim(),
    assets,
  };
  return `sha256:${sha(JSON.stringify(editorial))}`;
}

export function readBaseline(sourceRoot) {
  const file = path.join(sourceRoot, BASELINE_FILE);
  if (!existsSync(file)) return new Set();
  const ids = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    throw new Error(`${BASELINE_FILE} must be an array of post ids`);
  }
  return new Set(ids);
}

/**
 * baseline: grandfathered historical post; approved: current approval; stale: approval exists but
 * the content changed; missing: managed post with no approval.
 */
export function approvalStatus({ id, approval, fingerprint: current }, baseline) {
  if (approval?.fingerprint) return approval.fingerprint === current ? 'approved' : 'stale';
  return baseline.has(id) ? 'baseline' : 'missing';
}

/** A post may be non-draft in production only if it is approved or grandfathered. */
export const approvalOk = (status) => status === 'approved' || status === 'baseline';
