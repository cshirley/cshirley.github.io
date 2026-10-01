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

## 3. Import (the user does this in a browser)

Give the user these steps:

1. Go to https://medium.com/p/import, paste the **import URL** and click Import.
2. In the draft, check that the images loaded and the code blocks look right.
3. Add up to five tags. Suggest them from the post's category and tags. The copy's
   `<meta name="medium-tags">` already lists the first five.
4. **Story settings → Advanced settings → Customize canonical link:** set it to the
   **original** post URL (`original` in `index.json`), not the `/medium/` copy. This keeps
   search credit with the site.
5. Publish.

## Rules

- Never commit `public/medium/`. It's git-ignored and generated in CI.
- If a live post has no copy, the deploy's "Generate Medium import copies" step probably failed.
  It never blocks the site, but the smoke test reports it. Check the latest Actions run.
