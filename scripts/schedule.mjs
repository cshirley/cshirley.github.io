#!/usr/bin/env node
/**
 * Publishing schedule: what's queued, when it actually goes live, gaps and clashes in the
 * cadence, and the next free slot. Can also move a not-yet-live post to a new date.
 *
 *   npm run schedule                          # report
 *   npm run schedule -- --next                # print the next free slot (YYYY-MM-DD) only
 *   npm run schedule -- --json                # machine-readable report
 *   npm run schedule -- --move <post> <YYYY-MM-DD>   # reschedule (renames file, updates date)
 *   options: --cadence <days> (default 14)  --weekday <0-6, Sun=0> (default 3, Wednesday)
 *
 * <post> is a file id, slug, or unique part of one. Only drafts and scheduled posts can be
 * moved: a live post's URL contains its date, so moving it would break links.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  frontMatterDate,
  goLive,
  loadPosts,
  postsDir,
  rebuildTimeUtc,
  TIME_ZONE,
  ukDateTime,
  weekday,
  ymd,
} from './lib/posts.mjs';
import { root } from './lib/dist.mjs';

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    next: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    move: { type: 'boolean', default: false },
    cadence: { type: 'string', default: '14' },
    weekday: { type: 'string', default: '3' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});
if (opts.help) {
  console.log(
    'Usage: npm run schedule -- [--next | --json | --move <post> <YYYY-MM-DD>] [--cadence 14] [--weekday 3]',
  );
  process.exit(0);
}

const DAY = 86_400_000;
const cadence = Number(opts.cadence);
const targetWeekday = Number(opts.weekday);
const now = Date.now();
const posts = (await loadPosts(now)).filter((p) => p.published);
const rebuild = rebuildTimeUtc();

const findPost = (q) => {
  const key = path.basename(q).replace(/\.md$/, '');
  const exact = posts.find((p) => p.id === key || p.slug === key);
  if (exact) return exact;
  const hits = posts.filter((p) => p.id.includes(key));
  if (hits.length === 1) return hits[0];
  console.error(hits.length ? `"${q}" is ambiguous:\n  ${hits.map((p) => p.id).join('\n  ')}` : `"${q}" matches no post`);
  process.exit(1);
};

/** Next date on or after d that falls on the target weekday (UTC calendar date). */
const alignForward = (d) => {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  while (out.getUTCDay() !== targetWeekday) out.setUTCDate(out.getUTCDate() + 1);
  return out;
};
const nearestWeekday = (d) => {
  const back = new Date(d);
  const fwd = alignForward(d);
  while (back.getUTCDay() !== targetWeekday) back.setUTCDate(back.getUTCDate() - 1);
  return d - back <= fwd - d ? back : fwd;
};

// ---------------------------------------------------------------------------------------------
// --move

