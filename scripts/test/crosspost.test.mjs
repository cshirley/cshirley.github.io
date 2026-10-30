import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { linkedin } from '../lib/crosspost/adapters/linkedin.mjs';
import { medium } from '../lib/crosspost/adapters/medium.mjs';
import { loadArticles } from '../lib/crosspost/articles.mjs';
import { executePhase, plan, problems, reservePhase } from '../lib/crosspost/cli-core.mjs';
import { checkLive } from '../lib/crosspost/live.mjs';
import { cleanGitEnv, confirmed, persist, PersistError, realGit } from '../lib/crosspost/persist.mjs';
import { executeAll, planSelection, PublishError, reserveAll, RunnerError } from '../lib/crosspost/runner.mjs';
import * as S from '../lib/crosspost/state.mjs';
import { migrate } from '../crosspost-migrate.mjs';
import { post, tempRoot } from './helpers.mjs';

const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.shirleyconsulting.co.uk';
const NOW = new Date('2030-06-10T10:00:00Z');
const art = (id, date = '2030-01-01') => ({ id, url: `${SITE}/engineering/${date.replaceAll('-', '/')}/${id}.html`, title: id, description: 'd', date: new Date(date) });
const fakeAdapter = (name, { limit = 5, allowance = null, block = false, publish } = {}) => ({
  name,
  policy: { perRunLimit: limit, dailyAllowance: allowance, blockOnReview: block },
  missingConfig: () => [],
  prepare: async (a) => ({ name: a.id }),
  publish: publish ?? (async (p) => ({ outcome: 'published', externalId: `x-${p.name}`, url: `https://ext/${p.name}` })),
});
const liveFetch = (articles) => async (url) => {
  const a = articles.find((x) => x.url === url);
  if (!a) return new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } });
  const res = new Response(`<html><head><link rel="canonical" href="${a.url}"><meta property="og:title" content="${a.title}"></head></html>`, { status: 200, headers: { 'content-type': 'text/html' } });
  Object.defineProperty(res, 'url', { value: a.url });
  return res;
};
const memIO = (init = {}) => {
  const box = { state: init, writes: 0, failAfter: Infinity };
  return { box, read: async () => structuredClone(box.state), write: async (s) => { if (box.writes++ >= box.failAfter) throw new Error('disk full'); box.state = structuredClone(s); } };
};
const ctxFor = (articles, extra = {}) => ({ env: {}, fetch: liveFetch(articles), now: () => NOW, ...extra });
const reservedState = (state, prepared) => reserveAll(state, prepared, { at: NOW.toISOString(), sourceSha: 'abc', mode: {}, provenance: { local: 't' } });

// ---------- state ----------
test('state: fails closed on missing, malformed and invalid ledgers; preserves unknown adapters', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'st-'));
  await assert.rejects(S.readState(path.join(dir, 'none.json')), /not found/);
  writeFileSync(path.join(dir, 'bad.json'), '{oops');
  await assert.rejects(S.readState(path.join(dir, 'bad.json')), /unreadable/);
  assert.throws(() => S.validateState({ a: { medium: { status: 'weird' } } }), /invalid status/);
  assert.throws(() => S.validateState({ a: { linkedin: { status: 'skipped' } } }), /needs a reason/);
  assert.throws(() => S.validateState({ a: { linkedin: { status: 'published', at: 'yesterday' } } }), /invalid at/);
  const f = path.join(dir, 'ok.json');
  await S.writeState(f, { a: { future: { status: 'whatever', extra: 1 }, medium: { status: 'draft' } } });
  assert.equal((await S.readState(f)).a.future.extra, 1);
});

test('state: reservation, completion, release and reconciliation transitions', () => {
  let s = { a: { linkedin: { status: 'skipped', reason: 'old' } } };
  assert.throws(() => S.reserve(s, 'a', 'linkedin', { attemptId: 'u1', at: NOW.toISOString() }), /already has/);
  s = S.reserve(s, 'a', 'linkedin', { attemptId: 'u1', at: NOW.toISOString(), overrideSkipped: true });
  assert.equal(S.getRecord(s, 'a', 'linkedin').status, 'needs-review');
  assert.deepEqual(S.release(s, 'a', 'linkedin', 'u1').a.linkedin, { status: 'skipped', reason: 'old' });
  assert.throws(() => S.release(s, 'a', 'linkedin', 'other'), /no unresolved attempt/);
  const done = S.complete(s, 'a', 'linkedin', 'u1', { status: 'published', externalId: 'urn', at: NOW.toISOString() });
  assert.equal(done.a.linkedin.attemptId, 'u1');
  assert.equal(done.a.linkedin.prior, undefined);
  assert.throws(() => S.reconcile(s, 'a', 'linkedin', 'u1', { outcome: 'published', reason: ' ' }), /reason/);
  assert.equal(S.reconcile(s, 'a', 'linkedin', 'u1', { outcome: 'draft', reason: 'seen on Medium', at: NOW.toISOString() }).a.linkedin.status, 'draft');
  assert.equal(S.release(S.reserve({}, 'b', 'medium', { attemptId: 'u2', at: NOW.toISOString() }), 'b', 'medium', 'u2').b, undefined);
});

