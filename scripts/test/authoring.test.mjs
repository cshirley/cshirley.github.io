import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fingerprint, localAssetRefs } from '../lib/approval.mjs';
import { AuthoringError, addPost, approvePost, schedulePost } from '../lib/authoring.mjs';
import { loadPosts } from '../lib/posts.mjs';
import { post, tempRoot } from './helpers.mjs';

const NOW = Date.parse('2029-06-01T12:00:00Z');
const read = (root, id) => readFileSync(path.join(root, 'src/content/posts', `${id}.md`), 'utf8');

test('add creates a draft without approval or live date', async () => {
  const root = tempRoot();
  const r = await addPost({ title: 'My new post', category: 'engineering', date: '2030-03-06' }, { sourceRoot: root, now: NOW });
  assert.equal(r.id, '2030-03-06-my-new-post');
  const [p] = await loadPosts(NOW, { sourceRoot: root });
  assert.equal(p.draft, true);
  assert.equal(p.approvalStatus, 'missing');
  assert.match(p.fm.description, /^TODO/);
});

test('approval records a fingerprint, keeps the draft flag and ignores date changes', async () => {
  const root = tempRoot();
  post(root, '2030-01-02-a-post');
  const r = await approvePost('a-post', { sourceRoot: root, now: NOW });
  const [p] = await loadPosts(NOW, { sourceRoot: root });
  assert.equal(p.draft, true);
  assert.equal(p.approvalStatus, 'approved');
  assert.equal(p.approval.fingerprint, r.fingerprint);
  const src = read(root, '2030-01-02-a-post');
  writeFileSync(path.join(root, 'src/content/posts/2030-01-02-a-post.md'), src.replace(/^date:.*$/m, 'date: 2030-05-01 09:00:00 +0100'));
  assert.equal((await loadPosts(NOW, { sourceRoot: root }))[0].approvalStatus, 'approved');
});

test('approval rejects TODO placeholders, bad taxonomy and live posts', async () => {
  const root = tempRoot();
  post(root, '2030-01-02-todo', { fm: { description: 'TODO write me' } });
  post(root, '2030-01-09-bad-tag', { fm: { tags: ['no-such-tag'] } });
  post(root, '2020-01-02-live', { fm: { draft: false, date: '2020-01-02 09:00:00 +0000' } });
  for (const id of ['todo', 'bad-tag', 'live']) {
    await assert.rejects(approvePost(id, { sourceRoot: root, now: NOW }), AuthoringError);
  }
});

test('editing content, body or a referenced asset makes approval stale', async () => {
  const root = tempRoot();
  writeFileSync(path.join(root, 'public/assets/pic.png'), 'one');
  post(root, '2030-01-02-img', { body: '![x](/assets/pic.png)\n\n## The general lesson\n\nL\n' });
  await approvePost('img', { sourceRoot: root, now: NOW });
  const status = async () => (await loadPosts(NOW, { sourceRoot: root }))[0].approvalStatus;
  assert.equal(await status(), 'approved');
  writeFileSync(path.join(root, 'public/assets/pic.png'), 'two');
  assert.equal(await status(), 'stale');
  writeFileSync(path.join(root, 'public/assets/pic.png'), 'one');
  assert.equal(await status(), 'approved');
  const file = path.join(root, 'src/content/posts/2030-01-02-img.md');
  writeFileSync(file, readFileSync(file, 'utf8').replace('Lesson', 'Changed').replace(/^L$/m, 'Changed'));
  assert.equal(await status(), 'stale');
});

test('fingerprint ignores line endings and unreferenced fields but not editorial ones', async () => {
  const root = tempRoot();
  const fm = { title: 'T', description: 'D', categories: ['Engineering'], tags: [] };
  const base = await fingerprint(root, fm, 'text\n');
  assert.equal(await fingerprint(root, fm, 'text\r\n'), base);
  assert.notEqual(await fingerprint(root, { ...fm, title: 'U' }, 'text\n'), base);
  assert.deepEqual(localAssetRefs('<img src="/assets/a.png"> [x](/assets/b.pdf?x=1) [y](https://e.com/z)'), ['/assets/a.png', '/assets/b.pdf']);
});

