# Writing style

House style for posts in `src/content/posts/`, taken from the 30 posts published since 2025.
Use it when drafting, proofreading or editing a post. **Keep the author's voice:** suggest
changes, don't rewrite whole passages.

Some rules are checked automatically (`npm run check:spelling`, `npm run build`). The rest need
judgement and are covered by the `proofread` skill.

## Spelling and punctuation

- **British English.** Use `-ise` (organise, authorisation, optimise), `-our` (behaviour,
  favour), `-re` (centre), `-ll-` (modelling, cancelled), and *programme*, *licence* (noun),
  *fulfil*. `-ize` and US spellings fail CI.
- **Both *judgment* and *judgement* are accepted.** Pick one per post and use it throughout.
- **No em dashes (—) in prose.** 28 of the last 30 posts have none. Use a colon, a comma,
  parentheses or a new sentence instead. Inside tables and code, dashes are fine.
- **Straight quotes in the source** (`'` and `"`). The site renders curly quotes.
- **Use the Oxford comma** where it helps clarity. The posts use it often.
- **Numbers:** prefer words for one to nine in prose. Use digits for measurements, percentages,
  counts in technical lists and anything technical (`3 pods`, `50%`, `2 TB`). Leave out
  confidential figures such as revenue or savings.
- **Write proper names correctly:** Stripe, PostgreSQL or Postgres, Kubernetes, HL7 FHIR (then
  FHIR), AWS, GitHub, TypeScript, Node.js, Neovim, tmux.

## Titles, headings and description

- **Title** in Title Case and quoted in front matter. Make it a claim or a lesson, not a topic:
  "Make the Invoice Service Dumber", "Pause Is Not a Status: Modelling Holds as Overlays".
  Use a colon to add a subtitle when the claim needs context.
- **Headings** are `##` (and `###` below that) in sentence case: "## What the service did",
  "## Things to get right". Don't use `#`, because the page title is already the h1.
- **Description:** one or two sentences, 80 to 320 characters (enforced). It appears as the lead
  under the title, in listings and in RSS. Say what the post argues and who it helps; don't
  repeat the title.

## Structure

Most posts follow this shape:

1. **Opening (no heading):** two to four short paragraphs. Start from the situation or a common
   belief ("Most payment code starts small…"). Then say what happened ("This autumn I
   reviewed…") and what the post covers ("This post covers how we closed that race, and why…").
   Bold the one-line question or claim the post answers.
2. **Body:** three to six `##` sections, each covering one step of the argument. Common shapes:
   the setup, then the options, then why we chose this, then how, then things to get right.
3. **Close:** `## The general lesson` (26 of the 30 posts), or `## The general lessons` as a
   short numbered list. One paragraph saying what the reader can apply elsewhere. Bold the
   transferable idea.

Typical length is 550 to 1,000 words. Longer is fine for setup and how-to posts, but tighten
anything over 1,500 words.

## Voice

- **First person.** Use "I" for my own decisions and writing, and "we" for the team. Be concrete
  about context ("a healthcare platform", "a UK telehealth service") without naming employers
  or confidential figures.
- **Plain and direct.** Short sentences. Back claims with a specific example, number or failure
  mode. Avoid hype words (game-changing, revolutionary, seamless) and filler (basically, simply,
  just, very).
- **Be honest about trade-offs:** what we discounted and why, what we'd do differently, and
  what we deliberately didn't build.
- **Emphasis:** `**bold**` for the key term or claim (sparingly, about one per section) and
  `*italics*` for stress or a term being defined.

## Formatting

- **Code:** fenced blocks with a language (` ```ts `, ` ```bash `). Inline code for identifiers,
  commands, headers and status values (`on-hold`, `If-None-Exist`).
- **Diagrams:** ` ```mermaid ` blocks. They render on the site and become images on Medium.
  Prefer a diagram to a long description of a flow.
- **Tables:** for comparisons of options or before and after. They also become images on Medium.
- **Images:** put them in `public/assets/` and reference them as `/assets/name.jpg` with
  meaningful `alt` text. Use a `<figure>` with a `<figcaption>` when a caption helps.
- **Links:** link to other posts by their site path (`/architecture/2025/07/02/….html`). Use
  external links for primary sources only.