// ---------- selection ----------
test('selection: oldest first, deterministic ties, per-run limit, recorded states skipped', () => {
  const articles = [art('b', '2030-01-02'), art('a2', '2030-01-01'), art('a1', '2030-01-01'), art('c', '2030-01-03')];
  const state = { c: { fake: { status: 'draft' } } };
  const [p] = planSelection({ articles, state, adapters: { fake: fakeAdapter('fake', { limit: 2 }) }, now: NOW });
  assert.deepEqual(p.selected.map((a) => a.id), ['a1', 'a2']);
  assert.equal(p.remaining, 1);
  assert.deepEqual(p.skipped, [{ id: 'c', reason: 'draft' }]);
  for (const st of ['published', 'draft', 'skipped', 'needs-review']) {
    const [q] = planSelection({ articles: [art('a1')], state: { a1: { fake: { status: st, reason: 'r', attemptId: 'u' } } }, adapters: { fake: fakeAdapter('fake') }, now: NOW });
    assert.equal(q.selected.length, 0, st);
  }
});

test('selection: overrides need explicit ids; unknown ids and destinations fail; override only skipped', () => {
  const articles = [art('a'), art('b')];
  const adapters = { fake: fakeAdapter('fake') };
  const state = { a: { fake: { status: 'skipped', reason: 'old' } }, b: { fake: { status: 'published' } } };
  assert.throws(() => planSelection({ articles, state, adapters, options: { overrideSkipped: true }, now: NOW }), RunnerError);
  assert.throws(() => planSelection({ articles, state, adapters, options: { ids: ['zzz'] }, now: NOW }), /unknown/);
  assert.throws(() => planSelection({ articles, state, adapters, options: { destinations: ['nope'] }, now: NOW }), /unknown destination/);
  const [p] = planSelection({ articles, state, adapters, options: { ids: ['a', 'b'], overrideSkipped: true }, now: NOW });
  assert.deepEqual(p.selected.map((a) => a.id), ['a']);
});

test('LinkedIn allowance: manual success consumes it; unresolved attempts block later days', () => {
  const adapters = { li: fakeAdapter('li', { limit: 1, allowance: 1, block: true }) };
  const articles = [art('a'), art('b')];
  const today = { a: { li: { status: 'published', at: '2030-06-10T01:00:00Z' } } };
  const [p1] = planSelection({ articles, state: today, adapters, now: NOW });
  assert.equal(p1.selected.length, 0);
  const [p2] = planSelection({ articles, state: { a: { li: { status: 'published', at: '2030-06-09T23:59:00Z' } } }, adapters, now: NOW });
  assert.deepEqual(p2.selected.map((a) => a.id), ['b']);
  const old = { a: { li: { status: 'needs-review', attemptId: 'u', reservedAt: '2030-05-01T00:00:00Z' } } };
  const [p3] = planSelection({ articles, state: old, adapters, now: NOW });
  assert.match(p3.blocked, /unresolved/);
  assert.equal(p3.selected.length, 0);
  const [p4] = planSelection({ articles, state: {}, adapters, options: { ids: ['a'], bypassAllowance: true }, now: NOW });
  assert.equal(p4.selected.length, 1);
  const [p5] = planSelection({ articles, state: today, adapters, options: { ids: ['b'], bypassAllowance: true }, now: NOW });
  assert.equal(p5.selected.length, 1);
  const [p6] = planSelection({ articles, state: old, adapters, options: { ids: ['b'], bypassAllowance: true }, now: NOW });
  assert.equal(p6.selected.length, 0, 'bypass cannot skip unresolved attempts');
});

// ---------- execution ----------
const runOne = async ({ adapter, state = {}, ctx, articles = [art('a')], io } = {}) => {
  const adapters = { fake: adapter ?? fakeAdapter('fake') };
  const c = ctx ?? ctxFor(articles);
  const plans = planSelection({ articles, state, adapters, now: NOW });
  const prepared = plans[0].selected.map((article) => ({ adapter: 'fake', article, payload: { name: article.id } }));
  const res = reservedState(state, prepared);
  const store = io ?? memIO(res.state);
  if (io) await io.write(res.state);
  const exec = await executeAll({ attempts: res.attempts, prepared, adapters, io: store, ctx: c });
  return { exec, store, res };
};

test('execute: success is saved; a fake adapter needs no destination-specific runner code', async () => {
  const { exec, store } = await runOne();
  assert.equal(exec.results[0].outcome, 'published');
  assert.equal(store.box.state.a.fake.status, 'published');
  assert.equal(store.box.state.a.fake.externalId, 'x-a');
  assert.ok(store.box.state.a.fake.attemptedAt);
});