test('scheduling needs current approval, a future date and clears draft', async () => {
  const root = tempRoot();
  post(root, '2030-01-02-a-post');
  await assert.rejects(schedulePost('a-post', { date: '2030-02-06' }, { sourceRoot: root, now: NOW }), /not approved/);
  await approvePost('a-post', { sourceRoot: root, now: NOW });
  await assert.rejects(schedulePost('a-post', { date: '2029-05-01' }, { sourceRoot: root, now: NOW }), /not in the future/);
  const r = await schedulePost('a-post', { date: '2030-02-06', time: '09:00' }, { sourceRoot: root, now: NOW });
  assert.equal(r.id, '2030-02-06-a-post');
  assert.equal(r.stamp, '2030-02-06 09:00:00 +0000');
  assert.equal(existsSync(path.join(root, 'src/content/posts/2030-01-02-a-post.md')), false);
  const [p] = await loadPosts(NOW, { sourceRoot: root });
  assert.equal(p.draft, false);
  assert.equal(p.scheduled, true);
  assert.equal(p.approvalStatus, 'approved');
});

test('scheduling stays on the right side of daylight saving', async () => {
  const root = tempRoot();
  post(root, '2030-01-02-summer');
  await approvePost('summer', { sourceRoot: root, now: NOW });
  const r = await schedulePost('summer', { date: '2030-07-10', time: '09:00' }, { sourceRoot: root, now: NOW });
  assert.equal(r.stamp, '2030-07-10 09:00:00 +0100');
  assert.equal(r.when.toISOString(), '2030-07-10T08:00:00.000Z');
});

test('scheduling updates quoted id references and refuses ids with destination records', async () => {
  const root = tempRoot();
  post(root, '2030-01-02-ref');
  post(root, '2030-01-09-held');
  writeFileSync(path.join(root, 'src/data/curation.ts'), `export const IDS = ['2030-01-02-ref'];\n`);
  writeFileSync(path.join(root, 'src/data/crosspost-state.json'), JSON.stringify({ '2030-01-09-held': { medium: { status: 'draft' } } }));
  await approvePost('ref', { sourceRoot: root, now: NOW });
  await approvePost('held', { sourceRoot: root, now: NOW });
  const r = await schedulePost('ref', { date: '2030-03-06' }, { sourceRoot: root, now: NOW });
  assert.equal(r.updatedRefs.length, 1);
  assert.match(readFileSync(path.join(root, 'src/data/curation.ts'), 'utf8'), /2030-03-06-ref/);
  await assert.rejects(schedulePost('held', { date: '2030-03-13' }, { sourceRoot: root, now: NOW }), /cross-post records/);
  assert.ok(existsSync(path.join(root, 'src/content/posts/2030-01-09-held.md')));
});

test('live posts cannot be moved; baseline posts schedule without new approval', async () => {
  const root = tempRoot();
  post(root, '2020-01-02-old', { fm: { draft: false, date: '2020-01-02 09:00:00 +0000' } });
  post(root, '2030-01-02-old-draft');
  writeFileSync(path.join(root, 'src/data/approval-baseline.json'), JSON.stringify(['2030-01-02-old-draft']));
  await assert.rejects(schedulePost('2020-01-02-old', { date: '2030-02-06' }, { sourceRoot: root, now: NOW }), /is live/);
  const r = await schedulePost('old-draft', { date: '2030-02-06' }, { sourceRoot: root, now: NOW });
  assert.equal(r.id, '2030-02-06-old-draft');
});

test('hand-edited draft:false without approval is not releasable', async () => {
  const root = tempRoot();
  post(root, '2020-01-02-sneaky', { fm: { draft: false, date: '2020-01-02 09:00:00 +0000' } });
  const [p] = await loadPosts(NOW, { sourceRoot: root });
  assert.equal(p.live, true);
  assert.equal(p.approvalOk, false);
});
