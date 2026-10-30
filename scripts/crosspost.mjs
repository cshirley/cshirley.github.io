#!/usr/bin/env node
/**
 * Cross-posting operations (Medium, LinkedIn). The only supported way to create external content.
 * Normal publishing is automatic from .github/workflows/pages.yml; this CLI is for operators.
 *
 *   npm run crosspost -- list      [common]   queue, allowance and blocks; no preparation, no writes
 *   npm run crosspost -- dry-run   [common]   also prepares payloads (read-only API calls, local export)
 *   npm run crosspost -- reserve   [common] --source-sha SHA --manifest FILE   write needs-review reservations
 *   npm run crosspost -- persist   --phase reserve|results --manifest FILE     commit, push and confirm the ledger
 *   npm run crosspost -- execute   --manifest FILE                  submit this run's confirmed reservations once each
 *   npm run crosspost -- reconcile --article ID --adapter NAME --attempt UUID --outcome published|draft|not-created
 *                                  --reason "evidence" [--external-id ID] [--url URL] [--push]
 *
 * common: --source-root DIR (deployed snapshot checkout; default this one)  --state FILE
 *         --eligible-at ISO (build time of that snapshot; default now)  --destination medium,linkedin
 *         --ids "id1 id2" --override-skipped --bypass-linkedin-allowance --limit medium=1
 *
 * Local publishing: start from clean, up-to-date master and a confirmed deployment SHA/time, never
 * while Actions is publishing. Run reserve, persist --phase reserve, execute, persist --phase results.
 * CROSSPOST_FORCE_DRY_RUN=1 turns reserve/execute/persist/reconcile into no-ops (rollout switch).
 */
import { appendFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ADAPTERS } from './lib/crosspost/adapters/index.mjs';
import { executePhase, loadJson, plan, problems, reservePhase, saveJson, summaryMarkdown } from './lib/crosspost/cli-core.mjs';
import { persist, PersistError, realGit } from './lib/crosspost/persist.mjs';
import { reconcile, readState, STATE_FILE, writeState } from './lib/crosspost/state.mjs';
import { root } from './lib/dist.mjs';

const [command, ...rest] = process.argv.slice(2);
const { values: o } = parseArgs({
  args: rest,
  options: {
    'source-root': { type: 'string' }, state: { type: 'string' }, 'source-sha': { type: 'string' }, 'eligible-at': { type: 'string' },
    destination: { type: 'string' }, ids: { type: 'string' }, limit: { type: 'string', multiple: true },
    'override-skipped': { type: 'boolean', default: false }, 'bypass-linkedin-allowance': { type: 'boolean', default: false },
    manifest: { type: 'string' }, phase: { type: 'string' }, 'work-dir': { type: 'string' }, 'run-url': { type: 'string' },
    article: { type: 'string' }, adapter: { type: 'string' }, attempt: { type: 'string' }, outcome: { type: 'string' },
    reason: { type: 'string' }, 'external-id': { type: 'string' }, url: { type: 'string' }, push: { type: 'boolean', default: false },
    remote: { type: 'string', default: 'origin' }, branch: { type: 'string', default: 'master' }, help: { type: 'boolean', short: 'h' },
  },
});

