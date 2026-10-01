// Shared helpers for the post-build checks (check-links.mjs, check-urls.mjs).
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const dist = path.resolve(root, process.env.DIST_DIR ?? 'dist');

/** Medium copies (public/medium/) link to the canonical post by absolute URL, including posts
 *  that are still scheduled, so they are excluded from the site's link and URL checks. */
export const EXCLUDED_DIRS = ['medium'];

/** All files under dist/, as POSIX paths relative to dist/ (e.g. "about/index.html"). */
export async function distFiles() {
  const entries = await readdir(dist, { recursive: true, withFileTypes: true }).catch((err) => {
    if (err.code === 'ENOENT') {
      console.error(`${path.relative(root, dist)}/ not found. Run \`npm run build\` first.`);
      process.exit(2);
    }
    throw err;
  });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(dist, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .filter((f) => !EXCLUDED_DIRS.some((d) => f.startsWith(`${d}/`)))
    .sort();
}

/** Site URL path for a dist file: "about/index.html" -> "/about/", "a/b.html" -> "/a/b.html". */
export const urlPathFor = (file) => `/${file.replace(/(^|\/)index\.html$/, '$1')}`;

/** GitHub Actions annotation when running in CI, plain text locally. */
export function annotate(level, message) {
  if (process.env.GITHUB_ACTIONS) console.log(`::${level}::${message.replace(/\n/g, '%0A')}`);
  else console.log(`${level}: ${message}`);
}
