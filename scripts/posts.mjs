#!/usr/bin/env node
/**
 * Authoring workflow: add -> approve -> schedule, plus status. Edits local files only; it never
 * commits, pushes or calls a destination API. Releasing happens when reviewed changes reach master.
 *
 *   npm run post:add -- --title "My Post" --category Engineering [--tags "a,b"] [--description "..."]
 *                       [--date YYYY-MM-DD] [--time HH:MM] [--slug my-post]
 *   npm run post:approve -- <post>
 *   npm run post:schedule -- <post> (--next | --date YYYY-MM-DD) [--time HH:MM]
 *   npm run post:status [-- --json]
 *
 * <post> is an id, slug, or unique part of one. Times are UK local.
 */
import { parseArgs } from 'node:util';
import path from 'node:path';
import { root } from './lib/dist.mjs';
import { AuthoringError, addPost, approvePost, schedulePost, statusReport } from './lib/authoring.mjs';
import { CATEGORIES } from '../src/data/taxonomy.ts';
import { ukDateTime } from './lib/posts.mjs';

const [command, ...rest] = process.argv.slice(2);
const { values: opts, positionals } = parseArgs({
  args: rest,
  allowPositionals: true,
  options: {
    title: { type: 'string' },
    category: { type: 'string' },
    tags: { type: 'string' },
    description: { type: 'string' },
    date: { type: 'string' },
    time: { type: 'string' },
    slug: { type: 'string' },
    next: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    cadence: { type: 'string' },
    weekday: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const usage = `Usage: npm run post:add -- --title "Title" --category <${CATEGORIES.join('|')}>
         [--tags "a,b"] [--description "..."] [--date YYYY-MM-DD] [--time HH:MM] [--slug slug]
       npm run post:approve -- <post>
       npm run post:schedule -- <post> (--next | --date YYYY-MM-DD) [--time HH:MM]
       npm run post:status [-- --json] [--cadence 7] [--weekday 3]`;

const rel = (f) => path.relative(root, f);
const uk = (d) => `${ukDateTime(d)} UK / ${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

try {
  if (!command || opts.help || !['add', 'approve', 'schedule', 'status'].includes(command)) {
    console.log(usage);
    process.exit(command && !opts.help ? 1 : 0);
  }
  if (command === 'add') {
    const r = await addPost(opts);
    console.log(`Created ${rel(r.file)} (draft)
  ID:        ${r.id}
  URL once live: ${r.url}
  Next:      write and review, then: npm run post:approve -- ${r.id}${r.hasDescription ? '' : '\n             replace the TODO description first (approval rejects it)'}`);
  } else if (command === 'approve') {
    if (!positionals[0]) throw new AuthoringError('Usage: npm run post:approve -- <post>');
    const r = await approvePost(positionals[0]);
    for (const w of r.warnings) console.log(`warning: ${w}`);
    console.log(`${r.renewed ? 'Renewed approval for' : 'Approved'} ${r.post.id}
  Fingerprint: ${r.fingerprint}
  It stays a draft. Next: npm run post:schedule -- ${r.post.id} --next`);
  } else if (command === 'schedule') {
    if (!positionals[0]) throw new AuthoringError('Usage: npm run post:schedule -- <post> (--next | --date YYYY-MM-DD)');
    const r = await schedulePost(positionals[0], {
      next: opts.next,
      date: opts.date,
      time: opts.time,
      cadence: opts.cadence ? Number(opts.cadence) : undefined,
      weekday: opts.weekday ? Number(opts.weekday) : undefined,
    });
    console.log(`Scheduled ${r.id}${r.from !== r.id ? ` (was ${r.from})` : ''}
  date:      ${r.stamp}
  publishes: ${uk(r.when)}
  URL:       ${r.url}
  deploys:   ${r.goLive ? `${ukDateTime(r.goLive)} UK (first daily rebuild at or after its date)` : 'on the first build after its date'}`);
    for (const f of r.updatedRefs) console.log(`  updated references in ${rel(f)}`);
    for (const id of r.nearby) console.log(`  ! within a week of ${id}`);
    console.log('\nNot active until these changes are reviewed, committed and pushed to master (npm run verify first).');
  } else {
    const r = await statusReport({ cadence: opts.cadence ? Number(opts.cadence) : undefined, weekday: opts.weekday ? Number(opts.weekday) : undefined });
    if (opts.json) {
      console.log(JSON.stringify(r.posts.map((p) => ({ id: p.id, date: p.date.toISOString(), draft: p.draft, approval: p.approvalStatus })), null, 2));
    } else console.log(r.text);
  }
} catch (err) {
  if (!(err instanceof AuthoringError)) throw err;
  console.error(err.message);
  process.exit(1);
}
