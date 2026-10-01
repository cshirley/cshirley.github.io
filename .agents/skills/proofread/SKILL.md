---
name: proofread
description: Proofread and edit a blog post against the site's house style. Covers British spelling, grammar, clarity, structure, title, headings and description, links and alt text, keeping the author's voice. Use when the user asks to proofread, review, check, edit, tighten or polish a post or draft before publishing.
---

# Proofread a post

Use this skill for the judgement calls. Automated checks cover spelling and front matter. Run
commands from the repository root.

## 1. Run the automated checks first

```bash
npm run check:spelling
```

Fix real typos. If a flagged word is correct (a name, product or jargon), add it to
`cspell-words.txt` (keep it sorted). If it's correct in one post only, add
`<!-- cspell:ignore word -->` to that post. Never add a US spelling to the word list.

## 2. Read the house style

Read `docs/writing-style.md` in full. Read one or two recent posts in `src/content/posts/` for
voice.

## 3. Review the post

Read the whole post, then check each item. Note the line number of every finding.

**Correctness**
- Spelling and grammar that cspell can't see: wrong word (their/there, affect/effect),
  agreement, tense drift, missing words, repeated words.
- Proper names written correctly (Stripe, PostgreSQL, Kubernetes, HL7 FHIR, GitHub…).
- Facts that look wrong or inconsistent within the post (numbers, dates, names). Flag them;
  don't fix them.

**House style**
- British spelling. One of *judgment*/*judgement* per post.
- No em dashes in prose. Suggest a colon, a comma, parentheses or a new sentence.
- Title: Title Case, a claim, not a topic.
- Headings: `##`, sentence case, and they read as a sequence that tells the story.
- Description: 80 to 320 characters, says what the post argues, doesn't repeat the title.
- Opening says what the post covers. The close is `## The general lesson` and gives a
  transferable takeaway.

**Clarity**
- Long sentences (over about 35 words) that should be split.
- Filler and hedging (basically, simply, just, very, quite, really, in order to).
- Hype words. Passive voice that hides who did what.
- Paragraphs that make more than one point.
- Repetition: the same point made in two sections.
- Jargon a reader outside the team wouldn't know, left unexplained.
- Over 1,500 words: suggest what to cut.

**Formatting and links**
- Code blocks have a language. Identifiers and commands are in inline code.
- Images have meaningful `alt` text.
- Internal links use site paths that exist. `npm run build && npm run check:links` confirms this.
- Nothing confidential: employer names where the post avoids them, revenue or savings figures,
  internal URLs, credentials.

## 4. Report, then edit

Present the findings grouped as **Must fix** (errors), **Should fix** (house style, clarity) and
**Consider** (taste). For each, show the line, the current text, the proposed text and a short
reason.

Apply edits only after the user agrees. Keep the author's voice: change the fewest words that
fix the problem, and never rewrite a whole paragraph unless asked.

After editing, run `npm run check:spelling` again. Run `npm run build` if front matter changed.
