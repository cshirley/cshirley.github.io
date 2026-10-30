// Shared cross-posting ledger: article id -> adapter name -> record. Pure transitions plus
// fail-closed reading and atomic writing. Nothing here knows about any destination's API.
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const STATE_FILE = 'src/data/crosspost-state.json';
export const STATUSES = ['published', 'draft', 'skipped', 'needs-review'];
/** Adapters whose records are validated. Unknown adapters are preserved but not interpreted. */
export const KNOWN_ADAPTERS = ['medium', 'linkedin'];
const TIMESTAMPS = ['at', 'reservedAt', 'attemptedAt'];

export class StateError extends Error {}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const validTime = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

export function validateState(state) {
  if (!isObject(state)) throw new StateError('cross-post state must be a JSON object');
  for (const [id, adapters] of Object.entries(state)) {
    if (!isObject(adapters)) throw new StateError(`${id}: expected an object of adapter records`);
    for (const [name, rec] of Object.entries(adapters)) {
      if (!isObject(rec)) throw new StateError(`${id}.${name}: record must be an object`);
      if (!KNOWN_ADAPTERS.includes(name)) continue;
      const where = `${id}.${name}`;
      if (!STATUSES.includes(rec.status)) throw new StateError(`${where}: invalid status "${rec.status}"`);
      for (const k of TIMESTAMPS) {
        if (rec[k] !== undefined && !validTime(rec[k])) throw new StateError(`${where}: invalid ${k} timestamp`);
      }
      if (rec.status === 'skipped' && !(typeof rec.reason === 'string' && rec.reason.trim())) {
        throw new StateError(`${where}: a skipped record needs a reason`);
      }
      if (rec.status === 'needs-review' && !rec.attemptId) throw new StateError(`${where}: needs-review requires attemptId`);
    }
  }
  return state;
}

/** Read and validate. A missing, unreadable or malformed ledger is an error, never "empty". */
export async function readState(file) {
  if (!existsSync(file)) throw new StateError(`cross-post state not found: ${file}`);
  let parsed;
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    throw new StateError(`cross-post state unreadable (${file}): ${err.message}`);
  }
  return validateState(parsed);
}

const sorted = (state) =>
  Object.fromEntries(
    Object.keys(state)
      .sort()
      .map((id) => [id, Object.fromEntries(Object.keys(state[id]).sort().map((k) => [k, state[id][k]]))]),
  );

/** Atomic: write a temp file in the same directory, then rename over the ledger. */
export async function writeState(file, state) {
  validateState(state);
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  await writeFile(tmp, `${JSON.stringify(sorted(state), null, 2)}\n`);
  await rename(tmp, file);
}

export const getRecord = (state, id, adapter) => state[id]?.[adapter];
const clone = (v) => structuredClone(v);

function put(state, id, adapter, rec) {
  const next = clone(state);
  if (rec === undefined) {
    if (next[id]) {
      delete next[id][adapter];
      if (!Object.keys(next[id]).length) delete next[id];
    }
  } else {
    next[id] = { ...(next[id] ?? {}), [adapter]: rec };
  }
  return next;
}

export const newAttemptId = () => randomUUID();

/** Durable reservation: written (and pushed) before any external write. */
export function reserve(state, id, adapter, { attemptId, at, sourceSha, sourceUrl, mode, provenance, overrideSkipped = false }) {
  const prior = getRecord(state, id, adapter);
  if (prior && !(prior.status === 'skipped' && overrideSkipped)) {
    throw new StateError(`${id}.${adapter} already has a ${prior.status} record`);
  }
  const rec = { status: 'needs-review', attemptId, reservedAt: at, sourceSha, sourceUrl, mode, provenance };
  if (prior) rec.prior = prior;
  return put(state, id, adapter, rec);
}

function ownedAttempt(state, id, adapter, attemptId) {
  const rec = getRecord(state, id, adapter);
  if (!rec || rec.status !== 'needs-review' || rec.attemptId !== attemptId) {
    throw new StateError(`${id}.${adapter}: no unresolved attempt ${attemptId}`);
  }
  return rec;
}

export function markAttempted(state, id, adapter, attemptId, at) {
  return put(state, id, adapter, { ...ownedAttempt(state, id, adapter, attemptId), attemptedAt: at });
}

/** Confirmed result: status is "published" or "draft" as reported by the platform. */
export function complete(state, id, adapter, attemptId, { status, externalId, url, at, ...extra }) {
  if (!['published', 'draft'].includes(status)) throw new StateError(`cannot complete with status "${status}"`);
  const { prior: _prior, lastError: _lastError, ...rec } = ownedAttempt(state, id, adapter, attemptId);
  return put(state, id, adapter, {
    ...rec,
    ...extra,
    status,
    ...(externalId ? { externalId } : {}),
    ...(url ? { url } : {}),
    at,
  });
}

/** Keep the reservation (blocking retries) and note what went wrong. */
export function noteUncertain(state, id, adapter, attemptId, message) {
  return put(state, id, adapter, { ...ownedAttempt(state, id, adapter, attemptId), lastError: message });
}

/** Release an attempt known not to have created anything: restore the prior record, or none. */
export function release(state, id, adapter, attemptId) {
  const rec = ownedAttempt(state, id, adapter, attemptId);
  return put(state, id, adapter, rec.prior);
}

/** Operator reconciliation: record what was found, or release when non-creation is established. */
export function reconcile(state, id, adapter, attemptId, { outcome, reason, at, externalId, url }) {
  if (!reason?.trim()) throw new StateError('reconciliation requires a reason');
  if (outcome === 'not-created') return release(state, id, adapter, attemptId);
  if (!['published', 'draft'].includes(outcome)) throw new StateError(`unknown reconciliation outcome "${outcome}"`);
  return complete(state, id, adapter, attemptId, {
    status: outcome,
    externalId,
    url,
    at,
    reconciliation: { at, reason: reason.trim() },
  });
}

export const unresolved = (state, adapter) =>
  Object.entries(state).flatMap(([id, a]) => (a[adapter]?.status === 'needs-review' ? [{ id, ...a[adapter] }] : []));

export const dayOf = (iso) => new Date(iso).toISOString().slice(0, 10);

/** Creation allowance already used on a UTC day: confirmed results plus reservations that day. */
export function consumedOnDay(state, adapter, day, { excludeAttempt } = {}) {
  let n = 0;
  for (const a of Object.values(state)) {
    const rec = a[adapter];
    if (!rec || (excludeAttempt !== undefined && rec.attemptId === excludeAttempt)) continue;
    const when = rec.status === 'needs-review' ? rec.reservedAt : rec.status === 'skipped' ? null : rec.at;
    if (when && dayOf(when) === day) n++;
  }
  return n;
}
