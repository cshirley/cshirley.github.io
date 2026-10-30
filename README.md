# Clive Shirley — personal site

Source for [www.shirleyconsulting.co.uk](https://www.shirleyconsulting.co.uk): profile, experience and writing.
Built with [Astro](https://astro.build) and deployed to GitHub Pages by GitHub Actions.

## Local development

Requires Node.js 22.12+ (see `.nvmrc`).

```bash
npm install
npm run dev       # http://localhost:4321 — live reload, drafts visible
npm run build     # type-check + static build into dist/ (drafts excluded)
npm run preview   # serve dist/

SHOW_DRAFTS=1 npm run build   # production build including drafts, for review
```

## Project layout

| Path | Purpose |
|------|---------|
| `src/data/profile.ts` | Profile content, delivery status and manually reviewed current focus |
| `src/data/work.ts` | Selected-work summaries, contributions, outcomes and optional article ids |
| `src/data/curation.ts` | Selected writing and reading routes; curated articles appear only once live |
| `src/data/lessons.ts` | Curated lesson summaries grouped by problem, linked to original article ids |
| `src/site.ts` | Name, contact links, navigation, analytics ID |
| `src/content/posts/` | Blog posts (Markdown, `YYYY-MM-DD-slug.md`) |
| `docs/features/` | Feature briefs, technical designs and implementation plans; start with [publishing workflow](docs/features/publishing-workflow/brief.md) |
| `src/pages/` | Home, about, writing, contact, 404; `[...path].astro` renders posts |
| `src/components/`, `src/layouts/` | Header, footer, icons, post list, base layout |
| `src/styles/global.css` | Design system (light/dark themes, typography, components) |
| `src/assets/` | Images optimised at build time (portrait) |
| `public/` | Static files copied as-is (legacy post images, favicon, `CNAME`, `robots.txt`) |

## Writing a post

Normal journey: **add → approve → schedule**, then review, commit and push. Building, deploying and
cross-posting follow automatically from `master`.

```bash
npm run post:add -- --title "My Post" --category Engineering --tags "AWS,scaling" \
  --description "One or two sentences for listings, RSS and the post lead."
# write, preview (npm run dev) and review the post
npm run post:approve -- my-post     # records the reviewed content; the post stays a draft
npm run post:schedule -- my-post --next   # or: --date 2026-12-16 --time 09:00 (UK local)
npm run post:status                 # editorial state, go-live times, destination outcomes
```

`post:add` creates `src/content/posts/YYYY-MM-DD-slug.md` as a draft with valid taxonomy and a proposed
date. `post:approve` stores a fingerprint of the reviewed content (title, description, categories,
tags, author, body and referenced local assets, but not the date) in the front matter. Editing any of
that makes the approval stale and blocks release until you approve again. `post:schedule` needs a
current approval and a future date, sets the slot (09:00 UK time by default), clears `draft`, and
prints the URL and UK/UTC go-live time. These commands only edit local files: nothing is active until
the changes are reviewed, `npm run verify` passes and they reach `master`. Hand-editing `draft: false`
does not release a post: `npm run check:approval` fails the build. To edit an approved or scheduled
post, set `draft: true` again and re-approve. That never retracts external copies already published.
Live posts cannot be moved with these commands (their URL contains the date). The front matter looks
like this:

```markdown
---
title: My Post
description: One or two sentences used in listings, RSS and as the post lead.
date: 2026-10-15 09:00:00 +0100
draft: true          # post:schedule clears this
approval:            # written by post:approve
  at: 2026-10-01T09:00:00Z
  fingerprint: sha256:...
categories:
- Engineering
tags: []
---

Markdown content. Raw HTML is fine, and ```mermaid code blocks render as diagrams.
```

House style (British English, structure, voice) is in `docs/writing-style.md`. AI agents: see
`AGENTS.md` and the skills in `.agents/skills/` (new-post, proofread, publish-schedule,
publish-post, medium-crosspost, site-checks). The skills are manual-only: run them with
`/skill:<name>` in Pi or `/<name>` in Claude Code.

Posts are published at `/<categories>/<yyyy>/<mm>/<dd>/<slug>.html`, the URL scheme the old Jekyll
site used, so existing links keep working.

Categories and tags must come from `src/data/taxonomy.ts`. To use a new tag, add it there first.
Posts dated 2016 or later need a `description` of 80–320 characters. The build fails with a clear
message if any of these rules is broken.

## Checks

```bash
npm run verify              # everything CI runs before deploy: spelling, build + the checks below
npm run check:spelling      # cspell (en-GB) + British -ise house style, posts and site copy
npm run check:skills        # agent skills (.agents/skills) and AGENTS.md are valid and up to date
npm run check:curation      # editorial ids and lesson anchors resolve; only live sources enter curation
npm run check:links         # every internal link/image in dist/ resolves (no network)
npm run check:urls          # every URL in urls.snapshot.txt still exists
npm run check:links:drafts  # links in drafts and scheduled posts (builds into dist-drafts/)
npm run urls:update         # record current URLs in urls.snapshot.txt
npm run smoke               # fetch every sitemap URL, feed + Medium copy on the live site (or pass a base URL)
```

Spelling is British English (`cspell.config.yaml`). Code, inline code, HTML tags and link URLs are
skipped. Add correct but unknown words (names, products, jargon) to `cspell-words.txt`. To allow a word in
one post only, add `<!-- cspell:ignore word -->` to it. `-ize`/`-yze` spellings fail
(`scripts/check-spelling-style.mjs`) because the dictionary accepts both forms but the site uses `-ise`.

Run `npm run build && npm run urls:update` and commit `urls.snapshot.txt` after a post goes live,
so its URL is protected from then on. If `check:urls` fails, a published page has moved (usually a
changed category, date or slug). Revert the change or add the old URL to `redirects` in
`astro.config.mjs`.

A pre-commit hook (`.githooks/pre-commit`) runs `npm run verify` before every commit. `npm install` enables
it automatically (the `prepare` script sets `core.hooksPath`). Bypass it in an emergency with
`git commit --no-verify`.

In CI these checks block deploys on push and pull requests. On the daily scheduled rebuild they only
report, so they can't hold back a scheduled post. After every deploy, including scheduled ones, the
smoke test checks the live site.

## Profile and curated writing

Keep selected work in `src/data/work.ts` and reading routes in `src/data/curation.ts`.
Reference article ids, not hard-coded URLs. Curation preserves editorial order and excludes drafts,
unpublished entries and future dates, including in draft previews. Scheduled articles join their
collections automatically once live. The full writing archive keeps its normal preview behaviour.

`/lessons/` is a practical index, not an automatic extract of every closing section. Edit
`src/data/lessons.ts` to add or refine a lesson: one clear takeaway and short summary per article,
grouped by problem, with a unique, stable topic id for its jump link. The page derives article
titles and URLs from post metadata. Both the lesson summary and source link stay hidden until
the article is live, even in draft previews. Tests check source ids, conclusion sections, unique
topic anchors and publication filtering. Original articles and their URLs remain unchanged.

`CURRENT_FOCUS.reviewed` in `src/data/profile.ts` is an editorial review date, not the build date.
Update it when reviewing the work's status. Distinguish delivered changes, proposals and research;
check attribution and outcomes against the project evidence rather than copying résumé claims.

## Search engine indexing

Google finds new posts through `sitemap.xml` (submitted in Search Console). To get a post crawled
sooner, use **URL Inspection → Request indexing** in Search Console.

For Bing and other [IndexNow](https://www.indexnow.org/) engines, each deploy snapshots the live
sitemap first, then submits any new URLs once the deploy is live (`scripts/indexnow.mjs`). The key
file is `public/<key>.txt`; if you change the key, change `KEY` in the script too. To resubmit by hand:

```bash
npm run indexnow -- <url> [<url>...]   # e.g. after a significant edit to a live post
npm run indexnow -- --all              # every URL in the live sitemap
npm run indexnow -- --all --dry-run    # list without submitting
```

## Cross-posting (Medium and LinkedIn)

After a post is live, `pages.yml` submits it to Medium (public publication) and shares a link on
LinkedIn, using the deployed commit's content. State is in `src/data/crosspost-state.json`, one record
per article and destination. Historical articles are recorded as `skipped`, so the archive is never
shared automatically. LinkedIn gets at most one automatic share per UTC day; Medium up to three
articles per run. Uncertain outcomes become durable `needs-review` blocks instead of being retried.
Full day-to-day and recovery guidance: [`docs/publishing.md`](docs/publishing.md); LinkedIn token setup:
[`docs/linkedin.md`](docs/linkedin.md).

`npm run medium:export -- <post>` still makes a local, Medium-friendly export in `medium-export/<post-id>/`
for previewing or pasting (drafts and scheduled posts work too; needs Google Chrome or
`npx playwright-core install chromium`). It never publishes anything. It starts the dev server,
renders the post in headless Chrome and rewrites it using only what Medium supports. Mermaid
diagrams and tables become PNG screenshots. CI does not generate or deploy Medium copies.

## Deployment

Pushing to `master` runs `.github/workflows/pages.yml`, which builds the site and deploys `dist/`
to GitHub Pages. Pull requests are built but not deployed. The repository's
**Settings → Pages → Source** must be set to **GitHub Actions**.

### Cross-posting setup

Add under **Settings → Secrets and variables → Actions**, then check with `gh secret list` and
`gh variable list` (repository level only; the `crosspost` job doesn't use environments):

| Kind | Name | Notes |
|------|------|-------|
| Secret | `MEDIUM_TOKEN` | Existing integration token (Medium no longer issues new ones). Test: `curl -H "Authorization: Bearer $TOKEN" https://api.medium.com/v1/me` |
| Secret | `LINKEDIN_ACCESS_TOKEN` | Member OAuth token with `w_member_social`; expires after about 60 days, renew by hand |
| Variable | `LINKEDIN_AUTHOR` | `urn:li:person:<member-id>` |
| Variable | `MEDIUM_PUBLICATION` | Optional; publication ID, slug or name (currently `notes-from-the-build`). Omit for the personal profile |
| Variable | `LINKEDIN_VERSION` | Optional `YYYYMM`; default `202511`, confirm it is still supported |

```bash
gh secret set LINKEDIN_ACCESS_TOKEN                    # prompts, so the token stays out of shell history
gh variable set LINKEDIN_AUTHOR --body "urn:li:person:<member-id>"
```

`GITHUB_TOKEN` is automatic. No personal access token is needed. `master` must allow
`github-actions[bot]` to push `src/data/crosspost-state.json` directly. LinkedIn token and member id
steps are in [`docs/linkedin.md`](docs/linkedin.md); activation steps are in
[`docs/publishing.md`](docs/publishing.md).