test('execute: not-created restores prior state; uncertain keeps the review block and stops that destination', async () => {
  const notCreated = fakeAdapter('fake', { publish: async () => { throw new PublishError('not-created', 'HTTP 400'); } });
  const r1 = await runOne({ adapter: notCreated });
  assert.equal(r1.exec.results[0].outcome, 'not-created');
  assert.equal(r1.store.box.state.a, undefined);
  const uncertain = fakeAdapter('fake', { publish: async () => { throw new Error('socket hang up'); } });
  const articles = [art('a', '2030-01-01'), art('b', '2030-01-02')];
  const r2 = await runOne({ adapter: uncertain, articles });
  assert.equal(r2.exec.results[0].outcome, 'uncertain');
  assert.equal(r2.store.box.state.a.fake.status, 'needs-review');
  assert.match(r2.store.box.state.a.fake.lastError, /socket/);
  assert.match(r2.exec.results[1].outcome, /released/);
  assert.equal(r2.store.box.state.b, undefined, 'later article never sent and released');
  assert.ok(problems({}, r2.exec).length);
});

test('execute: unexpected success payload is uncertain, not assumed published', async () => {
  const odd = fakeAdapter('fake', { publish: async () => ({ outcome: 'public?' }) });
  const r = await runOne({ adapter: odd });
  assert.equal(r.exec.results[0].outcome, 'uncertain');
  assert.equal(r.store.box.state.a.fake.status, 'needs-review');
});

test('execute: a failing adapter does not stop another; ledger write failure stops all external writes', async () => {
  const articles = [art('a')];
  const adapters = { bad: fakeAdapter('bad', { publish: async () => { throw new PublishError('not-created', 'no'); } }), good: fakeAdapter('good') };
  const plans = planSelection({ articles, state: {}, adapters, now: NOW });
  const prepared = plans.flatMap((p) => p.selected.map((article) => ({ adapter: p.adapter, article, payload: { name: article.id } })));
  const res = reservedState({}, prepared);
  const io = memIO(res.state);
  const exec = await executeAll({ attempts: res.attempts, prepared, adapters, io, ctx: ctxFor(articles) });
  assert.deepEqual(exec.results.map((r) => r.outcome), ['not-created', 'published']);

  let sends = 0;
  const counting = { a1: { ...fakeAdapter('a1'), publish: async () => { sends++; return { outcome: 'published', externalId: '1', url: 'u' }; } } };
  const prep2 = [art('a'), art('b')].map((article) => ({ adapter: 'a1', article, payload: {} }));
  const res2 = reservedState({}, prep2);
  const io2 = memIO(res2.state);
  io2.box.failAfter = 1; // markAttempted ok, result write fails
  const out = await executeAll({ attempts: res2.attempts, prepared: prep2, adapters: counting, io: io2, ctx: ctxFor([art('a'), art('b')]) });
  assert.match(out.stopped, /ledger write failed/);
  assert.equal(sends, 1);
  assert.equal(io2.box.state.a.a1.status, 'needs-review', 'remote success but unsaved result stays blocked');
});

test('execute: never runs another run’s reservation; stale UTC day and used allowance send nothing', async () => {
  const articles = [art('a')];
  const adapters = { li: fakeAdapter('li', { allowance: 1, block: true }) };
  const prepared = [{ adapter: 'li', article: articles[0], payload: {} }];
  const otherRun = { a: { li: { status: 'needs-review', attemptId: 'someone-else', reservedAt: NOW.toISOString() } } };
  const io = memIO(otherRun);
  let r = await executeAll({ attempts: [{ id: 'a', adapter: 'li', attemptId: 'mine' }], prepared, adapters, io, ctx: ctxFor(articles) });
  assert.equal(r.results[0].outcome, 'skipped');
  const stale = reservedState({}, prepared);
  const rec = stale.state.a.li;
  rec.reservedAt = '2030-06-09T23:59:59Z';
  const io2 = memIO(stale.state);
  r = await executeAll({ attempts: stale.attempts, prepared, adapters, io: io2, ctx: ctxFor(articles) });
  assert.equal(r.results[0].outcome, 'released');
  assert.equal(io2.box.state.a, undefined);
  const used = reservedState({ z: { li: { status: 'published', at: NOW.toISOString() } } }, prepared);
  const io3 = memIO(used.state);
  r = await executeAll({ attempts: used.attempts, prepared, adapters, io: io3, ctx: ctxFor(articles) });
  assert.match(r.results[0].message, /allowance/);
});

test('execute: live revalidation failure sends nothing and releases', async () => {
  const articles = [art('a')];
  const r = await runOne({ ctx: ctxFor([]), articles });
  assert.equal(r.exec.results[0].outcome, 'released');
  assert.equal(r.store.box.state.a, undefined);
});

