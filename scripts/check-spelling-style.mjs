#!/usr/bin/env node
/**
 * House-style spelling check for posts: British "-ise"/"-yse", not "-ize"/"-yze".
 *
 *   npm run check:spelling      # cspell, then this check
 *
 * cspell's en-GB dictionary accepts Oxford "-ize" spellings, and cspell can't ban a suffix, so
 * this fills the gap. Code (fenced and inline), HTML tags and URLs are skipped. To allow a word
 * in one post, use the same comment cspell reads: <!-- cspell:ignore Belize -->
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { annotate, root } from './lib/dist.mjs';

const postsDir = path.join(root, 'src/content/posts');

/** Words that legitimately end in -ize/-yze in British English. */
const ALLOW = /^(.*size[sd]?|.*sizing|prizes?|prized|seiz.*|capsiz.*|maize|baize|Belize|citizen.*)$/i;
const IZE = /\b[A-Za-z]+(?:iz|yz)(?:e|es|ed|ing|ation|ations|er|ers)\b/g;

/** Blank out code, tags and URLs, keeping line/column positions intact. */
const blank = (s) => s.replace(/[^\n]/g, ' ');
function prose(md) {
  return md
    .replace(/^([ \t]*)(`{3,}|~{3,})[\s\S]*?^\1\2[ \t]*$/gm, blank)
    .replace(/`[^`\n]+`/g, blank)
    .replace(/<!--[\s\S]*?-->|<[^>\n]+>/g, blank)
    .replace(/\]\([^)\s]*\)/g, blank)
    .replace(/https?:\/\/\S+/g, blank);
}

const suggest = (w) => w.replace(/iz(?=e|ation|ing|er)/i, (m) => (m[0] === 'I' ? 'Is' : 'is'))
  .replace(/yz(?=e|ing|er)/i, (m) => (m[0] === 'Y' ? 'Ys' : 'ys'));

let issues = 0;
for (const file of (await readdir(postsDir)).filter((f) => f.endsWith('.md')).sort()) {
  const source = await readFile(path.join(postsDir, file), 'utf8');
  const ignored = new Set(
    [...source.matchAll(/cspell:ignore\s+([^\n]*?)(?:-->|$)/gm)]
      .flatMap((m) => m[1].trim().split(/\s+/))
      .map((w) => w.toLowerCase()),
  );
  const lines = prose(source).split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(IZE)) {
      const word = m[0];
      if (ALLOW.test(word) || ignored.has(word.toLowerCase())) continue;
      issues++;
      const rel = `src/content/posts/${file}`;
      const msg = `"${word}" should be "${suggest(word)}" (British -ise spelling)`;
      if (process.env.GITHUB_ACTIONS) annotate(`error file=${rel},line=${i + 1},col=${m.index + 1}`, msg);
      else console.log(`${rel}:${i + 1}:${m.index + 1} - ${msg}`);
    }
  });
}

if (issues) {
  console.error(`\n${issues} -ize spelling(s) found.`);
  process.exit(1);
}
console.log('Spelling style OK: no -ize/-yze spellings in posts.');
