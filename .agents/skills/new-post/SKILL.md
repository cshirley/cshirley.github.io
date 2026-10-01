---
name: new-post
description: Start a new blog post for this site. Creates the Markdown file with valid front matter (category, tags, description, scheduled date) as a draft, then helps outline it in house style. Use when the user wants to write, start, draft or scaffold a new post or article.
---

# New post

Creates `src/content/posts/YYYY-MM-DD-slug.md` as a draft. Run commands from the repository root.

## 1. Gather the essentials

Ask only for what's missing:

- **Topic and angle:** what happened, and what the reader should take away. The title should
  be a claim, not a topic (see `docs/writing-style.md`).
- **Category:** exactly one of the `CATEGORIES` in `src/data/taxonomy.ts`. It becomes part of the
  URL, so it can't change after publishing.
- **Tags:** up to about five, chosen from `TAGS` in `src/data/taxonomy.ts`. Prefer existing tags.
  Only propose a new tag if nothing fits, and add it to the taxonomy file first.
- **Date:** leave it out to use the next free slot in the schedule (fortnightly Wednesdays,
  09:00 UK time). Check `npm run schedule` if the user cares about timing.

## 2. Create the file

```bash
npm run new-post -- --title "Make the Invoice Service Dumber" --category Payments \
  --tags "SOLID,refactoring,Stripe" \
  --description "One or two sentences, 80-320 characters, saying what the post argues."
```

Optional: `--date YYYY-MM-DD`, `--time HH:MM` (UK local time), `--slug short-slug`. The script
rejects unknown categories or tags and suggests close matches. It refuses duplicate slugs. It
prints the future URL and when the post will go live.

If the description isn't settled yet, leave out `--description`. A TODO placeholder is
written. The build rejects it once the post stops being a draft, so it can't ship by mistake.

## 3. Outline

Replace the placeholder body with an outline following `docs/writing-style.md`:

- An opening with no heading: the situation, what happened, and what this post covers.
- Three to six `##` sentence-case sections.
- `## The general lesson`.

Draft prose only if the user asks. If you do, write in their voice, using the existing posts as
examples, and mark open questions with `TODO`. CI fails on a `TODO` left in a post that isn't a
draft.

## 4. Preview

`npm run dev` serves drafts at http://localhost:4321 with live reload. The URL path is the one
`new-post` printed.

## Rules

- Keep `draft: true` until the user decides to publish. Publishing is the `publish-post` skill.
- Don't invent facts, numbers, employers or quotes. Ask.
- Don't commit unless asked.