// ---------- live check ----------
test('live: error pages, wrong canonical, wrong type and unrelated redirects fail', async () => {
  const a = art('a');
  const mk = (body, init, url) => async () => { const r = new Response(body, init); Object.defineProperty(r, 'url', { value: url ?? a.url }); return r; };
  const html = { 'content-type': 'text/html' };
  assert.equal((await checkLive(a, { fetch: mk(`<link rel="canonical" href="${a.url}">`, { status: 200, headers: html }) })).ok, true);
  assert.equal((await checkLive(a, { fetch: mk('x', { status: 404, headers: html }) })).ok, false);
  assert.equal((await checkLive(a, { fetch: mk('{}', { status: 200, headers: { 'content-type': 'application/json' } }) })).ok, false);
  assert.equal((await checkLive(a, { fetch: mk('<link rel="canonical" href="https://x/other.html">', { status: 200, headers: html }) })).ok, false);
  assert.equal((await checkLive(a, { fetch: mk('<p>hi</p>', { status: 200, headers: html }) })).ok, false);
  assert.equal((await checkLive(a, { fetch: mk(`<link rel="canonical" href="${a.url}">`, { status: 200, headers: html }, 'https://x/other.html') })).ok, false);
  assert.equal((await checkLive(a, { fetch: async () => { throw new Error('boom'); } })).ok, false);
});

// ---------- articles / snapshot ----------
test('articles: only deployed, approved, due posts; newer trunk content never leaks into a snapshot', async () => {
  const snap = tempRoot();
  post(snap, '2030-01-02-live', { fm: { draft: false, date: '2030-01-02 09:00:00 +0000' } });
  const trunk = tempRoot();
  post(trunk, '2030-01-02-live', { fm: { draft: false, date: '2030-01-02 09:00:00 +0000', title: 'Changed on trunk' } });
  post(trunk, '2030-01-03-new', { fm: { draft: false, date: '2030-01-03 09:00:00 +0000' } });
  writeFileSync(path.join(snap, 'src/data/approval-baseline.json'), JSON.stringify(['2030-01-02-live']));
  writeFileSync(path.join(trunk, 'src/data/approval-baseline.json'), JSON.stringify(['2030-01-02-live', '2030-01-03-new']));
  post(snap, '2030-01-09-later', { fm: { draft: false, date: '2030-01-09 09:00:00 +0000' } });
  post(snap, '2030-01-10-draft', { fm: { draft: true } });
  post(snap, '2030-01-11-unpublished', { fm: { draft: false, published: false, date: '2030-01-11 09:00:00 +0000' } });
  post(snap, '2030-01-12-unapproved', { fm: { draft: false, date: '2030-01-12 09:00:00 +0000' } });
  writeFileSync(path.join(snap, 'src/data/approval-baseline.json'), JSON.stringify(['2030-01-02-live', '2030-01-09-later', '2030-01-10-draft', '2030-01-11-unpublished']));
  const built = await loadArticles({ sourceRoot: snap, eligibleAt: '2030-01-05T00:00:00Z' });
  assert.deepEqual(built.map((a) => a.id), ['2030-01-02-live']);
  assert.equal(built[0].title, 'Title 2030-01-02-live');
  const later = await loadArticles({ sourceRoot: snap, eligibleAt: '2030-01-09T10:00:00Z' });
  assert.deepEqual(later.map((a) => a.id), ['2030-01-02-live', '2030-01-09-later']);
  await assert.rejects(loadArticles({ sourceRoot: snap, eligibleAt: 'nonsense' }), /invalid eligibility/);
});

// ---------- adapters ----------
test('linkedin adapter: classifies responses; no secrets in prepared payload', async () => {
  const prepared = await linkedin.prepare(art('a'), { liveHtml: '<meta property="og:title" content="T &amp; U"><meta property="og:description" content="D">' });
  assert.equal(prepared.title, 'T & U');
  assert.equal(JSON.stringify(prepared).includes('Bearer'), false);
  const ctx = (res) => ({ env: { LINKEDIN_ACCESS_TOKEN: 'tok', LINKEDIN_AUTHOR: 'urn:li:person:1' }, fetch: typeof res === 'function' ? res : async () => res });
  const ok = await linkedin.publish(prepared, ctx(new Response('', { status: 201, headers: { 'x-restli-id': 'urn:li:share:1' } })));
  assert.equal(ok.externalId, 'urn:li:share:1');
  await assert.rejects(linkedin.publish(prepared, ctx(new Response('', { status: 201 }))), (e) => e.kind === 'uncertain');
  await assert.rejects(linkedin.publish(prepared, ctx(new Response('bad', { status: 422 }))), (e) => e.kind === 'not-created');
  await assert.rejects(linkedin.publish(prepared, ctx(new Response('', { status: 500 }))), (e) => e.kind === 'uncertain');
  await assert.rejects(linkedin.publish(prepared, ctx(async () => { throw new Error('timeout'); })), (e) => e.kind === 'uncertain');
  assert.deepEqual(linkedin.missingConfig({}), ['LINKEDIN_ACCESS_TOKEN', 'LINKEDIN_AUTHOR']);
});

