// Orchestration used by scripts/crosspost.mjs: plan -> prepare -> reserve -> execute, with
// state I/O and the clock injected so tests need no network, Git or real time.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ADAPTERS } from './adapters/index.mjs';
import { loadArticles } from './articles.mjs';
import { executeAll, planSelection, prepareAll, reserveAll, RunnerError } from './runner.mjs';
import { readState, writeState } from './state.mjs';

export const MODES = { medium: 'public', linkedin: 'link-post' };

export const stateIO = (file) => ({ read: () => readState(file), write: (s) => writeState(file, s) });

const reviveArticle = (a) => ({ ...a, date: new Date(a.date) });

/** Shared by dry-run and reserve: load articles, validate state, select and prepare. */
export async function plan({ sourceRoot, stateFile, eligibleAt, options, ctx, adapters = ADAPTERS, doPrepare = true }) {
  const articles = await loadArticles({ sourceRoot, eligibleAt });
  const state = await readState(stateFile);
  const plans = planSelection({ articles, state, adapters, options, now: ctx.now() });
  const { prepared, errors } = doPrepare ? await prepareAll({ plans, adapters, ctx }) : { prepared: [], errors: [] };
  return { articles, state, plans, prepared, errors };
}

/** Writes reservations to the local ledger and returns the manifest for the execute phase. */
export async function reservePhase({ sourceRoot, stateFile, eligibleAt, options, ctx, meta, adapters = ADAPTERS }) {
  const { state, plans, prepared, errors } = await plan({ sourceRoot, stateFile, eligibleAt, options, ctx, adapters });
  const blocks = plans.filter((p) => p.blocked).map((p) => ({ adapter: p.adapter, message: p.blocked }));
  let attempts = [];
  if (prepared.length) {
    const res = reserveAll(state, prepared, { at: ctx.now().toISOString(), sourceSha: meta.sourceSha, mode: MODES, provenance: meta.provenance, overrideSkipped: !!options.overrideSkipped });
    await writeState(stateFile, res.state);
    attempts = res.attempts;
  }
  return {
    manifest: { sourceSha: meta.sourceSha, eligibleAt: new Date(eligibleAt).toISOString(), reservedAt: ctx.now().toISOString(), options, attempts, errors, blocks, plans: plans.map(({ selected, ...p }) => ({ ...p, selected: selected.map((a) => a.id) })), prepared: prepared.map((p) => ({ adapter: p.adapter, article: p.article, payload: p.payload })) },
    plans,
  };
}

/** Executes only the attempts listed in the manifest, which persist has confirmed on remote. */
export async function executePhase({ manifest, stateFile, ctx, adapters = ADAPTERS }) {
  const prepared = manifest.prepared.map((p) => ({ ...p, article: reviveArticle(p.article) }));
  const { results, stopped } = await executeAll({ attempts: manifest.attempts, prepared, adapters, io: stateIO(stateFile), ctx, bypassAllowance: !!manifest.options?.bypassAllowance });
  return { results, stopped };
}

export const saveJson = async (file, data) => {
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
};
export const loadJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

/** Failures that should turn the run red. Expected skips (allowance, nothing eligible) do not. */
export function problems(manifest, exec) {
  const out = [];
  for (const e of manifest.errors ?? []) out.push(`${e.adapter} ${e.id}: preparation failed: ${e.message}`);
  for (const b of manifest.blocks ?? []) out.push(`${b.adapter}: blocked by ${b.message}`);
  for (const r of exec?.results ?? []) if (['uncertain', 'not-created'].includes(r.outcome)) out.push(`${r.adapter} ${r.id}: ${r.outcome}: ${r.message}`);
  if (exec?.stopped) out.push(`stopped: ${exec.stopped}`);
  return out;
}

export function summaryMarkdown({ title, manifest, exec, dryRun }) {
  const L = [`## ${title}${dryRun ? ' (dry run: no external writes, reservations or commits)' : ''}`, ''];
  L.push(`Deployed source: \`${manifest.sourceSha ?? 'unknown'}\`; eligibility time ${manifest.eligibleAt ?? 'n/a'}`, '');
  for (const p of manifest.plans ?? []) {
    L.push(`### ${p.adapter}`, `- queue: ${p.queue.length}; selected: ${p.selected.length ? p.selected.join(', ') : 'none'}; remaining: ${p.remaining}`);
    if (p.allowanceNote) L.push(`- ${p.allowanceNote}`);
    if (p.blocked) L.push(`- **BLOCKED**: ${p.blocked}`);
    L.push('');
  }
  for (const e of manifest.errors ?? []) L.push(`- ❌ ${e.adapter} ${e.id}: ${e.message}`);
  for (const r of exec?.results ?? []) L.push(`- ${r.outcome} ${r.adapter} ${r.id}${r.url ? ` ${r.url}` : ''}${r.message ? `: ${r.message}` : ''}`);
  if (exec?.stopped) L.push(`- ❌ ${exec.stopped}`);
  return `${L.join('\n')}\n`;
}

export { RunnerError };
