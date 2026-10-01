// Load blog posts from src/content/posts for the authoring scripts (new-post, schedule).
// Mirrors src/utils.ts (postPath, live/scheduled rules) so scripts agree with the site.
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { root } from './dist.mjs';

export const postsDir = path.join(root, 'src/content/posts');
export const SITE = 'https://www.shirleyconsulting.co.uk';
export const TIME_ZONE = 'Europe/London';
/** Posts go out at 09:00 UK time unless told otherwise. */
export const DEFAULT_TIME = '09:00';

export const slugify = (s) =>
  s.toLowerCase().trim().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pad = (n) => String(n).padStart(2, '0');

export const splitFrontMatter = (src) => {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? { yaml: m[1], body: src.slice(m[0].length) } : { yaml: '', body: src };
};

export async function loadPosts(now = Date.now()) {
  const files = (await readdir(postsDir)).filter((f) => f.endsWith('.md')).sort();
  return Promise.all(
    files.map(async (file) => {
      const src = await readFile(path.join(postsDir, file), 'utf8');
      const fm = parseYaml(splitFrontMatter(src).yaml) ?? {};
      const id = file.replace(/\.md$/, '');
      const date = new Date(fm.date);
      const slug = id.replace(/^\d{4}-\d{2}-\d{2}-/, '');
      const categories = (fm.categories ?? []).map(String);
      const urlPath = `/${[
        ...categories.map(slugify),
        date.getUTCFullYear(),
        pad(date.getUTCMonth() + 1),
        pad(date.getUTCDate()),
        slug,
      ].join('/')}.html`;
      const draft = fm.draft === true;
      const published = fm.published !== false;
      return {
        id,
        file: path.join(postsDir, file),
        slug,
        title: String(fm.title ?? slug),
        description: fm.description ? String(fm.description) : '',
        date,
        draft,
        published,
        categories,
        tags: (fm.tags ?? []).map(String),
        urlPath,
        url: SITE + urlPath,
        live: published && !draft && date.valueOf() <= now,
        scheduled: published && !draft && date.valueOf() > now,
      };
    }),
  );
}

/** UTC offset of UK time on a calendar date, e.g. "+0100" (BST) or "+0000" (GMT). */
export function londonOffset(ymd) {
  const name = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${ymd}T12:00:00Z`))
    .find((p) => p.type === 'timeZoneName').value; // "GMT+01:00" or "GMT"
  const m = name.match(/([+-])(\d{2}):(\d{2})/);
  return m ? `${m[1]}${m[2]}${m[3]}` : '+0000';
}

/** Front matter date for a UK-local date and time: "2026-10-14 09:00:00 +0100". */
export const frontMatterDate = (ymd, hhmm = DEFAULT_TIME) => `${ymd} ${hhmm}:00 ${londonOffset(ymd)}`;

/** The daily rebuild's UTC time, read from the Pages workflow so it stays in sync. */
export function rebuildTimeUtc() {
  const wf = path.join(root, '.github/workflows/pages.yml');
  const src = existsSync(wf) ? readFileSync(wf, 'utf8') : '';
  const m = src.match(/cron:\s*['"](\d+)\s+(\d+)\s+\*\s+\*\s+\*['"]/);
  return m ? { hour: Number(m[2]), minute: Number(m[1]) } : null;
}

/** When a scheduled post actually appears: the first daily rebuild at or after its date.
 *  (A push to master after the date also publishes it.) GitHub can delay cron runs. */
export function goLive(date, rebuild = rebuildTimeUtc()) {
  if (!rebuild) return null;
  const d = new Date(date);
  const run = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), rebuild.hour, rebuild.minute));
  if (run < d) run.setUTCDate(run.getUTCDate() + 1);
  return run;
}

export const ymd = (d) => d.toISOString().slice(0, 10);
export const weekday = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
export const ukDateTime = (d) =>
  d.toLocaleString('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