test('medium adapter: records the returned status; failures are classified', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'med-'));
  const a = art('a');
  const exportArticle = (article, { outDir }) => {
    mkdirSync(path.join(outDir, article.id), { recursive: true });
    writeFileSync(path.join(outDir, article.id, 'index.html'), `<html><head><title>T</title><link rel="canonical" href="${a.url}"><meta name="medium-tags" content="x, y"></head><body><article><h1>T</h1></article></body></html>`);
  };
  const prepared = await medium.prepare(a, { workDir: dir, sourceRoot: dir, sourceSha: 's', env: {}, exportArticle });
  assert.equal(prepared.publishStatus, 'public');
  assert.deepEqual(prepared.tags, ['x', 'y']);
  const api = (story) => async (_url, init) => {
    if (init.method === 'GET') return Response.json({ data: { id: 'u1' } });
    return story();
  };
  const ctx = (story) => ({ env: { MEDIUM_TOKEN: 't' }, fetch: api(story) });
  const pub = await medium.publish(prepared, ctx(() => Response.json({ data: { id: 'p1', url: 'https://m/p1', publishStatus: 'public' } }, { status: 201 })));
  assert.equal(pub.outcome, 'published');
  const dr = await medium.publish(prepared, ctx(() => Response.json({ data: { id: 'p1', url: 'https://m/p1', publishStatus: 'draft' } }, { status: 201 })));
  assert.equal(dr.outcome, 'draft');
  await assert.rejects(medium.publish(prepared, ctx(() => Response.json({ data: { id: 'p1' } }, { status: 201 }))), (e) => e.kind === 'uncertain');
  await assert.rejects(medium.publish(prepared, ctx(() => Response.json({ errors: [] }, { status: 400 }))), (e) => e.kind === 'not-created');
  await assert.rejects(medium.publish(prepared, ctx(() => Response.json({}, { status: 503 }))), (e) => e.kind === 'uncertain');
  await assert.rejects(medium.publish(prepared, { env: { MEDIUM_TOKEN: 't' }, fetch: async () => Response.json({}, { status: 401 }) }), (e) => e.kind === 'not-created');
  await assert.rejects(medium.prepare(art('b'), { workDir: dir, sourceRoot: dir, env: {}, exportArticle: () => {} }), /no index.html/);
});

// ---------- migration ----------
test('migration: preserves ids/status, baselines history, needs an explicit Medium decision', () => {
  const articles = [art('old'), art('shared'), art('unmedium')];
  const r = migrate({
    linkedin: { shared: { shareUrn: 'urn:li:share:9', url: 'u', at: '2026-10-07T08:32:08Z', source: { kind: 'github-actions', runId: 1 } } },
    medium: { old: { mediumId: 'm1', url: 'https://medium.com/p/m1', status: 'draft', publication: 'Pub', at: '2026-10-01T13:11:27.843Z' }, shared: { mediumId: 'm2', url: 'u2', status: 'public' } },
    articles, mediumMissing: 'skip', sourceSha: 'abc', capturedAt: NOW.toISOString(),
  });
  assert.equal(r.state.shared.linkedin.externalId, 'urn:li:share:9');
  assert.equal(r.state.shared.linkedin.at, '2026-10-07T08:32:08Z');
  assert.equal(r.state.shared.medium.status, 'published');
  assert.equal(r.state.old.medium.status, 'draft');
  assert.equal(r.state.old.medium.publication, 'Pub');
  assert.equal(r.state.old.linkedin.status, 'skipped');
  assert.equal(r.state.unmedium.medium.status, 'skipped');
  assert.deepEqual(r.baseline.articles, ['old', 'shared', 'unmedium']);
  const bf = migrate({ linkedin: {}, medium: {}, articles: [art('x')], mediumMissing: ['x'], sourceSha: 's', capturedAt: NOW.toISOString() });
  assert.equal(bf.state.x.medium, undefined, 'approved backfill stays eligible');
  assert.throws(() => migrate({ linkedin: {}, medium: {}, articles: [], mediumMissing: ['nope'], sourceSha: 's', capturedAt: NOW.toISOString() }), /not a live article/);
  assert.throws(() => migrate({ linkedin: {}, medium: { a: { mediumId: '1', status: 'weird' } }, articles: [], mediumMissing: 'skip', sourceSha: 's', capturedAt: NOW.toISOString() }), /unsupported status/);
  const [sel] = planSelection({ articles: [...articles, art('future')], state: r.state, adapters: { medium: fakeAdapter('medium'), linkedin: fakeAdapter('linkedin') }, now: NOW }).filter((p) => p.adapter === 'linkedin');
  assert.deepEqual(sel.selected.map((a) => a.id), ['future'], 'only the new article becomes eligible');
});

