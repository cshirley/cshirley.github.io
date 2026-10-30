// Shared cross-posting lifecycle: select -> prepare -> reserve -> execute. The runner owns state
// changes, policy, ordering and error isolation. Adapters only prepare payloads and make one
// creation attempt; they never touch the ledger, Git or overrides.
import {
  complete,
  consumedOnDay,
  dayOf,
  getRecord,
  markAttempted,
  newAttemptId,
  noteUncertain,
  release,
  reserve,
  unresolved,
} from './state.mjs';
import { checkLive } from './live.mjs';

export class RunnerError extends Error {}

/** Adapters throw this from publish(). kind: "not-created" only with positive evidence, else "uncertain". */
export class PublishError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

/**
 * Per-adapter selection. Oldest first, deterministic by id. options:
 *   destinations: names to run (default all); ids: explicit article ids (manual runs);
 *   overrideSkipped / bypassAllowance: manual only, need explicit ids; limits: { adapter: n }.
 */
export function planSelection({ articles, state, adapters, options = {}, now = new Date() }) {
  const { destinations, ids, overrideSkipped = false, bypassAllowance = false, limits = {} } = options;
  if ((overrideSkipped || bypassAllowance) && !ids?.length) throw new RunnerError('overrides need explicit article ids');
  const byId = new Map(articles.map((a) => [a.id, a]));
  for (const id of ids ?? []) if (!byId.has(id)) throw new RunnerError(`unknown or not-yet-deployed article: ${id}`);
  for (const d of destinations ?? []) if (!adapters[d]) throw new RunnerError(`unknown destination: ${d}`);
  const candidates = (ids?.length ? ids.map((id) => byId.get(id)) : articles).sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));
  const day = dayOf(now.toISOString());

  return Object.values(adapters)
    .filter((a) => !destinations?.length || destinations.includes(a.name))
    .map((adapter) => {
      const skipped = [];
      const queue = [];
      for (const article of candidates) {
        const rec = getRecord(state, article.id, adapter.name);
        if (!rec) queue.push(article);
        else if (rec.status === 'skipped' && overrideSkipped && ids?.length) queue.push(article);
        else skipped.push({ id: article.id, reason: rec.status });
      }
      const open = unresolved(state, adapter.name);
      let limit = limits[adapter.name] ?? adapter.policy.perRunLimit ?? Infinity;
      let allowanceNote;
      if (adapter.policy.dailyAllowance && !(bypassAllowance && ids?.length)) {
        const left = Math.max(0, adapter.policy.dailyAllowance - consumedOnDay(state, adapter.name, day));
        if (left < limit) allowanceNote = `daily allowance leaves ${left}`;
        limit = Math.min(limit, left);
      }
      const blocked = adapter.policy.blockOnReview && open.length ? `unresolved attempt(s): ${open.map((o) => `${o.id} (${o.attemptId})`).join(', ')}` : null;
      const selected = blocked ? [] : queue.slice(0, limit);
      return { adapter: adapter.name, queue: queue.map((a) => a.id), selected, blocked, allowanceNote, remaining: queue.length - selected.length, skipped, unresolved: open };
    });
}

/** Live check + adapter.prepare for each selection, sequentially. No external writes, no state. */
export async function prepareAll({ plans, adapters, ctx }) {
  const prepared = [];
  const errors = [];
  for (const plan of plans) {
    const adapter = adapters[plan.adapter];
    const missing = adapter.missingConfig?.(ctx.env) ?? [];
    for (const article of plan.selected) {
      try {
        if (missing.length) throw new Error(`missing configuration: ${missing.join(', ')}`);
        const live = await checkLive(article, { fetch: ctx.fetch });
        if (!live.ok) throw new Error(`live site check failed: ${live.reason}`);
        const payload = await adapter.prepare(article, { ...ctx, liveHtml: live.html });
        prepared.push({ adapter: plan.adapter, article, payload });
      } catch (err) {
        errors.push({ adapter: plan.adapter, id: article.id, message: err.message });
      }
    }
  }
  return { prepared, errors };
}

