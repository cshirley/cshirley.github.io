# AGENTS.md

Guidance for AI coding agents working in this repository. Humans: see `README.md`.

This is Clive Shirley's personal site and blog (https://www.shirleyconsulting.co.uk). It's an
Astro static site, deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to
`master` and once a day by cron, which publishes scheduled posts.

## Skills

Task workflows live in `.agents/skills/` (Agent Skills format; also linked from
`.claude/skills/`).

**Skills are manual-only for now.** Use a skill only when the user invokes it (Pi:
`/skill:<name>`; Claude Code: `/<name>`) or explicitly asks for it by name. Then read its
`SKILL.md` and follow it. Don't apply a skill on your own initiative. If one would help,
suggest it. Each skill sets `disable-model-invocation: true`, and `npm run check:skills`
enforces it.

| Task | Skill |
|------|-------|
| Start a new post | `.agents/skills/new-post/SKILL.md` |
| Proofread or edit a post | `.agents/skills/proofread/SKILL.md` |
| See or change what's scheduled | `.agents/skills/publish-schedule/SKILL.md` |
| Publish a post (draft to live) | `.agents/skills/publish-post/SKILL.md` |
| Cross-post to Medium | `.agents/skills/medium-crosspost/SKILL.md` |
| Run checks or fix a CI failure | `.agents/skills/site-checks/SKILL.md` |

## Commands

Requires Node.js 22.12+ (`.nvmrc`). Run commands from the repository root.

```bash
npm run dev              # http://localhost:4321, drafts visible
npm run verify           # everything CI checks before deploy; also runs in the pre-commit hook (npm install enables it)
npm run post:add -- --title "..." --category <Category> [--tags "a,b"] [--description "..."]
npm run post:approve -- <post>          # record reviewed content; stays a draft
npm run post:schedule -- <post> --next  # or --date YYYY-MM-DD [--time HH:MM]; clears draft
npm run post:status      # queued posts, go-live times, destination outcomes
npm run medium:export -- <post>   # local Medium-friendly export (never publishes)
npm run crosspost -- list         # advanced: cross-post queue (see docs/publishing.md)
```

## Conventions

- **Posts:**
  - Files are `src/content/posts/YYYY-MM-DD-slug.md`.
  - The front matter schema is in `src/content.config.ts`.
  - Categories and tags must come from `src/data/taxonomy.ts`.
  - Set the optional `updated:` date after a substantive edit to a live post; it feeds sitemap
    `lastmod` only (the URL keeps using `date`).
  - The URL is `/<category>/<yyyy>/<mm>/<dd>/<slug>.html`, so **never change the category,
    date or slug of a live post** without adding a redirect in `astro.config.mjs`.
    `npm run check:urls` enforces this.
- **Drafts and scheduling:**
  - `draft: true` hides a post from production builds.
  - A post with a future `date` is scheduled and appears at the first build after that date.
  - Release needs approval: non-draft posts must be approved and unchanged since approval
    (`npm run check:approval`), unless listed in `src/data/approval-baseline.json`.
- **Cross-posting:** automatic, from `.github/workflows/pages.yml` only. Never publish to Medium or LinkedIn by other
  means, never edit `src/data/crosspost-state.json` by hand, and never invoke `npm run crosspost --
  reserve|execute|persist|reconcile` without the user's explicit go-ahead. See `docs/publishing.md`.
- **Writing:**
  - Follow `docs/writing-style.md`: British English, no em dashes in prose, and a closing
    `## The general lesson`.
  - Keep the author's voice. Suggest edits; don't rewrite.
  - Don't invent facts, figures or quotes.
- **Generated, never commit:** `dist/`, `dist-drafts/`, `public/medium/`, `medium-export/`,
  `.astro/`.
- **Commits:** one line, `[FEATURE] …`, `[FIX] …` or `[CHORE] …`, imperative mood. Run
  `npm run verify` first.
- **Don't push** to `master` without the user's explicit go-ahead. Pushing deploys the live site.

## Layout

| Path | Purpose |
|------|---------|
| `src/content/posts/` | Blog posts (Markdown) |
| `src/data/taxonomy.ts` | Allowed categories and tags, description rules |
| `src/data/profile.ts`, `src/site.ts` | Profile content, site name, navigation |
| `src/pages/`, `src/components/`, `src/layouts/` | Astro pages and components |
| `public/assets/` | Post images (referenced as `/assets/…`) |
| `scripts/` | Authoring scripts, checks, smoke test, Medium exporter |
| `docs/writing-style.md` | House style for posts |
| `docs/publishing.md` | Publishing and cross-posting workflow, recovery, rollout |
| `docs/linkedin.md` | LinkedIn sharing setup, token renewal |
| `src/data/crosspost-state.json` | Cross-post ledger (managed by the workflow) |
| `cspell.config.yaml`, `cspell-words.txt` | Spell check config and accepted words |
| `urls.snapshot.txt` | Published URLs that must keep working |