test('new adapter keys need their own baseline: unknown adapter state is preserved', async () => {
  const s = migrate({ linkedin: {}, medium: {}, articles: [art('x')], mediumMissing: ['x'], sourceSha: 's', capturedAt: NOW.toISOString() }).state;
  const [p] = planSelection({ articles: [art('x')], state: s, adapters: { newdest: fakeAdapter('newdest') }, now: NOW });
  assert.equal(p.selected.length, 1, 'missing state alone is eligible, so enabling needs a reviewed baseline first');
});

// ---------- end to end with persistence ----------
function gitRepo() {
  const base = mkdtempSync(path.join(os.tmpdir(), 'git-'));
  // Never inherit GIT_DIR/GIT_INDEX_FILE (set inside the pre-commit hook): that once made these
  // tests commit and push to the real repository.
  const g = (cwd, ...a) => {
    assert.ok(path.resolve(cwd).startsWith(os.tmpdir()) || path.resolve(cwd).startsWith(realpathSync(os.tmpdir())), `test git must run in a temp directory, not ${cwd}`);
    return execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: cleanGitEnv() });
  };
  g(base, 'init', '--bare', '-b', 'master', 'remote.git');
  g(base, 'clone', 'remote.git', 'work');
  const work = path.join(base, 'work');
  g(work, 'config', 'user.email', 't@t'); g(work, 'config', 'user.name', 't');
  mkdirSync(path.join(work, 'src/data'), { recursive: true });
  return { base, work, g, file: path.join(work, 'src/data/crosspost-state.json') };
}

test('persist: reservation confirmed on remote before execute; conflict and failed push fail closed', async () => {
  const { base, work, g, file } = gitRepo();
  await S.writeState(file, {});
  g(work, 'add', '.'); g(work, 'commit', '-m', 'init'); g(work, 'push', 'origin', 'master');
  const reserved = S.reserve({}, 'a', 'medium', { attemptId: 'u1', at: NOW.toISOString() });
  await S.writeState(file, reserved);
  const attempts = [{ id: 'a', adapter: 'medium', attemptId: 'u1' }];
  const common = { git: realGit(work), file, attempts, readLocal: () => S.readState(file) };
  const r = await persist({ ...common, message: '[CHORE] Reserve', requireStatus: 'needs-review' });
  assert.deepEqual(r, { committed: true, pushed: true });
  assert.match(g(work, 'log', '-1', '--format=%s'), /Reserve/);
  assert.equal(JSON.parse(g(base + '/remote.git', 'show', 'master:src/data/crosspost-state.json')).a.medium.attemptId, 'u1');
  assert.equal(g(work, 'show', '--stat', '--format=', 'HEAD').includes('crosspost-state.json'), true);

  // Result commit survives a concurrent unrelated state change on remote (rebase)...
  const other = path.join(base, 'other');
  g(base, 'clone', 'remote.git', 'other'); g(other, 'config', 'user.email', 't@t'); g(other, 'config', 'user.name', 't');
  const ofile = path.join(other, 'src/data/crosspost-state.json');
  await S.writeState(ofile, { ...reserved, z: { medium: { status: 'draft' } } });
  g(other, 'commit', '-am', 'other'); g(other, 'push', 'origin', 'master');
  await S.writeState(file, S.complete(reserved, 'a', 'medium', 'u1', { status: 'published', externalId: 'e', at: NOW.toISOString() }));
  await persist({ ...common, message: '[CHORE] Results' });
  const remote = JSON.parse(g(base + '/remote.git', 'show', 'master:src/data/crosspost-state.json'));
  assert.equal(remote.a.medium.status, 'published');
  assert.equal(remote.z.medium.status, 'draft');

  // ...but a conflicting edit of the same record fails and never overwrites remote.
  g(other, 'pull', '--rebase', 'origin', 'master');
  await S.writeState(ofile, { ...remote, a: { medium: { ...remote.a.medium, externalId: 'remote-edit' } } });
  g(other, 'commit', '-am', 'edit'); g(other, 'push', 'origin', 'master');
  await S.writeState(file, { ...remote, a: { medium: { ...remote.a.medium, externalId: 'local-edit' } } });
  await assert.rejects(persist({ ...common, message: '[CHORE] Clash' }), PersistError);
  assert.equal(JSON.parse(g(base + '/remote.git', 'show', 'master:src/data/crosspost-state.json')).a.medium.externalId, 'remote-edit');
});

