import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { READING_COLLECTIONS, SELECTED_POST_IDS, selectLiveLessons, selectLivePosts } from '../src/data/curation.ts';
import { LESSON_GROUPS } from '../src/data/lessons.ts';
import { SELECTED_WORK } from '../src/data/work.ts';

const now = Date.parse('2026-10-30T12:00:00Z');
const post = (id, overrides = {}) => ({
  id,
  data: { published: true, draft: false, date: new Date(now - 1), ...overrides },
});

test('curation uses editorial order, omits missing ids and does not repeat posts', () => {
  const first = post('first');
  const second = post('second');
  assert.deepEqual(
    selectLivePosts([first, second], ['second', 'missing', 'first', 'second'], now),
    [second, first],
  );
});

test('drafts, unpublished and scheduled entries stay out, including preview input', () => {
  const posts = [
    post('live'),
    post('draft', { draft: true }),
    post('unpublished', { published: false }),
    post('scheduled', { date: new Date(now + 1) }),
  ];
  assert.deepEqual(
    selectLivePosts(posts, posts.map(({ id }) => id), now).map(({ id }) => id),
    ['live'],
  );
});

test('scheduled entry joins curation at its publication time', () => {
  const scheduled = post('scheduled', { date: new Date(now + 1) });
  assert.deepEqual(selectLivePosts([scheduled], ['scheduled'], now), []);
  assert.deepEqual(selectLivePosts([scheduled], ['scheduled'], now + 1), [scheduled]);
});

test('empty input and invalid dates cannot produce curated entries', () => {
  assert.deepEqual(selectLivePosts([], SELECTED_POST_IDS, now), []);
  assert.deepEqual(selectLivePosts([post('invalid', { date: new Date('invalid') })], ['invalid'], now), []);
});

test('lessons hide summaries and links for draft, scheduled, unpublished or missing sources', () => {
  const live = post('live');
  const sources = [
    live,
    post('draft', { draft: true }),
    post('scheduled', { date: new Date(now + 1) }),
    post('unpublished', { published: false }),
  ];
  const lessons = ['missing', 'draft', 'live', 'scheduled', 'unpublished'].map((postId) => ({
    postId,
    title: `Lesson from ${postId}`,
    summary: `Summary from ${postId}`,
  }));
  assert.deepEqual(selectLiveLessons(sources, lessons, now), [{ ...lessons[2], post: live }]);
  assert.deepEqual(selectLiveLessons([], lessons, now), []);
});

test('lessons preserve editorial order and join the original post metadata', () => {
  const first = post('first');
  const scheduled = post('scheduled', { date: new Date(now + 1) });
  const lessons = [{ postId: 'scheduled' }, { postId: 'first' }];
  assert.deepEqual(selectLiveLessons([first, scheduled], lessons, now), [{ ...lessons[1], post: first }]);
  assert.deepEqual(selectLiveLessons([first, scheduled], lessons, now + 1), [
    { ...lessons[0], post: scheduled },
    { ...lessons[1], post: first },
  ]);
});

test('lesson topics have stable unique anchors and one summary per article', () => {
  const ids = LESSON_GROUPS.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  const articleIds = [];
  for (const group of LESSON_GROUPS) {
    assert.match(group.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(group.title.trim());
    assert.ok(group.lessons.length > 0);
    for (const lesson of group.lessons) {
      assert.ok(lesson.title.trim());
      assert.ok(lesson.summary.trim());
      articleIds.push(lesson.postId);
      const source = readFileSync(new URL(`../src/content/posts/${lesson.postId}.md`, import.meta.url), 'utf8');
      assert.match(source, /^## The general lessons?\s*$/m, lesson.postId);
    }
  }
  assert.equal(new Set(articleIds).size, articleIds.length);
});

test('every configured article id resolves to a source file', () => {
  const ids = [
    ...SELECTED_POST_IDS,
    ...READING_COLLECTIONS.flatMap(({ postIds }) => postIds),
    ...SELECTED_WORK.flatMap(({ postId }) => postId ? [postId] : []),
    ...LESSON_GROUPS.flatMap(({ lessons }) => lessons.map(({ postId }) => postId)),
  ];
  for (const id of ids) {
    assert.ok(existsSync(new URL(`../src/content/posts/${id}.md`, import.meta.url)), id);
  }
});