if (opts.move) {
  const [query, date] = positionals;
  if (!query || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
    console.error('Usage: npm run schedule -- --move <post> <YYYY-MM-DD>');
    process.exit(1);
  }
  const post = findPost(query);
  if (post.live) {
    console.error(
      `${post.id} is live at ${post.urlPath}. Its URL contains the date, so moving it would break links.\n` +
        'If you really need to, change it by hand and add a redirect in astro.config.mjs.',
    );
    process.exit(1);
  }
  const time = post.date.toLocaleTimeString('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
  const newDate = new Date(frontMatterDate(date, time).replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2'));
  if (!post.draft && newDate.valueOf() <= now) {
    console.error(`${date} ${time} is in the past: the post would go live on the next deploy. Pick a future date.`);
    process.exit(1);
  }
  const newFile = path.join(postsDir, `${date}-${post.slug}.md`);
  if (newFile !== post.file && existsSync(newFile)) {
    console.error(`${path.relative(root, newFile)} already exists.`);
    process.exit(1);
  }
  const src = await readFile(post.file, 'utf8');
  if (!/^date:.*$/m.test(src)) throw new Error(`${post.id} has no date: line`);
  await writeFile(post.file, src.replace(/^date:.*$/m, `date: ${frontMatterDate(date, time)}`));
  if (newFile !== post.file) {
    let tracked = true;
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', post.file], { cwd: root, stdio: 'ignore' });
    } catch {
      tracked = false;
    }
    if (tracked) execFileSync('git', ['mv', post.file, newFile], { cwd: root });
    else await rename(post.file, newFile);
  }
  const clashes = posts.filter((p) => p.id !== post.id && Math.abs(p.date - newDate) < 7 * DAY);
  console.log(`Moved ${post.id} -> ${date}-${post.slug}`);
  console.log(`  date: ${frontMatterDate(date, time)}`);
  if (!post.draft) console.log(`  goes live: ${ukDateTime(goLive(newDate, rebuild))} UK (daily rebuild)`);
  for (const c of clashes) console.log(`  ! within a week of ${c.id}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------
// Report

const byDate = (a, b) => a.date - b.date;
const live = posts.filter((p) => p.live).sort(byDate);
const scheduled = posts.filter((p) => p.scheduled).sort(byDate);
const drafts = posts.filter((p) => p.draft).sort(byDate);

// Cadence: from the latest live post through everything queued (scheduled + dated drafts).
const lastLive = live.at(-1);
const queue = [...scheduled, ...drafts.filter((d) => d.date.valueOf() > now)].sort(byDate);
const timeline = [...(lastLive ? [lastLive] : []), ...queue];
const issues = [];
for (let i = 1; i < timeline.length; i++) {
  const [a, b] = [timeline[i - 1], timeline[i]];
  const days = Math.round((b.date - a.date) / DAY);
  if (days < 7) issues.push({ type: 'clash', days, between: [a.id, b.id] });
  else if (days > cadence + 3) {
    const mid = nearestWeekday(new Date(a.date.valueOf() + (b.date - a.date) / 2));
    issues.push({ type: 'gap', days, between: [a.id, b.id], suggest: ymd(mid) });
  }
}
if (lastLive && queue.length === 0 && now - lastLive.date > (cadence + 3) * DAY) {
  issues.push({ type: 'gap', days: Math.round((now - lastLive.date) / DAY), between: [lastLive.id, 'today'] });
}

const last = timeline.at(-1)?.date ?? new Date(now);
let next = alignForward(new Date(Math.max(last.valueOf() + cadence * DAY, now + DAY)));
const nextSlot = ymd(next);

const row = (p) => {
  const gl = p.scheduled ? goLive(p.date, rebuild) : null;
  return {
    id: p.id,
    title: p.title,
    date: p.date.toISOString(),
    goLive: gl?.toISOString() ?? null,
    lateByDay: gl ? ymd(gl) !== ymd(p.date) : false,
    url: p.urlPath,
  };
};

if (opts.next) {
  console.log(nextSlot);
  process.exit(0);
}

const report = {
  rebuildUtc: rebuild ? `${String(rebuild.hour).padStart(2, '0')}:${String(rebuild.minute).padStart(2, '0')}` : null,
  cadenceDays: cadence,
  scheduled: scheduled.map(row),
  drafts: drafts.map(row),
  recentlyLive: live.slice(-3).reverse().map(row),
  issues,
  nextSlot,
};
if (opts.json) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const dayLabel = (d) => `${weekday(d)} ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
const out = [];
out.push(`Daily rebuild: ${report.rebuildUtc ?? 'none found'} UTC (.github/workflows/pages.yml). Pushing to master also publishes due posts.`);
out.push('', `Scheduled (${scheduled.length})`);
for (const p of scheduled) {
  const gl = goLive(p.date, rebuild);
  const late = gl && ymd(gl) !== ymd(p.date) ? '  ! appears the day after its date' : '';
  out.push(`  ${dayLabel(p.date).padEnd(17)} ${p.id.slice(11).padEnd(42)} live ${gl ? ukDateTime(gl) + " UK" : "?"}${late}`);
}
out.push('', `Drafts (${drafts.length})`);
for (const p of drafts) {
  const past = p.date.valueOf() <= now ? '  ! date is past: goes live on the next deploy once draft is removed' : '';
  out.push(`  ${dayLabel(p.date).padEnd(17)} ${p.id.slice(11)}${past}`);
}
out.push('', 'Recently live');
for (const p of live.slice(-3).reverse()) out.push(`  ${dayLabel(p.date).padEnd(17)} ${p.id.slice(11)}`);
out.push('', `Cadence (every ${cadence} days)`);
if (!issues.length) out.push('  OK');
for (const i of issues) {
  if (i.type === 'clash') out.push(`  ! ${i.between.join(' and ')} are ${i.days} day(s) apart`);
  else out.push(`  ! ${i.days}-day gap after ${i.between[0]}${i.suggest ? ` (fill on ${i.suggest})` : ''}`);
}
out.push('', `Next free slot: ${nextSlot} (${weekday(next)})`);
console.log(out.join('\n'));
