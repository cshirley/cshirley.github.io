#!/usr/bin/env node
/**
 * Guard published URLs: every URL in urls.snapshot.txt must still exist in the build (as a page
 * or a redirect), so old links and search results keep working.
 *
 *   npm run build && npm run check:urls     # fail if a published URL has disappeared
 *   npm run build && npm run urls:update    # record the current URLs (after publishing a post,
 *                                           # or after deliberately removing a page)
 *
 * A post's URL comes from its categories, date and slug, so changing any of them moves the post.
 * Fix by reverting, or by adding the old URL to `redirects` in astro.config.mjs.
 *
 * URLs in the build that aren't in the snapshot (e.g. a scheduled post that has just gone live)
 * are reported as warnings only. Run `npm run urls:update` to start protecting them.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { annotate, dist, distFiles, root, urlPathFor } from './lib/dist.mjs';

const SNAPSHOT = path.join(root, 'urls.snapshot.txt');
const update = process.argv.includes('--update');

const files = (await distFiles()).filter((f) => /\.(html|xml)$/.test(f) && f !== '404.html');
const current = files.map(urlPathFor).sort();

if (update) {
  // Drafts and scheduled posts must not be recorded: they aren't published yet.
  for (const f of files.filter((f) => f.endsWith('.html'))) {
    if ((await readFile(path.join(dist, f), 'utf8')).includes('class="badge-draft"')) {
      console.error(
        `dist/ contains a draft or scheduled post (${urlPathFor(f)}).\n` +
          'Rebuild without SHOW_DRAFTS or `npm run dev` output (`npm run build`), then retry.',
      );
      process.exit(1);
    }
  }
  const header =
    '# Published URLs that must keep working. Checked by `npm run check:urls` in CI.\n' +
    '# Regenerate with `npm run build && npm run urls:update`.\n';
  await writeFile(SNAPSHOT, `${header}${current.join('\n')}\n`);
  console.log(`Wrote ${current.length} URLs to urls.snapshot.txt`);
  process.exit(0);
}

if (!existsSync(SNAPSHOT)) {
  console.error('urls.snapshot.txt not found. Create it with `npm run build && npm run urls:update`.');
  process.exit(1);
}

const snapshot = (await readFile(SNAPSHOT, 'utf8'))
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));
const currentSet = new Set(current);
const snapshotSet = new Set(snapshot);
const missing = snapshot.filter((u) => !currentSet.has(u));
const added = current.filter((u) => !snapshotSet.has(u));

if (added.length) {
  annotate(
    'warning',
    `${added.length} URL(s) not yet in urls.snapshot.txt (run \`npm run urls:update\` to protect them):\n` +
      added.map((u) => `  ${u}`).join('\n'),
  );
}

if (missing.length) {
  annotate(
    'error',
    `${missing.length} published URL(s) no longer exist:\n${missing.map((u) => `  ${u}`).join('\n')}\n` +
      'Restore the post, add a redirect in astro.config.mjs, or (if intentional) run `npm run urls:update`.',
  );
  process.exit(1);
}
console.log(`URLs OK: all ${snapshot.length} published URLs still exist.`);
