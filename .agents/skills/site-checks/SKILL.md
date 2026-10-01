---
name: site-checks
description: Run and fix this site's checks. Covers spelling and house style, front matter schema (categories, tags, description), internal links, the published-URL guard and the post-deploy smoke test. Use when verify or CI fails, a build errors on front matter, a link or URL check fails, or the user asks to run the checks before committing.
disable-model-invocation: true
---

# Site checks

Run commands from the repository root. To run everything CI runs before deploy:

```bash
npm run verify
```

Run a single check to iterate faster. Each section below covers one check: what it means and
how to fix it.

## Spelling and house style: `npm run check:spelling`

- **cspell (British English):**
  - Fix real typos.
  - Correct words cspell doesn't know (names, products, jargon) go in `cspell-words.txt`; keep
    it sorted.
  - For one post only, add `<!-- cspell:ignore word -->` to that post.
  - US spellings are wrong here (write colour, not the US form); never add them to the word list.
  - Config: `cspell.config.yaml`. It skips code blocks, inline code, HTML tags and link URLs.
- **`-ize`/`-yze` spellings:** use `-ise`/`-yse` as suggested (`scripts/check-spelling-style.mjs`).
- **"TODO left in a post that is not a draft":** finish the text, or set `draft: true`.

## Front matter: `npm run build`

The schema in `src/content.config.ts` rejects:

- **Unknown or wrongly cased tag:** use the spelling suggested in the error. A genuinely new tag
  goes in `TAGS` in `src/data/taxonomy.ts`.
- **Category not in the list:** use one from `CATEGORIES` in `src/data/taxonomy.ts`. Don't
  change the category of a live post: it's part of the URL.
- **Description too short or too long:** it must be 80 to 320 characters.
- **Description missing:** required for posts dated 2016 or later.
- **TODO description:** replace it before removing `draft: true`.

## Internal links: `npm run check:links` and `npm run check:links:drafts`

These check every same-site link and image in the build (`dist/`) or in the drafts build
(`dist-drafts/`). A broken link is usually one of:

- a typo in the path;
- a link to a post that's a draft or scheduled (not built yet);
- an image missing from `public/assets/`.

Post URLs are `/<category>/<yyyy>/<mm>/<dd>/<slug>.html`. Find the right one with
`npm run schedule -- --json`, or look it up in `dist/sitemap.xml`.

## Published URLs: `npm run check:urls`

Every URL in `urls.snapshot.txt` must still exist. A failure means a published page has moved,
usually because a live post's category, date or slug changed. Either:

- revert the change (preferred); or
- add the old path to `redirects` in `astro.config.mjs` (for example
  `'/old/2025/01/01/slug': '/new/2025/01/01/slug.html'`). Then rebuild and re-run the check.

Run `npm run urls:update` only when a URL is meant to disappear for good, or to record a newly
live post. It refuses builds that contain drafts.

## Smoke test: `npm run smoke [base-url]`

This runs in CI after each deploy against the live site. It fetches every sitemap URL, the feed
and each Medium copy listed in `/medium/index.json`. To run it locally, build, start
`npx astro preview --port 4399` in a separate terminal, then run:

```bash
npm run smoke -- http://localhost:4399
```

The local run only finds Medium copies if `npm run medium -- --all --live --publish` ran before
the build.

"No Medium copy" means the Medium export step failed or was skipped. The `medium-crosspost`
skill explains how the copies are generated.

## Rules

- Fix the cause; don't weaken a check to make it pass. Changing check config (word list
  aside) or taxonomy limits needs the user's agreement.
- In CI, post-build checks only warn on the daily scheduled rebuild. On push and pull requests
  they block the deploy.
