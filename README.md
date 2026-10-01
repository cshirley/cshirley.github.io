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
| `src/data/profile.ts` | Profile content: intro, impact metrics, focus areas, principles, experience, stack (from the résumé) |
| `src/site.ts` | Name, contact links, navigation, analytics ID |
| `src/content/posts/` | Blog posts (Markdown, `YYYY-MM-DD-slug.md`) |
| `src/pages/` | Home, about, writing, contact, 404; `[...path].astro` renders posts |
| `src/components/`, `src/layouts/` | Header, footer, icons, post list, base layout |
| `src/styles/global.css` | Design system (light/dark themes, typography, components) |
| `src/assets/` | Images optimised at build time (portrait) |
| `public/` | Static files copied as-is (legacy post images, favicon, `CNAME`, `robots.txt`) |

## Writing a post

```bash
npm run new-post -- --title "My Post" --category Engineering --tags "AWS,scaling" \
  --description "One or two sentences for listings, RSS and the post lead."
npm run schedule                                   # what's queued, real go-live times, next free slot
npm run schedule -- --move my-post 2026-12-16      # reschedule a post that isn't live yet
```

`new-post` creates `src/content/posts/YYYY-MM-DD-slug.md` as a draft. It validates the category
and tags, defaults the date to the next free fortnightly Wednesday at 09:00 UK time, and prints
the URL and go-live time. Remove `draft: true` to publish. A post with a future date goes live at
the first build after that date: the daily rebuild, or an earlier push. The front matter looks
like this:

```markdown
---
title: My Post
description: One or two sentences used in listings, RSS and as the post lead.
date: 2026-10-15 09:00:00 +0100
draft: true          # remove (or set false) to publish
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

In CI these checks block deploys on push and pull requests. On the daily scheduled rebuild they only
report, so they can't hold back a scheduled post. After every deploy, including scheduled ones, the
smoke test checks the live site.

## Cross-posting to Medium

Medium's [Import a story](https://medium.com/p/import) only accepts a public URL, so the site hosts a
Medium-friendly copy of each post for the importer to read. CI generates them on every deploy
(`npm run medium -- --all --live --publish`), so there is nothing to run or commit. Each live post
has a copy, and a scheduled post gets its copy on the day it goes live. Drafts and scheduled posts
never get one, so their content isn't published early.

1. Once the post is live, import its copy at medium.com/p/import:
   `https://www.shirleyconsulting.co.uk/medium/<post-id>/`. All import URLs are listed at
   [`/medium/index.json`](https://www.shirleyconsulting.co.uk/medium/index.json).
2. In the Medium draft, check the images and add up to 5 tags. Under **Story settings → Advanced
   settings → Customize canonical link**, make sure the canonical link is the original post, not the
   `/medium/` copy.
3. Publish.

`public/medium/` is git-ignored. After each deploy, the smoke test checks that every live post has a
copy.

`scripts/medium-export.mjs` starts the dev server, renders the post in headless Chrome and rewrites
it using only what Medium supports: h3/h4 headings, plain `<pre>` code blocks, figures and absolute
links. Mermaid diagrams and tables become PNG screenshots, because Medium supports neither. The copy
has a canonical link to the original post and sends human visitors there (Medium's importer doesn't
run JavaScript). Add `?preview` to the URL to view the copy itself. It isn't listed in the sitemap.

Without `--publish`, the export goes to the git-ignored `medium-export/<post-id>/` with relative
images, for previewing locally or copying and pasting into the Medium editor:
`npm run medium -- payment-close-to-shipment` (a file id, slug, or unique part of one). Drafts and
scheduled posts can be exported this way. Needs Google Chrome, or a Playwright Chromium
(`npx playwright-core install chromium`).

## Deployment

Pushing to `master` runs `.github/workflows/pages.yml`, which builds the site and deploys `dist/`
to GitHub Pages. Pull requests are built but not deployed. The repository's
**Settings → Pages → Source** must be set to **GitHub Actions**.
