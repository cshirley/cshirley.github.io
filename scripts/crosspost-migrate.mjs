#!/usr/bin/env node
/**
 * One-off migration of the separate Medium and LinkedIn ledgers into src/data/crosspost-state.json,
 * plus the reviewed historical baseline. Prints everything for review; writes only with --write.
 *
 *   node scripts/crosspost-migrate.mjs --source-sha <sha> [--medium-missing skip|id,id] [--write]
 *
 * - LinkedIn successes -> published (share URN kept). Medium records keep their status
 *   (public -> published, draft stays draft); publication and capture time are preserved.
 * - Baseline: every article live at capture time. Without LinkedIn state it is `skipped` with the
 *   historical reason (excluded from automation, not proof it was never shared).
 * - Live Medium articles missing from the ledger need an explicit decision via --medium-missing:
 *   "skip" marks them skipped; a list of ids leaves those eligible (approved backfill).
 * - Refuses to overwrite an existing state file unless --force. Never writes without --write.
 */
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadArticles } from './lib/crosspost/articles.mjs';
import { validateState, writeState } from './lib/crosspost/state.mjs';
import { root } from './lib/dist.mjs';

export const LINKEDIN_REASON = 'Historical article at rollout; excluded from automatic sharing (not proof it was never shared)';
export const MEDIUM_REASON = 'Historical article at rollout; Medium backfill not approved';

const readJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {});

/** Pure: build the merged state and report. */
export function migrate({ linkedin, medium, articles, mediumMissing, sourceSha, capturedAt }) {
  const state = {};
  const put = (id, adapter, rec) => ((state[id] ??= {})[adapter] = rec);
  const notes = [];
  for (const [id, r] of Object.entries(linkedin)) {
    if (!r.shareUrn) throw new Error(`linkedin ledger entry ${id} has no shareUrn`);
    put(id, 'linkedin', { status: 'published', externalId: r.shareUrn, ...(r.url ? { sourceUrl: r.url } : {}), at: r.at, provenance: r.source ?? { kind: 'migrated-ledger' } });
  }
  for (const [id, r] of Object.entries(medium)) {
    const status = { public: 'published', draft: 'draft' }[r.status];
    if (!status) throw new Error(`medium ledger entry ${id} has unsupported status "${r.status}"`);
    put(id, 'medium', { status, externalId: r.mediumId, url: r.url, ...(r.publication ? { publication: r.publication } : {}), ...(r.at ? { at: r.at } : {}), provenance: { kind: 'migrated-ledger' } });
  }
  const backfill = new Set(mediumMissing === 'skip' ? [] : mediumMissing);
  const missingMedium = [];
  for (const a of articles) {
    if (!state[a.id]?.linkedin) put(a.id, 'linkedin', { status: 'skipped', reason: LINKEDIN_REASON });
    if (!state[a.id]?.medium) {
      missingMedium.push(a.id);
      if (!backfill.has(a.id)) put(a.id, 'medium', { status: 'skipped', reason: MEDIUM_REASON });
    }
  }
  for (const id of backfill) if (!missingMedium.includes(id)) throw new Error(`--medium-missing names ${id}, which is not a live article missing from the Medium ledger`);
  for (const id of Object.keys(state)) if (!articles.some((a) => a.id === id)) notes.push(`${id}: ledger entry for an article that is not live at capture (kept as is)`);
  validateState(state);
  const eligible = { linkedin: [], medium: [...backfill] };
  return { state, notes, missingMedium, eligible, baseline: { sourceSha, capturedAt, articles: articles.map((a) => a.id) } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: o } = parseArgs({ options: { 'source-sha': { type: 'string' }, 'medium-missing': { type: 'string' }, write: { type: 'boolean', default: false }, force: { type: 'boolean', default: false } } });
  if (!o['source-sha']) throw new Error('--source-sha is required: record the commit the baseline was captured from');
  const capturedAt = new Date().toISOString();
  const articles = await loadArticles({ sourceRoot: root, eligibleAt: capturedAt });
  const linkedin = readJson(path.join(root, 'src/data/linkedin-posted.json'));
  const medium = readJson(path.join(root, 'src/data/medium-posted.json'));
  const missing = articles.filter((a) => !medium[a.id]).map((a) => a.id);
  if (missing.length && !o['medium-missing']) {
    console.error(`Live articles missing from the Medium ledger (${missing.length}):\n  ${missing.join('\n  ')}\nDecide explicitly: --medium-missing skip  or  --medium-missing id,id (approved backfill)`);
    process.exit(1);
  }
  const mm = !o['medium-missing'] || o['medium-missing'] === 'skip' ? 'skip' : o['medium-missing'].split(',').map((s) => s.trim()).filter(Boolean);
  const r = migrate({ linkedin, medium, articles, mediumMissing: mm, sourceSha: o['source-sha'], capturedAt });
  const count = (ad, st) => Object.values(r.state).filter((x) => x[ad]?.status === st).length;
  console.log(`Baseline: ${r.baseline.articles.length} live articles at ${capturedAt} from ${o['source-sha']}`);
  for (const ad of ['linkedin', 'medium']) console.log(`${ad}: published ${count(ad, 'published')}, draft ${count(ad, 'draft')}, skipped ${count(ad, 'skipped')}`);
  console.log(`Eligible after rollout:\n  linkedin: none (future articles only)\n  medium: ${r.eligible.medium.length ? r.eligible.medium.join(', ') : 'none (future articles only)'}`);
  for (const n of r.notes) console.log(`note: ${n}`);
  if (!o.write) console.log('\nDry run. Re-run with --write to create src/data/crosspost-state.json and review the diff.');
  else {
    const file = path.join(root, 'src/data/crosspost-state.json');
    if (existsSync(file) && !o.force) throw new Error(`${file} exists; use --force to replace`);
    await writeState(file, r.state);
    await writeFile(path.join(root, 'src/data/crosspost-baseline.json'), `${JSON.stringify(r.baseline, null, 2)}\n`);
    console.log(`Wrote ${path.relative(root, file)} and src/data/crosspost-baseline.json. Review it, then remove the old ledgers when callers are migrated.`);
  }
}
