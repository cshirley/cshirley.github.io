---
name: publish-schedule
description: Show and manage the blog's publishing schedule. Lists scheduled posts and drafts with their real go-live times, finds gaps and clashes in the weekly cadence, suggests the next free slot, and reschedules posts that aren't live yet. Use when the user asks what's queued or coming up, when a post will appear, or wants to move, reorder or plan posts.
disable-model-invocation: true
---

# Publishing schedule

Run commands from the repository root.

## How publishing works

A post goes live when all three are true: `draft` isn't `true`, `published` isn't `false`, and
its `date` has passed **at build time**. Builds happen on every push to `master`, and once a
day from the cron in `.github/workflows/pages.yml`. So a scheduled post appears at the first
build after its date. That's the daily rebuild, unless someone pushes earlier.

GitHub can delay scheduled runs by minutes, occasionally longer.

## Report

```bash
npm run post:status            # human-readable: editorial state, go-live times, destinations
npm run post:status -- --json  # for processing
```

The report shows:
- Scheduled posts with their real go-live time, flagged when that's the day after the post's date.
- Drafts, flagged when their date has already passed, which means they go live on the next
  deploy once `draft: true` is removed.
- The last three live posts.
- Cadence problems: posts less than seven days apart (clash), or gaps more than three days longer than the cadence,
  with a suggested fill date.
- The next free slot.

Options: `--cadence <days>` (default 7) and `--weekday <0-6>` (default 3, Wednesday). The report ends
with the next free slot; `npm run post:schedule -- <post> --next` uses it.

When summarising for the user, lead with anything flagged.

## Reschedule

```bash
npm run post:schedule -- <post> --date YYYY-MM-DD [--time HH:MM]
```

`<post>` is a file id, slug or unique part of one. The command needs a current approval (`npm run post:approve -- <post>`), and:
- renames the file and updates quoted id references, or refuses if destination records exist;
- rewrites the `date:` line, keeping the UK time of day and using the right offset (`+0000`
  GMT or `+0100` BST);
- prints the new go-live time and any clash.

Moving a date alone needs no new approval. It refuses to move a **live** post, because the date is part of its URL. If that's really
needed, change the post by hand, add the old path to `redirects` in `astro.config.mjs`, and
run `npm run build && npm run check:urls`. It also refuses a past date for a non-draft post,
because that would publish it on the next deploy.

To swap two posts, move one to a temporary free date first, then move the other, then move the
first into place.

## Rules

- Confirm with the user before moving posts. Show them the before and after from the report.
- After moving, run `npm run build && npm run check:links:drafts`. A post's URL contains its
  date, so links to it from other posts need updating.
- Don't commit unless asked.
