---
name: medium-crosspost
description: Cross-post a live blog post to Medium using Medium's Import a story, with the canonical link kept pointing at the original. Finds the post's import URL, previews the Medium copy and walks through import, tags and canonical settings. Use when the user wants to publish, import, syndicate or cross-post a post to Medium.
disable-model-invocation: true
---

# Cross-post to Medium

Medium's importer only reads a public URL. CI therefore builds a Medium-friendly copy of every
**live** post on each deploy, at `https://www.shirleyconsulting.co.uk/medium/<post-id>/`.
There is nothing to generate or commit.

Drafts and scheduled posts have no copy until they go live.

## 1. Find the import URL

```bash
curl -s https://www.shirleyconsulting.co.uk/medium/index.json
```

Each entry has `id`, `title`, `import` (the URL to give Medium) and `original` (the canonical
post). If the post is missing, it isn't live yet. Check with `npm run schedule`.

## 2. Preview the copy

Open `<import URL>?preview`. Without `?preview` the page redirects people to the original
post; Medium's importer doesn't run JavaScript, so it reads the copy. Check that:

- Mermaid diagrams and tables came through as images (Medium supports neither natively).
- Code blocks are plain `<pre>` blocks. Headings are reduced to Medium's two sizes.

To preview locally, including drafts, run `npm run medium -- <post>`. Output goes to
`medium-export/<post-id>/index.html`, which can also be pasted straight into Medium's editor.

## 3. Cross-post via the Medium API

Needs `MEDIUM_TOKEN` (integration token) in the environment. Never write it to a file or commit it.

```bash
npm run medium:publish                              # list live posts not yet on Medium
npm run medium:publish -- <post> --dry-run          # show payload, post nothing
npm run medium:publish -- <post>                    # create a Medium DRAFT
npm run medium:publish -- <post> --public           # publish immediately
npm run medium:publish -- --all-pending [--public]
```

The script posts the hosted copy's HTML with `canonicalUrl` set to the original post and the
copy's first five tags. It defaults to a draft: only use `--public` when the user asks.
Each success is recorded in `src/data/medium-posted.json`, which stops a post going out twice.
Commit that file (`[CHORE] Record Medium cross-post`); don't push without the user's go-ahead.

After a draft is created, tell the user to open the returned URL, check images and code blocks,
then publish from Medium.

### Fallback: manual import

If the API is unavailable: go to https://medium.com/p/import, paste the **import URL** and
Import; add up to five tags; then **Story settings → Advanced settings → Customize canonical
link** and set it to `original` from `index.json`. Add the post to the ledger by hand.

## Rules

- Never commit `public/medium/`. It's git-ignored and generated in CI.
- If a live post has no copy, the deploy's "Generate Medium import copies" step probably failed.
  It never blocks the site, but the smoke test reports it. Check the latest Actions run.
