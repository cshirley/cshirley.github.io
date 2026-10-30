---
name: medium-crosspost
description: Cross-post a live blog post to Medium. Explains the automatic workflow, previews a local Medium export, and handles manual or recovery runs through the shared crosspost workflow. Use when the user wants to publish, syndicate or cross-post a post to Medium.
disable-model-invocation: true
---

# Cross-post to Medium

Medium cross-posting is automatic: after a post is live, the `crosspost` job in
`.github/workflows/pages.yml` creates the story with the canonical link pointing at the original, and
records the status Medium returns in `src/data/crosspost-state.json`. Read `docs/publishing.md` first.
Never create Medium stories by other means and never edit the ledger by hand.

## 1. Preview locally (optional)

Run `npm run medium:export -- <post>` (works for drafts too; needs Chrome). Output goes to
`medium-export/<post-id>/index.html`. Check that:

- Mermaid diagrams and tables came through as images (Medium supports neither natively).
- Code blocks are plain `<pre>` blocks. Headings are reduced to Medium's two sizes.

## 2. Check status

`npm run post:status` shows destination outcomes and unresolved attempts.
`npm run crosspost -- dry-run --destination medium --ids <id>` shows what a run would do (no writes).

## 3. Manual or recovery runs

- Run the **Deploy to GitHub Pages** workflow manually from `master` with `destination=medium`,
  `article_ids=<id>` and `dry_run=false`. Use `override_skipped` only for a historical article the user
  explicitly wants on Medium. Existing Medium drafts are never recreated.
- A `needs-review` record needs reconciliation with `npm run crosspost -- reconcile ...`. See
  `docs/publishing.md`.
- Do not push or trigger real runs without the user's go-ahead.

## Rules

- Never commit `public/medium/` or `medium-export/`. Both are git-ignored.
- Fallback if the API is unavailable: paste `medium-export/<post-id>/index.html` into Medium, add up to
  five tags and set the canonical link to the original URL, then tell the user the ledger needs a
  reconciliation record.
