#!/usr/bin/env node
/**
 * Create a new blog post with valid front matter, as a draft.
 *
 *   npm run new-post -- --title "My Post" --category Architecture \
 *     [--tags "AWS,scaling"] [--description "..."] [--date YYYY-MM-DD] [--time 09:00] [--slug my-post]
 *
 * --category and --tags must come from src/data/taxonomy.ts (case is corrected, unknown tags are
 * rejected with suggestions). --date defaults to the next free slot from `npm run schedule`.
 * Times are UK local; the UTC offset (+0000 GMT / +0100 BST) is worked out for the date.
 * Without --description, a TODO placeholder is written: the build rejects it once the post is
 * no longer a draft.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { stringify } from 'yaml';
import { CATEGORIES, DESCRIPTION_MAX, DESCRIPTION_MIN, TAGS } from '../src/data/taxonomy.ts';
import { root } from './lib/dist.mjs';
import { DEFAULT_TIME, frontMatterDate, goLive, loadPosts, postsDir, SITE, slugify, ukDateTime } from './lib/posts.mjs';

const { values: opts } = parseArgs({
  options: {
    title: { type: 'string' },
    category: { type: 'string' },
    tags: { type: 'string', default: '' },
    description: { type: 'string' },
    date: { type: 'string' },
    time: { type: 'string', default: DEFAULT_TIME },
    slug: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
if (opts.help || !opts.title || !opts.category) {
  console.log(`Usage: npm run new-post -- --title "Title" --category <${CATEGORIES.join('|')}>
       [--tags "a,b"] [--description "..."] [--date YYYY-MM-DD] [--time HH:MM] [--slug slug]`);
  process.exit(opts.help ? 0 : 1);
}

// Category and tags: match case-insensitively against the taxonomy.
const byLower = (list) => new Map(list.map((v) => [v.toLowerCase(), v]));
const category = byLower(CATEGORIES).get(opts.category.trim().toLowerCase());
if (!category) fail(`Unknown category "${opts.category}". Use one of: ${CATEGORIES.join(', ')}`);

const tagMap = byLower(TAGS);
const tags = [];
const unknown = [];
for (const raw of opts.tags.split(',').map((t) => t.trim()).filter(Boolean)) {
  const t = tagMap.get(raw.toLowerCase());
  if (t) tags.push(t);
  else unknown.push(raw);
}
if (unknown.length) {
  const near = (u) =>
    TAGS.filter((t) => {
      const [a, b] = [t.toLowerCase(), u.toLowerCase()];
      return a.includes(b) || b.includes(a) || a.replace(/s$/, '') === b.replace(/s$/, '');
    });
  fail(
    unknown
      .map((u) => `Unknown tag "${u}".${near(u).length ? ` Did you mean: ${near(u).join(', ')}?` : ''}`)
      .join('\n') + '\nReuse an existing tag, or add the new one to src/data/taxonomy.ts first.',
  );
}

if (opts.description) {
  const n = opts.description.trim().length;
  if (n < DESCRIPTION_MIN || n > DESCRIPTION_MAX) {
    fail(`Description is ${n} characters; it must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX}.`);
  }
}
if (!/^\d{2}:\d{2}$/.test(opts.time)) fail('--time must be HH:MM (UK local time)');

const date =
  opts.date ??
  execFileSync(process.execPath, [path.join(root, 'scripts/schedule.mjs'), '--next'], { encoding: 'utf8' }).trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('--date must be YYYY-MM-DD');

const slug = opts.slug ? slugify(opts.slug) : slugify(opts.title).split('-').slice(0, 8).join('-');
const id = `${date}-${slug}`;
const file = path.join(postsDir, `${id}.md`);
if (existsSync(file)) fail(`${path.relative(root, file)} already exists.`);
const sameSlug = (await loadPosts()).find((p) => p.slug === slug);
if (sameSlug) fail(`Slug "${slug}" is already used by ${sameSlug.id}. Pass --slug to choose another.`);

const fm = {
  title: opts.title.trim(),
  description:
    opts.description?.trim() ??
    'TODO: one or two sentences (80-320 characters) for listings, RSS and the post lead.',
  date: frontMatterDate(date, opts.time),
  draft: true,
  categories: [category],
  tags,
  author: { display_name: 'Clive Shirley' },
};
// Dates stay unquoted to match existing posts; yaml would otherwise quote the string.
// Titles are double-quoted, like recent posts.
const yaml = stringify(fm, { lineWidth: 0, indentSeq: false })
  .replace(/^date: (['"])(.*)\1$/m, 'date: $2')
  .replace(/^title: .*$/m, `title: ${JSON.stringify(fm.title)}`);

const body = `<!-- Opening: the problem or situation in two or three short paragraphs, then one line
     saying what this post covers. See docs/writing-style.md. -->

## TODO: first section heading (sentence case)

## The general lesson

<!-- What a reader can take away and apply elsewhere. -->
`;

await writeFile(file, `---\n${yaml}---\n\n${body}`);

const categorySlug = slugify(category);
const [y, m, d] = date.split('-');
const when = new Date(fm.date.replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2'));
console.log(`Created ${path.relative(root, file)} (draft)
  URL once live: ${SITE}/${categorySlug}/${y}/${m}/${d}/${slug}.html
  Goes live:     ${ukDateTime(goLive(when))} UK, by the daily rebuild after draft: true is removed
  Preview:       npm run dev, then open the URL path on http://localhost:4321${
    opts.description ? '' : '\n  Next:          replace the TODO description before publishing (the build rejects it)'
  }`);