/** Write needs-review reservations for every prepared target. Returns new state and a manifest. */
export function reserveAll(state, prepared, { at, sourceSha, mode, provenance, overrideSkipped }) {
  let next = state;
  const attempts = [];
  for (const { adapter, article } of prepared) {
    const attemptId = newAttemptId();
    next = reserve(next, article.id, adapter, { attemptId, at, sourceSha, sourceUrl: article.url, mode: mode[adapter] ?? 'default', provenance, overrideSkipped });
    attempts.push({ id: article.id, adapter, attemptId });
  }
  return { state: next, attempts };
}

export class StateIOError extends Error {}

/**
 * Execute only this run's confirmed reservations, one creation attempt each. io.read()/io.write()
 * wrap the ledger; a write failure stops everything (continuing would widen the recovery gap).
 * Returns { results, stopped } where stopped is set when state I/O failed.
 */
export async function executeAll({ attempts, prepared, adapters, io, ctx, bypassAllowance = false }) {
  const results = [];
  const stoppedAdapters = new Set();
  const save = async (state) => {
    try {
      await io.write(state);
    } catch (err) {
      throw new StateIOError(`ledger write failed: ${err.message}`);
    }
  };
  try {
    for (const att of attempts) {
      const adapter = adapters[att.adapter];
      const target = prepared.find((p) => p.adapter === att.adapter && p.article.id === att.id);
      const base = { id: att.id, adapter: att.adapter, attemptId: att.attemptId };
      let state = await io.read();
      const rec = getRecord(state, att.id, att.adapter);
      if (!target || rec?.status !== 'needs-review' || rec.attemptId !== att.attemptId) {
        results.push({ ...base, outcome: 'skipped', message: 'reservation not owned by this run' });
        continue;
      }
      const releaseWith = async (message) => {
        await save(release(state, att.id, att.adapter, att.attemptId));
        results.push({ ...base, outcome: 'released', message });
      };
      if (stoppedAdapters.has(att.adapter)) {
        await releaseWith('earlier uncertain outcome stopped this destination; nothing was sent');
        continue;
      }
      if (adapter.policy.dailyAllowance && !bypassAllowance) {
        const today = dayOf(ctx.now().toISOString());
        if (dayOf(rec.reservedAt) !== today) {
          await releaseWith('UTC day changed since reservation; nothing was sent');
          continue;
        }
        if (consumedOnDay(state, att.adapter, today, { excludeAttempt: att.attemptId }) >= adapter.policy.dailyAllowance) {
          await releaseWith('daily allowance already used; nothing was sent');
          continue;
        }
      }
      const live = await checkLive(target.article, { fetch: ctx.fetch });
      if (!live.ok) {
        await releaseWith(`live site check failed before submission (${live.reason}); nothing was sent`);
        continue;
      }
      state = markAttempted(state, att.id, att.adapter, att.attemptId, ctx.now().toISOString());
      await save(state);
      try {
        const out = await adapter.publish(target.payload, { ...ctx, article: target.article });
        if (!['published', 'draft'].includes(out?.outcome)) throw new PublishError('uncertain', `unexpected result: ${JSON.stringify(out)}`);
        await save(complete(state, att.id, att.adapter, att.attemptId, { status: out.outcome, externalId: out.externalId, url: out.url, at: ctx.now().toISOString(), ...(out.extra ?? {}) }));
        results.push({ ...base, outcome: out.outcome, url: out.url, externalId: out.externalId });
      } catch (err) {
        if (err instanceof StateIOError) throw err;
        if (err instanceof PublishError && err.kind === 'not-created') {
          await save(release(state, att.id, att.adapter, att.attemptId));
          results.push({ ...base, outcome: 'not-created', message: err.message });
        } else {
          await save(noteUncertain(state, att.id, att.adapter, att.attemptId, err.message));
          stoppedAdapters.add(att.adapter);
          results.push({ ...base, outcome: 'uncertain', message: err.message });
        }
      }
    }
  } catch (err) {
    if (err instanceof StateIOError) return { results, stopped: err.message };
    throw err;
  }
  return { results, stopped: null };
}
