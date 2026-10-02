---
name: medium-crosspost
description: Cross-post a live blog post to Medium through Medium's API (or Import a story as a fallback), with the canonical link kept pointing at the original. Finds the post's import URL, previews the Medium copy and walks through import, tags and canonical settings. Use when the user wants to publish, import, syndicate or cross-post a post to Medium.
disable-model-invocation: true
---

# Cross-post to Medium

CI no longer generates Medium import copies, so there are no `/medium/<post-id>/` URLs on the live site.
Cross-post locally with the API script (step 2), or use `npm run medium -- <post>` for a local export.

## 1. Preview locally (optional)

Run `npm run medium -- <post>` (works for drafts too; needs Chrome). Output goes to
`medium-export/<post-id>/index.html`, which can also be pasted straight into Medium's editor. Check that:

- Mermaid diagrams and tables came through as images (Medium supports neither natively).
- Code blocks are plain `<pre>` blocks. Headings are reduced to Medium's two sizes.

## 2. Cross-post via the Medium API

Needs `MEDIUM_TOKEN` (integration token) in the environment. Never write it to a file or commit it.
Set `MEDIUM_PUBLICATION=notes-from-the-build` (or pass `--publication notes-from-the-build`) to post
into that publication; the user is an editor there, so `--public` publishes directly.

```bash
npm run medium:publish                              # list live posts not yet on Medium
npm run medium:publish -- <post> --dry-run          # show payload, post nothing
npm run medium:publish -- <post>                    # create a Medium DRAFT
npm run medium:publish -- <post> --public           # publish immediately
npm run medium:publish-pending [-- --public]       # every pending post, oldest first
```

The script builds the Medium HTML locally (same as `npm run medium`, needs Chrome), uploads the
images to Medium, then creates the story with `canonicalUrl` set to the original post and the
first five tags. It doesn't need CI or a deploy, but only **live** posts are eligible (the
canonical URL must exist). It defaults to a draft: only use `--public` when the user asks.
Each success is recorded in `src/data/medium-posted.json`, which stops a post going out twice.
Commit that file (`[CHORE] Record Medium cross-post`); don't push without the user's go-ahead.

After a draft is created, tell the user to open the returned URL, check images and code blocks,
then publish from Medium.

### Fallback: manual import

If the API is unavailable: go to https://medium.com/p/import, paste the **import URL** and
Import; add up to five tags; then **Story settings → Advanced settings → Customize canonical
link** and set it to `original` from `index.json`. Add the post to the ledger by hand.

## Rules

- Never commit `public/medium/`. It's git-ignored; CI no longer generates it.
  It never blocks the site, but the smoke test reports it. Check the latest Actions run.
