---
title: "Right-Size Every Token: The Pi Utilities That Keep an Agent Workflow Affordable"
description: "Token pruning, native REST tools that skip the model, a three-tier agent budget, and the small terminal extensions (vi mode, statusline, notify, theme) that make a Pi workflow comfortable all day."
date: 2026-10-05 10:40 +0100
categories:
- AI
tags:
- Pi
- agentic engineering
- developer experience
- tooling
author:
  display_name: Clive Shirley
---

This post is part of my [Pi workflow series](/ai/2026/05/06/ai-native-workflow-with-pi.html), which starts with the overall picture of how I run my working day inside Pi. This part covers the utilities and the budget that keep the workflow cheap and comfortable.

**Spend the expensive model where it reasons, and spend nothing where a plain API call will do.**

## The token pruner

The single most impactful extension for cost control. It attacks token usage from both sides:

**Input pruning** (60–80% savings):
- *Strategy A: truncate at source*: When a tool result exceeds configured byte limits (bash: 10KB, read: 20KB, grep/find/ls: 5KB), it's truncated *before* entering the context window. A notice tells the LLM what was trimmed and how to re-read with `offset`/`limit`.
- *Strategy B: stub old turns*: Before each LLM call, tool results older than 3 turns are replaced with one-line stubs like `[bash output: 150 lines, pruned from older turn]`. The stored session is unchanged; this runs on a deep copy.

**Output pruning** (~75% savings):
A system-prompt injection instructs the LLM to maximise information density. At **ultra** level: abbreviations, arrows for causality, fragments OK. `"Inline obj prop → new ref → re-render. useMemo."` Code, file paths, error messages, and config values are never compressed: only natural-language explanations.

Safety guardrails auto-expand to full verbosity for security warnings, irreversible-action confirmations, or when I appear confused.

## Tool integrations

A declarative framework for native API tools. Each tool is ~25 lines via `defineTool()`:

```typescript
export default defineTool({
  name: "jira-search",
  params: { jql: "string", maxResults: "number" },
  async execute(p) { /* native REST call */ },
  mcp: { server: "atlassian", tool: "searchJiraIssuesUsingJql", ... },
  format(result) { return { text: `Found ${result.length} issues` }; },
});
```

The framework generates TypeBox schemas from `params`, wires a provider chain (native REST first, MCP fallback), and calls `format()` once regardless of which provider succeeded. Currently covers:

| Service | Tools |
|---|---|
| **Jira** | search, get (native → Atlassian MCP fallback) |
| **Gmail** | search, get, thread (native OAuth → Google Workspace MCP fallback) |
| **Calendar** | list events (native OAuth → MCP fallback) |
| **Slack** | search, unread, DM history, channel history, user info, conversations (native REST, no MCP) |

Per-service setup via `/jira-setup`, `/slack-setup`, `/google-setup`.

## The journal

