# Publishing workflow: implementation plan

Status: proposed. No publishing or workflow changes implemented yet.

Feature documents: [Brief](brief.md) · [Design](design.md) · **Plan**.

Repository paths in these documents are relative to the repository root unless stated otherwise.

Implement the [technical design](design.md) against the [brief and acceptance criteria](brief.md#acceptance-criteria). This document owns migration, delivery order, environment prerequisites and verification; it is not an alternate behavioural specification.

## Implementation sequence

1. Implement author add/approve/schedule/status CLI, approval schema/baseline and package script migration with transition tests. Reuse common post helpers, then implement cross-post state schema/transitions, article/live helpers and shared runner with fake-adapter contract tests.
2. Add migration tests; generate and commit the reviewed historical baseline and Medium backfill policy.
3. Extract Medium and LinkedIn adapters; refactor exporter and compatibility wrappers; add deployment identity, allowance and batch tests.
4. Implement durable reservations, reconciliation and persistence steps in `pages.yml`; test crash/failure paths. Extract a composite action only if it simplifies the single workflow.
5. Add manual controls to `pages.yml` in forced dry-run mode, delete `linkedin.yml`, wire tests into `npm run verify` and update documentation/obsolete paths.
6. Run verification and Actions dry run; inspect exact source SHA, eligible articles, batches and summaries. Validate credentials and direct state-write permissions separately.
7. Refresh/approve baseline and enable real publishing through a separate activation commit.
8. Confirm first publications, committed state and duplicate-free subsequent run. Exercise reconciliation before expanding batch limits or adding destinations.

## Migrate history before enabling automation

Add a one-off migration script and review its output:

1. Merge both existing ledgers into the shared format.
2. Convert LinkedIn successes to `published`; preserve Medium's recorded `draft` or `public` status, mapping `public` to `published`.
3. Refresh known historical LinkedIn successes from available Actions logs before removing the old ledger integration. Reconcile additional known shares manually where needed.
4. Capture an agreed historical baseline with source commit and capture time: all articles already live at rollout.
5. For each baseline article without LinkedIn state, write `skipped` with the historical-exclusion reason. This means excluded from automation, not proof it was never shared.
6. Review Medium articles missing from its ledger. Explicitly approve backfill or mark them skipped; do not silently publish an archive backlog.
7. Print remaining eligible articles for both platforms and approve the list before rollout.

Commit the reviewed baseline before enabling automatic publishing. Recheck articles that became live between baseline capture and activation, including posts shared through the old workflow during that interval. Remove the old unattended path before activating the new one. Future articles become eligible through missing adapter state; no permanent cut-off environment variable is needed.

Existing Medium drafts remain untouched. Publishing those drafts is a separate manual task, not a request to create replacement stories.

## Local publishing and rollout

Normal local authoring stops at add/approve/schedule and the normal review/commit/push process. The following local external-publishing path is advanced recovery/operations, not a fourth authoring step.

Local publishing must start from clean, up-to-date `master` and resolve a confirmed deployment snapshot. Do not publish locally while Actions publishing is running. Local and Actions processes do not share a lock, so concurrent local publishing remains an operational restriction. Push reservations before submitting, then commit and push results promptly. A wrapper must not offer an unsafe direct-create shortcut that bypasses reservations.

Retire raw `scripts/linkedin-post.mjs` once no callers remain, or convert it to a non-publishing payload utility. Do not leave an unattended or undocumented second creation path. Remove obsolete separate ledger files after all callers and documentation have migrated. Update `README.md` and `docs/linkedin.md`; correct stale statements about Medium exports being generated during CI.

Roll out through two reviewed workflow changes:

1. Install the new workflow path in dry-run-only mode. Both automatic and manual entry points are forced dry-run; no API writes, reservations, ledger commits or pushes. Read-only API calls and local export generation are allowed and identified in the summary. Inspect exact eligible batches, deployment SHA and current ledger.
2. After baseline, branch permissions and credentials are approved, merge a separate explicit activation commit enabling the real reservation lifecycle. Review any baseline changes since the dry run. Existing drafts and review blocks remain untouched.

No permanent rollout switch is required. Validate real credentials separately through read-only API calls; dry runs cannot prove token validity or publication permissions. Confirm first real publications, committed results and a duplicate-free subsequent run.

## GitHub repository configuration

Set under Settings → Secrets and variables → Actions.

### Secrets

| Name | Purpose |
| --- | --- |
| `MEDIUM_TOKEN` | Existing integration token accepted by Medium's API |
| `LINKEDIN_ACCESS_TOKEN` | Member OAuth access token with `w_member_social` |

Validate Medium API access before rollout. New integration-token availability is restricted; an existing working token is a prerequisite for this approach.

### Variables

| Name | Purpose |
| --- | --- |
| `LINKEDIN_AUTHOR` | `urn:li:person:<member-id>` |
| `MEDIUM_PUBLICATION` | Optional publication ID, slug or name; omit for personal profile |
| `LINKEDIN_VERSION` | Optional supported API version in `YYYYMM` format; explicitly map to job environment if configured |

Current scripts default LinkedIn API version to `202511`. Confirm a supported version at implementation time rather than assuming that default remains valid.

No new cut-off variable, GitHub personal access token or OAuth client credentials are required. `GITHUB_TOKEN` is supplied automatically by Actions, not configured as a repository secret. Scope publishing secrets and write permissions to trusted publishing jobs; pull-request checks do not need them.

Self-serve LinkedIn tokens expire after roughly 60 days and normally require manual renewal. Retain renewal instructions and make authentication failures visible. This plan automates article publishing, not OAuth renewal.

## Verification

Use Node's test runner with mocked destination APIs, injected clock and temporary state/source roots. Add `test:posts` and `test:crosspost` to `package.json` and include both in `npm run verify`, so authoring commits, both persistence phases and CI exercise the tests. Tests must not require credentials, real external writes or an installed browser; mock export preparation separately and add a browser-backed dry-run smoke check in Actions.

Cover:

- Add → approve → schedule transitions, approval fingerprint validation, stale approvals and draft-only approval with no accidental release.
- UK-local date validation, daylight-saving boundaries, next-slot selection, past-date rejection and immutable live URLs.
- Approval baseline preserves existing live/scheduled posts; new posts cannot bypass approval by editing front matter directly.
- Fingerprints change with editorial fields/body/local asset changes but not date-only scheduling changes.
- Pre-live ID/reference updates are safe; moves with external records/reservations fail closed.
- Package scripts expose the intended author/operations surfaces, old callers are migrated and no raw publication aliases remain.
- Migration preserves external IDs, URLs, draft statuses and provenance without overwriting known successes.
- Historical articles become skipped; enabling another adapter requires its own approved baseline.
- Unknown adapter keys survive updates; missing, malformed and unreadable ledgers fail closed.
- Draft, unpublished, future and not-yet-deployed articles are excluded, including posts becoming due after build.
- Newer trunk content does not leak into selection or export for an older deployed snapshot.
- Error pages, wrong canonical identities, wrong response types and unrelated redirects cannot pass live checks.
- Published, draft, skipped and needs-review records are not automatically recreated.
- Oldest-first selection, deterministic ties and per-run limits apply before expensive preparation.
- LinkedIn manual successes consume automatic allowance; unresolved attempts block subsequent articles and later days.
- UTC midnight between reservation and submission cannot reuse a stale allowance.
- Publishing dry runs make no external writes, reservations, ledger commits or pushes, including through compatibility wrappers and manual dispatch; manual Actions runs still complete deployment.
- A minimal fake adapter uses shared selection, policy, persistence and result reporting without destination-specific runner branches.
- Partial platform failure preserves successes and permits another adapter to run; state I/O failure stops all further external writes.
- No creation occurs before reservation push is remotely confirmed; uncertain push outcomes fail closed.
- Crashes before submission, after remote success and before local result save leave durable review blocks.
- Failed final verification/push does not make the next scheduled run recreate affected posts.
- Definitive non-creation failures restore prior state; uncertain failures retain reservations and never trigger blind retries.
- Medium records returned draft status; malformed success responses require review.
- Reservation/result rebase conflicts fail without overwriting remote state or resubmitting.
- Recovery artifact upload is attempted after publisher, verification and persistence failures and contains no credentials.
- Reconciliation requires exact attempt identity, evidence/reason and persisted state before retry.
- Single-workflow trust guards and concurrency, finalisation on failure and forced rollout dry-run mode.
- Manual destination/ID selection, safe input handling, default dry-run and explicit overrides; push/scheduled runs cannot inherit manual overrides.
- Manual runs publish only after their own deployment and smoke test; non-master dispatch is rejected.
- Removed `linkedin.yml` and raw publishing paths cannot remain unattended callers.

Run `npm run verify` before implementation commits. Exercise adapters with mocked API responses, then an Actions dry run. Validate real credentials separately and review branch protection before activation.

## Completion

Confirm the [brief's acceptance criteria](brief.md#acceptance-criteria), mark the feature complete and retain this plan as delivery history. Keep design current when behaviour changes. Once implemented, put day-to-day author/operator guidance in `README.md`, `docs/publishing.md` and `docs/linkedin.md`, linked from these feature documents.