test('persist: uncertain push is checked against the remote; unreachable remote fails closed', async () => {
  const { work, g, file } = gitRepo();
  await S.writeState(file, {});
  g(work, 'add', '.'); g(work, 'commit', '-m', 'init'); g(work, 'push', 'origin', 'master');
  await S.writeState(file, S.reserve({}, 'a', 'medium', { attemptId: 'u1', at: NOW.toISOString() }));
  const attempts = [{ id: 'a', adapter: 'medium', attemptId: 'u1' }];
  const real = realGit(work);
  // Push "fails" after actually succeeding (lost response): confirmed by inspecting the remote.
  let pushed = false;
  const lossy = (...a) => { const out = real(...a); if (a[0] === 'push' && !pushed) { pushed = true; throw new Error('connection reset'); } return out; };
  const r = await persist({ git: lossy, file, attempts, readLocal: () => S.readState(file), message: '[CHORE] R', requireStatus: 'needs-review' });
  assert.equal(r.pushed, true);
  // Unreachable remote: never confirms.
  await S.writeState(file, S.complete(await S.readState(file), 'a', 'medium', 'u1', { status: 'published', at: NOW.toISOString() }));
  const dead = (...a) => { if (['push', 'fetch'].includes(a[0])) throw new Error('unreachable'); return real(...a); };
  await assert.rejects(persist({ git: dead, file, attempts, readLocal: () => S.readState(file), message: '[CHORE] X', retries: 2 }), PersistError);
  assert.equal(confirmed({ a: { m: { status: 'x' } } }, { a: { m: { status: 'y' } } }, [{ id: 'a', adapter: 'm' }]), false);
});

test('persist: an unreachable remote is reported as such, and a retry pushes the stranded commit', async () => {
  const { work, g, file } = gitRepo();
  await S.writeState(file, {});
  g(work, 'add', '.'); g(work, 'commit', '-m', 'init'); g(work, 'push', 'origin', 'master');
  await S.writeState(file, S.reserve({}, 'a', 'medium', { attemptId: 'u1', at: NOW.toISOString() }));
  const attempts = [{ id: 'a', adapter: 'medium', attemptId: 'u1' }];
  const real = realGit(work);
  const down = (...a) => { if (['push', 'fetch'].includes(a[0])) throw Object.assign(new Error('x'), { stderr: 'fatal: unable to access remote\n' }); return real(...a); };
  const common = { file, attempts, readLocal: () => S.readState(file), message: '[CHORE] R', requireStatus: 'needs-review' };
  await assert.rejects(persist({ ...common, git: down }), (e) => e instanceof PersistError && /unreachable/.test(e.message) && !/conflict/.test(e.message));
  assert.match(g(work, 'log', '-1', '--format=%s'), /\[CHORE\] R/, 'commit exists locally but is not on the remote');
  const r = await persist({ ...common, git: real });
  assert.equal(r.pushed, true, 'retry pushes the commit left behind');
  assert.equal(confirmed(await S.readState(file), JSON.parse(g(work, 'show', 'origin/master:src/data/crosspost-state.json')), attempts, { requireStatus: 'needs-review' }), true);
  const again = await persist({ ...common, git: real });
  assert.deepEqual(again, { committed: false, pushed: false }, 'nothing left to do once confirmed');
});

test('lifecycle: reserve then execute through the CLI core; dry-run writes nothing; rerun does not recreate', async () => {
  const sourceRoot = tempRoot();
  post(sourceRoot, '2030-01-02-a-post', { fm: { draft: false, date: '2030-01-02 09:00:00 +0000' } });
  writeFileSync(path.join(sourceRoot, 'src/data/approval-baseline.json'), JSON.stringify(['2030-01-02-a-post']));
  const stateFile = path.join(sourceRoot, 'src/data/crosspost-state.json');
  await S.writeState(stateFile, {});
  const [article] = await loadArticles({ sourceRoot, eligibleAt: '2030-02-01T00:00:00Z' });
  let created = 0;
  const adapters = { fake: { ...fakeAdapter('fake'), publish: async () => { created++; return { outcome: 'published', externalId: 'e1', url: 'https://e/1' }; } } };
  const ctx = { ...ctxFor([article]), sourceRoot };
  const args = { sourceRoot, stateFile, eligibleAt: '2030-02-01T00:00:00Z', options: {}, ctx, adapters };
  const before = readFileSync(stateFile, 'utf8');
  const dry = await plan(args);
  assert.equal(dry.prepared.length, 1);
  assert.equal(readFileSync(stateFile, 'utf8'), before, 'dry run leaves the ledger alone');
  const { manifest } = await reservePhase({ ...args, meta: { sourceSha: 'abc', provenance: { local: 't' } } });
  assert.equal(manifest.attempts.length, 1);
  assert.equal(JSON.parse(readFileSync(stateFile, 'utf8'))[article.id].fake.status, 'needs-review');
  assert.equal(created, 0, 'no creation before execute');
  const exec = await executePhase({ manifest: JSON.parse(JSON.stringify(manifest)), stateFile, ctx, adapters });
  assert.equal(exec.results[0].outcome, 'published');
  assert.equal(created, 1);
  const again = await reservePhase({ ...args, meta: { sourceSha: 'abc', provenance: {} } });
  assert.equal(again.manifest.attempts.length, 0);
  assert.equal(created, 1);
});