Domain-specific tools for my PARA-style work journal (`work-journal.md`). Three tools: `journal-read-entry` (structured parse of a date's sections, frontmatter, guard check), `journal-carry-over` (daily or weekly open-item computation with dedup and recency badges), and `journal-write-entry` (create/update daily entries, merge sections, update frontmatter). These tools power the morning and evening skills described below.

## The subagent extension

Spawn isolated pi subprocesses with separate context windows. Discovers agents from `~/.config/pi/agent/agents/` (user-level) and `.pi/agents/` (project-level), with project agents overriding user agents by name. Each subagent runs in its own process with its own token budget, the orchestrator only sees a structured return packet.

## Vi mode

A custom `ModalEditor` that intercepts keystrokes and implements vim-like modal editing directly in pi's input area. `Escape` switches to NORMAL mode; motions (`h j k l w b e 0 $ ^ gg G`), operators (`d c` with `w b $ 0` targets, `dd cc`), edits (`x X D C S J u p`), and mode switches (`i a I A o O`) all work. A mode indicator (`NORMAL` / `INSERT` + pending operator) renders in the bottom-right of the input area.

It's not full vim (no count prefixes, no visual mode, no registers) but it covers 90% of my editing muscle memory. For the rest, `Ctrl+G` opens `$EDITOR` (neovim).

## The statusline

A p10k-lean-style three-line footer:

```
~/.config/pi/agent  main
 |  claude-opus-4.6  [▓▓▓░░░░░░░] 72%  45.2k/200.0k tok  🌳 2 worktrees  $0.3842  14:32:07
 |  ✂ 15.2KB truncated, 5 stubs  🔥 terse ULTRA
```

- **Line 1**: Directory (with `~` shortening) + git branch + mode tag (plan mode, etc.)
- **Line 2**: Model name + context bar (green ≥50%, amber <50%, red <20%) + token count + extension statuses + cumulative cost + clock
- **Line 3**: Token-pruner stats (truncation + stub counts, output compression level)

The context bar turns red and shows a `🔥` overage warning when tokens exceed the 200k standard window (where providers charge a 1.25× multiplier). It's the financial dashboard I check reflexively.

## Notify

Sends an OSC 9 terminal notification when the agent finishes and awaits input. Handles tmux passthrough via DCS escape + direct client tty write. Simple, essential, I often switch to another tmux pane while the agent works, and the bell brings me back when it's ready.

## The token economy

The tiered model strategy handles the macro economics, reasoning tier for deep analysis, workhorse for standard execution, lightweight for mechanical tasks, native REST for data fetching. All configurable from a single `subagent-config.json`. The token-pruner extension handles the micro economics, squeezing waste out of every individual call.

### The tools extension: zero-token API calls

The biggest cost saving isn't in the pruner, it's in the `tools/` extension. Every Jira search, Gmail query, Slack history fetch, and Calendar lookup is a native HTTP call that returns structured data directly to the agent's context. No LLM interprets the API response; no MCP server translates it. The `defineTool()` framework wires auth gating, a provider chain (native first, MCP fallback), and a `format()` function that runs once regardless of which provider succeeded.

The morning skill alone makes ~15 parallel API calls across four services. At Opus token prices, having the LLM make those calls via function-calling would cost significantly more than having the tools extension handle them as plain HTTP requests. The LLM receives pre-formatted results and reasons over them: it never sees raw API payloads.

### Input budget

Per-tool byte limits control what enters the context:

| Tool | Limit | Direction | Rationale |
|---|---|---|---|
| `bash` | 10 KB | Tail (keep end) | Exit codes and errors appear last |
| `read` | 20 KB | Head (keep start) | Imports and declarations appear first |
| `grep` | 5 KB | Head | First matches are usually most relevant |
| `find` | 5 KB | Head | First results suffice for discovery |
| `ls` | 5 KB | Head | Directory listing is front-loaded |

The 3-turn recency window means that by the time the agent is 4 interactions deep, early tool results are compressed to stubs. Combined with truncation at source, a typical session uses 60–80% fewer input tokens than it would without pruning.

Error results are *never* truncated, the LLM needs full diagnostics to self-correct.

### Output budget

At **ultra** compression, the system-prompt injection produces responses like:

> `Inline obj prop → new ref → re-render. useMemo.`

Instead of:

> "Sure! The issue here is that you're creating a new object reference on every render by defining the prop inline. This causes the child component to re-render unnecessarily. You can fix this by wrapping the value in `useMemo`."

The savings are dramatic. An ultra-compressed explanation is typically 3-4× shorter than a normal one, with no information loss for an experienced developer.

### The statusline as a financial dashboard

The context bar in the statusline provides real-time cost awareness:

- **Green** (≥50% remaining): Plenty of context budget. Work freely.
- **Amber** (<50% remaining): Getting expensive. Consider `/clear` or starting a new session.
- **Red** (<20% remaining): In the overage zone. Tokens past 200k incur a 1.25× multiplier. The `🔥` indicator shows exactly how much overage.

Cumulative session cost is always visible (e.g. `$0.3842`). Between this and the pruner, I can run Opus 4.6 all day without cost anxiety.

## The Dracula theme

A full semantic theme covering every pi surface: syntax highlighting (pink keywords, green functions, yellow strings, purple numbers, cyan types), markdown rendering (orange headings, cyan links, green code), diff colours, tool result backgrounds (green tint for success, red tint for errors, purple tint for custom messages), and (my favourite detail) **thinking-level gradients**:

| Level | Colour |
|---|---|
| Off | Dim grey (`#545978`) |
| Minimal | Comment blue (`#6272a4`) |
| Low | Cyan (`#8be9fd`) |
| Medium | Purple (`#bd93f9`) |
| High | Pink (`#ff79c6`) |
| X-High | Red (`#ff5555`) |

When the model is thinking hard, the indicator glows pink. When it's barely thinking, it fades to grey. It's a small thing, but it gives an intuitive sense of how much cognitive budget the model is spending on each response.

## The general lesson

Treat tokens as a budget and the terminal as a place you live. **Truncate input at the source, compress output, and route data fetching around the model altogether.** The comfort extensions then make the cheap setup pleasant enough to use all day.
