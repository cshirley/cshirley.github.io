// Publishing cadence: gaps, clashes and the next free slot. Pure functions over loaded posts.
import { goLive, rebuildTimeUtc, ymd } from './posts.mjs';

export const DAY = 86_400_000;
export const DEFAULT_CADENCE = 7;
export const DEFAULT_WEEKDAY = 3; // Wednesday

/** Next date on or after d that falls on the target weekday (UTC calendar date). */
export const alignForward = (d, weekday = DEFAULT_WEEKDAY) => {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  while (out.getUTCDay() !== weekday) out.setUTCDate(out.getUTCDate() + 1);
  return out;
};

export const nearestWeekday = (d, weekday = DEFAULT_WEEKDAY) => {
  const back = new Date(d);
  const fwd = alignForward(d, weekday);
  while (back.getUTCDay() !== weekday) back.setUTCDate(back.getUTCDate() - 1);
  return d - back <= fwd - d ? back : fwd;
};

const byDate = (a, b) => a.date - b.date;

/** Everything the report and `--next` need, derived from posts that have a publishable state. */
export function scheduleReport(allPosts, { now = Date.now(), cadence = DEFAULT_CADENCE, weekday = DEFAULT_WEEKDAY, rebuild = rebuildTimeUtc() } = {}) {
  const posts = allPosts.filter((p) => p.published);
  const live = posts.filter((p) => p.live).sort(byDate);
  const scheduled = posts.filter((p) => p.scheduled).sort(byDate);
  const drafts = posts.filter((p) => p.draft).sort(byDate);
  const lastLive = live.at(-1);
  const queue = [...scheduled, ...drafts.filter((d) => d.date.valueOf() > now)].sort(byDate);
  const timeline = [...(lastLive ? [lastLive] : []), ...queue];
  const issues = [];
  for (let i = 1; i < timeline.length; i++) {
    const [a, b] = [timeline[i - 1], timeline[i]];
    const days = Math.round((b.date - a.date) / DAY);
    if (days < 7) issues.push({ type: 'clash', days, between: [a.id, b.id] });
    else if (days > cadence + 3) {
      const mid = nearestWeekday(new Date(a.date.valueOf() + (b.date - a.date) / 2), weekday);
      issues.push({ type: 'gap', days, between: [a.id, b.id], suggest: ymd(mid) });
    }
  }
  if (lastLive && queue.length === 0 && now - lastLive.date > (cadence + 3) * DAY) {
    issues.push({ type: 'gap', days: Math.round((now - lastLive.date) / DAY), between: [lastLive.id, 'today'] });
  }
  const last = timeline.at(-1)?.date ?? new Date(now);
  const next = alignForward(new Date(Math.max(last.valueOf() + cadence * DAY, now + DAY)), weekday);
  return { live, scheduled, drafts, issues, next, nextSlot: ymd(next), rebuild, goLive: (p) => goLive(p.date, rebuild) };
}
