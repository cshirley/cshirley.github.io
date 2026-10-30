# Publishing and cross-posting

Day-to-day guidance. Requirements, design and delivery history are in
[`features/publishing-workflow/`](features/publishing-workflow/brief.md).

## Authoring (normal journey)

```bash
npm run post:add -- --title "..." --category Engineering
npm run post:approve -- <post>
npm run post:schedule -- <post> --next      # or --date YYYY-MM-DD [--time HH:MM], UK local
npm run post:status
```

Then `npm run verify`, review, commit and push. Approval records a fingerprint of the reviewed content
and never publishes anything. Scheduling needs a current approval and a future date. Editing reviewed
content makes the approval stale (status shows it; re-run `post:approve`). The deployment and
cross-posting happen automatically from `master`, at the first build at or after the post's date.

## What happens after a push

`.github/workflows/pages.yml` builds, deploys and smoke-tests, then the `crosspost` job runs:

1. Select live articles from the **deployed commit** (not newer `master`) with no record for a
   destination in `src/data/crosspost-state.json`. Oldest first. Defaults: 3 Medium articles and 1
   LinkedIn share per run; LinkedIn also allows one automatic creation per UTC day.
2. Prepare payloads, write `needs-review` reservations, commit and push them (the pre-commit hook runs
   `npm run verify`), and confirm them on the remote. **Nothing is sent before that.**
3. Submit each reserved article once. Medium requests public publication and records the status it
   actually returns (`published` or `draft`).
4. Record results, push, upload a recovery artifact and summarise. Failures turn the job red but never
   undo the deployment.

Ledger statuses: `published`, `draft` (external content exists), `skipped` (excluded on purpose, needs a
reason) and `needs-review` (attempt unresolved). Only missing state is eligible. Existing Medium drafts are
never recreated or promoted automatically.

## Manual runs

Actions → **Deploy to GitHub Pages** → Run workflow (from `master`). It deploys first, then
`destination`, `article_ids`, `dry_run` (default on), `override_skipped` and
`bypass_linkedin_daily_allowance` apply. Overrides need explicit IDs and cannot recreate
published/draft records or bypass unresolved attempts. Push and scheduled runs ignore these inputs.

## Operator CLI (advanced)

```bash
npm run crosspost -- list                       # queue, allowance, blocks (no preparation)
npm run crosspost -- dry-run --ids "<id>"       # also prepares payloads (read-only calls, local export)
```

Pass `--source-root <deployed checkout>` and `--eligible-at <ISO build time>` to read a specific
deployment snapshot; the default is this checkout and now.

Local real publishing is a recovery tool. Only from clean, up-to-date `master`, with a confirmed
deployment SHA and build time, and never while Actions is publishing (there is no shared lock):

```bash
npm run crosspost -- reserve --source-sha SHA --eligible-at ISO --manifest m.json [--ids ... ]
npm run crosspost -- persist --phase reserve --manifest m.json    # commits, pushes, confirms
npm run crosspost -- execute --manifest m.json
npm run crosspost -- persist --phase results --manifest m.json
```

Do not shortcut the reservation. `medium:export` only produces a local preview.

## Reconciling an uncertain attempt

A `needs-review` record means a request may or may not have created content (lost response, crash,
failed push). Later runs skip it, and a LinkedIn one blocks all automatic LinkedIn shares. Check the
destination (and the run's recovery artifact), then:

```bash
npm run crosspost -- reconcile --article <id> --adapter linkedin --attempt <attemptId> \
  --outcome published --external-id urn:li:share:... --reason "seen on profile" --push
# or --outcome draft; or --outcome not-created (only with positive evidence nothing was created)
```

An empty search or an expired artifact is not proof of non-creation: leave the block in place. A manual
share that is not in the ledger can be recorded by reserving and reconciling it the same way, so that it
consumes the daily allowance.

## Rollout and activation

`pages.yml` ships with `CROSSPOST_FORCE_DRY_RUN: '1'` on the `crosspost` job: every trigger is a dry run
(no API writes, reservations, ledger commits or pushes). To activate:

1. Review a dry-run summary (deployed SHA, eligible articles, batches, blocks).
2. Check `MEDIUM_TOKEN` and `LINKEDIN_ACCESS_TOKEN` work with read-only calls, and that branch rules let
   `github-actions[bot]` push `src/data/crosspost-state.json` to `master` with `GITHUB_TOKEN`.
3. Refresh the baseline for articles that went live since it was captured
   (`node scripts/crosspost-migrate.mjs`, see its header, was the one-off tool), remove the old
   `src/data/linkedin-posted.json` / `medium-posted.json`, and decide the two Medium articles that were
   missing from the old ledger (currently `skipped`; approve backfill by manual run with
   `override_skipped`).
4. In a **separate commit**, delete the `CROSSPOST_FORCE_DRY_RUN` line. Confirm the first publications,
   the committed state and a duplicate-free next run before raising batch limits or adding destinations.

Adding a destination: one adapter in `scripts/lib/crosspost/adapters/`, a registry entry, credentials,
contract tests and a reviewed baseline for that destination (missing state alone would publish the
whole archive).

Medium and LinkedIn credentials: repository secrets `MEDIUM_TOKEN`, `LINKEDIN_ACCESS_TOKEN`; variables
`LINKEDIN_AUTHOR`, optional `MEDIUM_PUBLICATION` and `LINKEDIN_VERSION`. LinkedIn token renewal is manual
(see [`linkedin.md`](linkedin.md)). Publishing secrets are only exposed to trusted `master` runs.
