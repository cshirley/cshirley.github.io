# Publishing workflow: testing plan

Status: stages 1-4 done (including the merged `master` dry run and a manual override dry run on a real article). Stage 5 (activation) is in the activation PR; stages 6-7 follow.

Feature documents: [Brief](brief.md) · [Design](design.md) · [Plan](plan.md) · **Testing**.

Repository paths are relative to the repository root. Operator guidance is in [`docs/publishing.md`](../../publishing.md). This plan sequences checks from no risk to real publication; automated coverage is listed in the [plan's verification section](plan.md#verification).

## Principles

- Move up a stage only when the previous one passes.
- No stage before 6 creates external content. Stages 1-4 write nothing to Medium, LinkedIn or the ledger.
- Never test by editing `src/data/crosspost-state.json` by hand.
- Stop and reconcile (see [`publishing.md`](../../publishing.md#reconciling-an-uncertain-attempt)) if any run leaves a `needs-review` record.

## 1. Automated suite (offline, no credentials)

```bash
npm run verify        # spelling, skills, approval, test:posts, test:crosspost, build, links, URLs
npm run crosspost -- list
```

Pass: `verify` exits 0. `list` shows the queue, allowance and blocks. The queue is empty because the baseline marks every live article as handled. The ledger is unchanged (`git diff src/data/crosspost-state.json`).

## 2. Local dry run against a real article (no writes)

```bash
npm run crosspost -- dry-run --ids <article-id> --override-skipped --eligible-at "$(date -u +%FT%TZ)"
```

This selects a historical article despite its `skipped` record, checks it on the live site and prepares payloads (Medium runs the Chrome export). Provide `MEDIUM_TOKEN` and `LINKEDIN_*` in the environment if you want the configuration check to pass.

Pass:
- Summary names the article, batches and any blocks; exit 0.
- No reservation, ledger change or commit (`git status`, `git diff`).
- With a token unset, the run reports `missing configuration` for that destination only, and the other destination still prepares.
- Try a draft/unknown id and expect a clear failure before any preparation.

## 3. Credential checks (read-only)

| Check | Command | Pass |
| --- | --- | --- |
| Medium token | `curl -s -H "Authorization: Bearer $MEDIUM_TOKEN" https://api.medium.com/v1/me` | JSON with your user |
| Medium publication | `GET /v1/users/<id>/publications` includes `notes-from-the-build` | Found |
| LinkedIn token, author, version | Draft post from [`linkedin.md`](../../linkedin.md#3-test-without-publishing) | `201` (delete the draft afterwards) |

`gh secret list` and `gh variable list` confirm names exist but not that the values work. Also confirm `master` accepts a direct push from `github-actions[bot]` (no branch protection or rulesets at last check).

### 2b. Local end-to-end rehearsal (done, 2026-10-30)

The real CLI (`reserve`, `persist`, `execute`, `persist`) was run in a throwaway clone with a local bare
remote. A preload script stubbed the Medium and LinkedIn APIs (the live site check stayed real and
read-only), and recorded what the remote held at the moment each external POST arrived.

| Scenario | Result |
| --- | --- |
| Happy path, both destinations | Reservations on the remote before either POST; results pushed; both `published` |
| Re-run of the same article | Nothing selected, no API calls |
| LinkedIn daily allowance | A second share the same UTC day was not selected without the explicit bypass |
| LinkedIn HTTP 502 (uncertain) | `needs-review` pushed with the error; execute exit 1; later automatic runs blocked and red |
| Reconcile | Refused without a reason; with evidence it published the record, pushed it and cleared the block |
| Remote unreachable at reservation | `persist` failed and nothing was published; retry pushed the stranded commit; run then completed |

This found two defects, now fixed with tests: an unreachable remote was reported as a "ledger conflict",
and a retry after a failed push refused to push the commit already made. Repeat the rehearsal after any
change to `persist.mjs` or the runner.

## 4. Actions dry run (needs a push)

`pages.yml` shipped with `CROSSPOST_FORCE_DRY_RUN: '1'`, so every trigger was a dry run. Done on `master` (run for `ae2e0cd`: empty queue, no bot commits) and via a manual dispatch with an override on a real article (Chrome export, credentials and live check passed on the runner).

1. Push the branch and open a PR. Build and checks run; `crosspost` does not (master only).
2. After merging, or via a manual run, inspect the job summary:
   ```bash
   gh workflow run pages.yml --ref master -f destination=both -f dry_run=true
   gh run watch
   ```
3. Run a manual dispatch from another branch and expect rejection before deployment.

Pass:
- Deploy and smoke test pass before `crosspost` starts.
- Summary shows the deployed source SHA and eligibility time, an empty queue, no blocks.
- No `[CHORE] Reserve...` or `Record...` commits and no recovery artifact.
- Unexpected inputs (bad destination, IDs with shell characters, overrides without IDs) fail before any step that uses secrets.
- Push and scheduled runs ignore manual inputs.

Optionally repeat with `-f article_ids=<id> -f override_skipped=true` to preview an override batch.

## 5. Activation review (before real publishing)

- Review the dry-run summaries and the committed state: baseline, the two Medium articles currently `skipped`, and any article that went live since the baseline was captured.
- Refresh the baseline for those articles (none went live since it was captured), then remove the old `linkedin-posted.json` and `medium-posted.json`.
- Confirm credentials (stage 3) and branch push permission.
- In a separate commit, delete the `CROSSPOST_FORCE_DRY_RUN` line.

## 6. Controlled real publication

Use a manual dispatch for one article, LinkedIn first (a post can be deleted by hand):

```bash
gh workflow run pages.yml --ref master -f destination=linkedin \
  -f article_ids=<id> -f override_skipped=true -f dry_run=false
```

Pass, in order:
1. A `[CHORE] Reserve cross-posting attempts` commit appears on `master` before the share exists.
2. The share appears on LinkedIn.
3. A `[CHORE] Record cross-posting results` commit records `published` with the share URN.
4. Recovery artifact uploaded; summary lists persistence outcomes.
5. A second identical run does nothing and creates no duplicate.

Repeat for Medium. Check the returned status in the ledger matches what Medium shows (`published` or `draft`), the canonical URL points at the site, and images upload.

Then let one real scheduled or pushed article flow through unattended. Confirm Medium (up to 3 per run) and LinkedIn (1 per UTC day) behave as specified, and that a second article in the same UTC day waits.

## 7. Failure and recovery rehearsal

Rehearse only where harmless; the automated suite already covers these paths.

| Scenario | How | Expected |
| --- | --- | --- |
| Missing LinkedIn secret | Run a dry run with the secret unset on a branch fork or temporarily | `missing configuration`; job red; Medium unaffected |
| Unresolved attempt blocks LinkedIn | Check `npm run post:status` for any `needs-review` | Later LinkedIn runs blocked and reported red |
| Reconcile | `npm run crosspost -- reconcile ... --push` on a test attempt | Record becomes `published`/`draft`/released with a reason; pushed and confirmed |
| Concurrent runs | Trigger two manual runs together | Queue serially (`pages-master` group); no cancellation |
| Expired LinkedIn token | Not rehearsed; expect HTTP 401 treated as not created, reservation released | Job red, no `needs-review` left |

## Completion

Stages 1-6 pass, a real article has been published unattended with a duplicate-free following run, and reconciliation has been tried once. Then mark the feature complete in the [brief](brief.md) and keep this plan as delivery history.