const fail = (msg) => { console.error(msg); process.exit(1); };
const list = (s) => (s ?? '').split(/[\s,]+/).filter(Boolean);
const forced = process.env.CROSSPOST_FORCE_DRY_RUN === '1' || process.env.CROSSPOST_FORCE_DRY_RUN === 'true';
const sourceRoot = path.resolve(o['source-root'] ?? root);
const stateFile = path.resolve(o.state ?? path.join(root, STATE_FILE));
const eligibleAt = o['eligible-at'] ?? new Date().toISOString();
const ctx = {
  env: process.env,
  fetch: globalThis.fetch,
  now: () => new Date(),
  workDir: path.resolve(o['work-dir'] ?? path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'crosspost')),
  sourceRoot,
  sourceSha: o['source-sha'],
};
const options = {
  destinations: list(o.destination).filter((d) => d !== 'both'),
  ids: list(o.ids),
  overrideSkipped: o['override-skipped'],
  bypassAllowance: o['bypass-linkedin-allowance'],
  limits: Object.fromEntries((o.limit ?? []).map((l) => l.split('=')).map(([k, v]) => [k, Number(v)])),
};
const summarise = (md) => {
  process.stdout.write(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
};
const need = (v, name) => v ?? fail(`missing ${name}`);
const provenance = () => (o['run-url'] ? { runUrl: o['run-url'] } : { local: os.userInfo().username });

try {
  if (!command || o.help || !['list', 'dry-run', 'reserve', 'persist', 'execute', 'reconcile'].includes(command)) {
    console.log('Usage: npm run crosspost -- list|dry-run|reserve|persist|execute|reconcile (see the header of scripts/crosspost.mjs)');
    process.exit(command && !o.help ? 1 : 0);
  }
  if (command === 'list' || command === 'dry-run') {
    const r = await plan({ sourceRoot, stateFile, eligibleAt, options, ctx, doPrepare: command === 'dry-run' });
    const manifest = { sourceSha: o['source-sha'], eligibleAt: new Date(eligibleAt).toISOString(), errors: r.errors, blocks: r.plans.filter((p) => p.blocked).map((p) => ({ adapter: p.adapter, message: p.blocked })), plans: r.plans.map(({ selected, ...p }) => ({ ...p, selected: selected.map((a) => a.id) })) };
    summarise(summaryMarkdown({ title: `Cross-posting ${command}`, manifest, dryRun: true }));
    process.exit(command === 'dry-run' && problems(manifest).length ? 1 : 0);
  }
  if (forced) {
    console.log(`CROSSPOST_FORCE_DRY_RUN is set: ${command} did nothing (no reservations, writes or pushes).`);
    process.exit(0);
  }
  if (command === 'reserve') {
    need(o['source-sha'], '--source-sha');
    need(o['eligible-at'], '--eligible-at');
    const { manifest } = await reservePhase({ sourceRoot, stateFile, eligibleAt, options, ctx, meta: { sourceSha: o['source-sha'], provenance: provenance() } });
    await saveJson(need(o.manifest, '--manifest'), manifest);
    summarise(summaryMarkdown({ title: 'Cross-posting reservations', manifest }));
    console.log(`Reserved ${manifest.attempts.length} attempt(s). Next: persist --phase reserve`);
  } else if (command === 'persist') {
    const manifest = await loadJson(need(o.manifest, '--manifest'));
    const git = realGit(root);
    const phase = need(o.phase, '--phase');
    if (!['reserve', 'results'].includes(phase)) fail('--phase must be reserve or results');
    const res = await persist({
      git, file: stateFile, attempts: manifest.attempts, readLocal: () => readState(stateFile), remote: o.remote, branch: o.branch,
      message: phase === 'reserve' ? '[CHORE] Reserve cross-posting attempts' : '[CHORE] Record cross-posting results',
      requireStatus: phase === 'reserve' ? 'needs-review' : undefined,
    });
    console.log(res.committed ? `Persisted ${phase} and confirmed it on ${o.remote}/${o.branch}.` : `Nothing to persist for ${phase}.`);
  } else if (command === 'execute') {
    const manifest = await loadJson(need(o.manifest, '--manifest'));
    const exec = await executePhase({ manifest, stateFile, ctx });
    await saveJson(o.manifest.replace(/\.json$/, '') + '.results.json', exec);
    summarise(summaryMarkdown({ title: 'Cross-posting results', manifest, exec }));
    const issues = problems(manifest, exec);
    for (const i of issues) console.error(`::error::${i}`);
    process.exit(issues.length ? 1 : 0);
  } else {
    const [id, adapter, attemptId] = [need(o.article, '--article'), need(o.adapter, '--adapter'), need(o.attempt, '--attempt')];
    if (!ADAPTERS[adapter]) fail(`unknown adapter ${adapter}`);
    const state = await readState(stateFile);
    const next = reconcile(state, id, adapter, attemptId, { outcome: need(o.outcome, '--outcome'), reason: o.reason, at: new Date().toISOString(), externalId: o['external-id'], url: o.url });
    await writeState(stateFile, next);
    const report = { id, adapter, attemptId, outcome: o.outcome, reason: o.reason, at: new Date().toISOString() };
    console.log(`Reconciled ${id}.${adapter}: ${JSON.stringify(report)}`);
    if (o.push) {
      await persist({ git: realGit(root), file: stateFile, attempts: [{ id, adapter, attemptId }], readLocal: () => readState(stateFile), remote: o.remote, branch: o.branch, message: '[CHORE] Reconcile cross-posting attempt' });
      console.log('Pushed and confirmed.');
    } else console.log('Local only. Review, commit and push before the next run.');
  }
} catch (err) {
  console.error(`${err instanceof PersistError ? 'persist failed: ' : ''}${err.message}`);
  process.exit(1);
}
