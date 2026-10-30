// Shared test helpers: temporary source roots and ledgers.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function tempRoot() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'site-'));
  mkdirSync(path.join(dir, 'src/content/posts'), { recursive: true });
  mkdirSync(path.join(dir, 'src/data'), { recursive: true });
  mkdirSync(path.join(dir, 'public/assets'), { recursive: true });
  return dir;
}

export const post = (root, id, { fm = {}, body = 'Body text.\n\n## The general lesson\n\nLesson.\n' } = {}) => {
  const front = {
    title: `Title ${id}`,
    description: 'A description that is comfortably long enough to satisfy the schema rules for listings, the feed and the post lead.',
    date: '2030-01-02 09:00:00 +0000',
    draft: true,
    categories: ['Engineering'],
    tags: [],
    ...fm,
  };
  const yaml = Object.entries(front)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? (v.length ? `\n${v.map((x) => `- ${x}`).join('\n')}` : '[]') : v}`)
    .join('\n');
  const file = path.join(root, 'src/content/posts', `${id}.md`);
  writeFileSync(file, `---\n${yaml}\n---\n\n${body}`);
  return file;
};
