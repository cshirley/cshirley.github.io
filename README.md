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

Create `src/content/posts/YYYY-MM-DD-my-post.md`:

```markdown
---
title: My Post
description: One-sentence summary used in listings, RSS and social cards.
date: 2026-10-15 09:00:00 +0100
draft: true          # remove (or set false) to publish
categories:
- Engineering
tags: []
---

Markdown content. Raw HTML is fine, and ```mermaid code blocks render as diagrams.
```

Posts are published at `/<categories>/<yyyy>/<mm>/<dd>/<slug>.html`, the URL scheme the old Jekyll
site used, so existing links keep working.

## Deployment

Pushing to `master` runs `.github/workflows/pages.yml`, which builds the site and deploys `dist/`
to GitHub Pages. Pull requests are built but not deployed. The repository's
**Settings → Pages → Source** must be set to **GitHub Actions**.
