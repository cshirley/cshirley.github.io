---
name: publish-post
description: Take a blog post from draft to live, or schedule it. Covers pre-flight checks, removing the draft flag, committing, pushing, watching the deploy, confirming the post is live and protecting its URL afterwards. Use when the user wants to publish, ship, release, schedule or go live with a post.
disable-model-invocation: true
---

# Publish a post

Run commands from the repository root. Pushing to `master` deploys the site. Get the user's
explicit go-ahead before pushing.

## 1. Pre-flight

1. Find the post: `src/content/posts/YYYY-MM-DD-slug.md`.
2. Check the date. If it's in the future, the post is **scheduled**, not published now (see the
   `publish-schedule` skill for when it appears). If the user wants it out now, move it to today
   while it's still a draft: `npm run schedule -- --move <post> <YYYY-MM-DD>`. This updates the
   filename and date together. The time stays 09:00 UK. If that hasn't passed yet, the post
   appears at the first build after 09:00.
3. Make sure no placeholders are left: `TODO` in the description or the prose.
4. If the post hasn't been proofread, suggest the user runs the `proofread` skill first.

## 2. Remove the draft flag

Delete the `draft: true` line, or set it to `false`.

## 3. Verify

```bash
npm run verify
```

This runs the spelling and house-style checks, the build (front matter schema), internal links,
the published-URL guard and links in drafts. If a check fails, stop and report it. Fix it if
the cause is in this post. Otherwise the user can run the `site-checks` skill. Don't skip
checks.

## 4. Commit and push

Commit only this post's file, plus any images in `public/assets/` and taxonomy or word-list
additions it needs. Use the repo's commit style:

```bash
git add src/content/posts/YYYY-MM-DD-slug.md public/assets/<images>
git commit -m "[FEATURE] Add post: <title>"
git push origin master
```

## 5. Watch the deploy

If the GitHub CLI is available:

```bash
gh run list --limit 1                 # find the run for your commit
gh run watch <run-id> --exit-status
```

Otherwise check the repository's Actions tab. The workflow ends with a smoke test of the live
site. The post is live when the run is green.

## 6. After it's live

1. **Protect the URL.** Only after the post is actually live (for a scheduled post, after its
   go-live run), so the snapshot doesn't record unpublished URLs:
   ```bash
   npm run build && npm run urls:update
   git add urls.snapshot.txt && git commit -m "[CHORE] Protect URL: <slug>" && git push
   ```
   `urls:update` refuses if the build contains drafts. Rebuild without `SHOW_DRAFTS`.
2. **Cross-post.** Tell the user they can run the `medium-crosspost` skill.

## Rules

- Never push without the user's go-ahead. Never force-push.
- Never commit `dist/`, `dist-drafts/`, `public/medium/` or `medium-export/` (they're generated).
- If CI fails after pushing, the site isn't deployed. Fix forward with another commit.