test('lifecycle: missing credentials and a failing adapter are isolated', async () => {
  const sourceRoot = tempRoot();
  post(sourceRoot, '2030-01-02-a-post', { fm: { draft: false, date: '2030-01-02 09:00:00 +0000' } });
  writeFileSync(path.join(sourceRoot, 'src/data/approval-baseline.json'), JSON.stringify(['2030-01-02-a-post']));
  const stateFile = path.join(sourceRoot, 'src/data/crosspost-state.json');
  await S.writeState(stateFile, {});
  const [article] = await loadArticles({ sourceRoot, eligibleAt: '2030-02-01T00:00:00Z' });
  const nocreds = { ...fakeAdapter('nocreds'), missingConfig: () => ['TOKEN'] };
  const adapters = { nocreds, fake: fakeAdapter('fake') };
  const { manifest } = await reservePhase({ sourceRoot, stateFile, eligibleAt: '2030-02-01T00:00:00Z', options: {}, ctx: { ...ctxFor([article]), sourceRoot }, meta: { sourceSha: 's', provenance: {} }, adapters });
  assert.equal(manifest.attempts.length, 1);
  assert.match(manifest.errors[0].message, /missing configuration/);
  assert.ok(problems(manifest).length, 'preparation failure turns the run red');
  const secrets = JSON.stringify(manifest);
  assert.equal(secrets.includes('Bearer'), false);
});

// ---------- CLI / repository wiring ----------
const cli = (args, env = {}) => spawnSync(process.execPath, [path.join(scripts, 'crosspost.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });

test('cli: forced dry-run makes reserve, execute and persist no-ops and creates nothing', () => {
  for (const cmd of ['reserve', 'execute', 'persist', 'reconcile']) {
    const r = cli([cmd, '--manifest', '/nonexistent'], { CROSSPOST_FORCE_DRY_RUN: '1' });
    assert.equal(r.status, 0, `${cmd}: ${r.stderr}`);
    assert.match(r.stdout, /FORCE_DRY_RUN/);
  }
  const r = cli(['reserve'], {});
  assert.notEqual(r.status, 0, 'real reserve demands deployment identity');
});

test('git env: inherited hook variables never reach test repositories', () => {
  const env = cleanGitEnv({ GIT_DIR: '/x', GIT_INDEX_FILE: '/y', GIT_WORK_TREE: '/z', PATH: '/bin', GIT_SSH_COMMAND: 'ssh' });
  assert.deepEqual(env, { PATH: '/bin', GIT_SSH_COMMAND: 'ssh' });
});

test('wiring: package scripts expose the intended surface; old publishing paths are gone', () => {
  const repo = path.resolve(scripts, '..');
  const pkg = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8'));
  for (const k of ['post:add', 'post:approve', 'post:schedule', 'post:status', 'crosspost', 'medium:export', 'test:posts', 'test:crosspost']) assert.ok(pkg.scripts[k], k);
  for (const k of ['new-post', 'schedule', 'medium', 'linkedin', 'linkedin:publish', 'medium:publish', 'linkedin:publish-pending', 'medium:publish-pending', 'post:publish']) assert.equal(pkg.scripts[k], undefined, k);
  assert.match(pkg.scripts.verify, /test:posts/);
  assert.match(pkg.scripts.verify, /test:crosspost/);
  assert.match(pkg.scripts.verify, /check:approval/);
  const wf = readFileSync(path.join(repo, '.github/workflows/pages.yml'), 'utf8');
  assert.doesNotMatch(wf, /linkedin-post\.mjs|linkedin-publish|medium-publish/);
  assert.doesNotMatch(wf, /^\s+CROSSPOST_FORCE_DRY_RUN:/m, 'activated: the rollout switch is off (re-add the line to pause publishing)');
  assert.match(wf, /\[ "\$CROSSPOST_FORCE_DRY_RUN" = "1" \] && dry=true/, 'the pause switch is still honoured');
  assert.match(wf, /group: \$\{\{ \(github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/master'\)/);
  assert.equal((wf.match(/cancel-in-progress/g) ?? []).length, 1, 'no job-level concurrency');
  assert.match(wf, /crosspost:\n    if: github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/master'/);
  assert.match(wf, /needs: \[build, deploy\]/);
  assert.doesNotMatch(wf.replace(/^\s*(IN_\w+|echo).*$/gm, ''), /run:[^\n]*\$\{\{ *inputs\./, 'inputs are never interpolated into shell');
  assert.match(wf, /dry_run:[\s\S]*default: true/);
  assert.match(wf, /if: always\(\) && steps\.persist_reserve\.outcome == 'success'/, 'results persisted even after publisher failure');
  assert.match(wf, /if: steps\.persist_reserve\.outcome == 'success'/, 'publish only after reservations are confirmed');
  assert.doesNotMatch(wf, /^ {6}\w+: \$\{\{ *runner\./m, 'runner context is not allowed in job-level env (breaks the whole workflow)');
  assert.match(wf, /upload-artifact/);
  assert.equal(execFileSync('ls', [path.join(repo, '.github/workflows')], { encoding: 'utf8' }).includes('linkedin.yml'), false);
});
