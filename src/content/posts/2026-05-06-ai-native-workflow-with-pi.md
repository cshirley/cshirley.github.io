---
title: "Building an AI-Native Development Workflow with Pi"
description: "Eleven extensions, six skills, eighteen agents and a token budget: how I rebuilt my whole working day inside a terminal-first coding agent, from morning briefing to verified pull request."
date: 2026-05-06 09:00:00 +0100
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

Most developers bolt an AI assistant onto their existing toolchain — a chat sidebar here, a copilot tab-completion there. I went the other way. Over the past few months I've rebuilt my entire development workflow *inside* [pi.dev](https://pi.dev), a terminal-first coding agent, turning it into a unified system that handles everything from morning standup prep to evening journal reconciliation, with a full agentic SDLC pipeline in between.

This post walks through my setup: 11 custom extensions, 6 skills, 18+ specialised agents, 4 MCP servers, and a token economy that keeps the whole thing affordable. Everything lives in `~/.config/pi/agent/` — version-controlled, portable, and composable.

---

## The Stack at a Glance

| Setting | Value |
|---|---|
| **Provider** | GitHub Copilot |
| **Model (interactive)** | Claude Opus 4.6 (high thinking) |
| **Model (agents)** | Configurable via `subagent-config.json` — 3 tiers |
| **Model (none)** | Native REST tools bypass the LLM entirely |
| **Thinking level** | High |
| **Theme** | Dracula (custom JSON) |
| **Output compression** | Ultra (token-pruner) |
| **Editor** | Vi-mode (custom modal editor) |
| **MCP servers** | GitHub, Filesystem, Atlassian (remote), Google Workspace (local) |
| **Packages** | `pi-mcp-adapter` |

The core philosophy: **right-size every token**. Five tiers:

1. **Opus 4.6** (interactive session) — where I'm reasoning through problems, making architectural decisions, and orchestrating the pipeline. High thinking budget. Worth every token.
2. **Reasoning tier** (5 agents: spec, plan, adversarial test review, security review, hypothesis generation) — tasks that need deep analysis, multi-step reasoning, and creative problem-solving. Sonnet 4.6 with high thinking by default.
3. **Workhorse tier** (12 agents: code, test, gather, explore, verify, code review, design review, etc.) — standard execution. Sonnet 4.6 with medium thinking.
4. **Lightweight tier** (1 agent: `phase-gaps` for ticket creation) — mechanical, structured output. Haiku 4.5 with low thinking. ~25× cheaper than Opus.
5. **No model at all** — the `tools/` extension makes native REST calls to Jira, Slack, Gmail, and Calendar directly. `defineTool()` wires API calls with auth gating and MCP fallback, returning structured data without spending a single LLM token. When the morning skill fetches 3 JQL queries, 3 Gmail searches, calendar events, and Slack history in parallel — that's ~15 API calls that never touch a model.

Tiers are abstracted via `subagent-config.json` — a single config file that maps logical tier names to concrete models and thinking levels:

```json
{
  "tiers": {
    "reasoning":   { "model": "github-copilot/claude-sonnet-4.6", "thinking": "high" },
    "workhorse":   { "model": "github-copilot/claude-sonnet-4.6", "thinking": "medium" },
    "lightweight": { "model": "github-copilot/claude-haiku-4.5",  "thinking": "low" }
  }
}
```

Agents declare a tier instead of a hardcoded model:

```yaml
# Before (hardcoded)
model: github-copilot/claude-sonnet-4.6

# After (tier-based)
tier: reasoning
```

Change one line in `subagent-config.json` and every reasoning agent switches to a different model or thinking level. Individual agents can override the tier's thinking level with an explicit `thinking:` field in their frontmatter — useful for agents that need more or less thinking than their tier default.

Then compress aggressively on both sides: input tokens truncated at source, output compressed to terse fragments, old turns stubbed to one-liners. Maximum intelligence where it counts, zero waste everywhere else.

---

## Extensions — The Real Power

Pi auto-discovers extensions from `~/.config/pi/agent/extensions/`. Each is a TypeScript file or directory with an `index.ts` barrel that receives the `ExtensionAPI` at startup. Here are the eleven I run daily.

### 🔴 Dangerous Command Gate

Every `bash` tool call passes through a risk classifier before execution. Commands are matched against pattern rules and sorted into two tiers:

- **High risk** (🔴): `rm -rf`, `sudo`, `mkfs`, system control — always prompts, blocked entirely in non-interactive mode.
- **Medium risk** (🟡): `chmod`, `git push --force`, `docker rm`, package uninstalls — prompts interactively, allowed with warning otherwise.

When a dangerous command is caught, an interactive prompt lets me allow once, allow the whole category for the session, or block. The gate also injects system-prompt guidance nudging the LLM toward safer alternatives: `trash` over `rm -rf`, dry-run flags before destructive operations, narrow permission scopes over `chmod -R 777`.

Toggle with `Ctrl+Alt+G` or `/gate on|off`. It's the seatbelt I never knew I needed — especially when the agent is autonomously running shell commands during a code phase.

### 🏗️ Dev Harness

This is the backbone. The dev-harness extension provides the runtime for a full agentic SDLC — from ticket to PR. It operates through transparent event hooks that fire at phase boundaries, so agents stay focused on their task while the extension handles validation, verification, cost tracking, and gating.

The design principle is **shift left** — catch every category of defect at the earliest possible stage, where it's cheapest to fix. A missing acceptance criterion caught during the spec interview costs one follow-up question. The same gap caught during code review costs a respawn. Caught in production, it costs an incident.

The standard pipeline:

```
/dev PROJ-1234 add refresh tokens
  → phase-gather (context collection + enrichment from Confluence, Slack, Figma, etc.)
  → phase-spec (multi-turn interview → spec JSON → review-spec self-review)
  → phase-plan (multi-turn planning → plan JSON → review-plan self-review)
  → phase-test × N (per task: write tests [RED] in clean context → review-test [advisory pre-impl])
  → phase-code × N (per task: implement [GREEN] against tests it didn't write → extension type_check + test)
  → phase-verify-acceptance (against spec ACs, with extension-triggered preflight)
  → done (or phase-gaps → follow-up tickets)
```

#### Shift-Left: Defect Prevention by Phase

Each phase has built-in quality gates that prevent defects from propagating downstream:

| Phase | What's caught | Mechanism |
|---|---|---|
| **Spec** | Missing ACs, untestable requirements, scope gaps, secret exposure | 16-topic interview sequence + `review-spec` self-review (structural consistency, AC→TC coverage, infra/security/DX completeness) |
| **Plan** | Infeasible decomposition, missing AC coverage, stub-covered MUSTs, security discipline violations | Finalisation checks + `review-plan` self-review |
| **Test authoring** | Confirmation bias (tests shaped to pass), trivial assertions, missing ACs | Separate `phase-test` agent with clean context (no impl knowledge) + adversarial `review-test` (devises wrong impls that pass) |
| **Implementation** | Type errors, test failures, regressions, misunderstood tests | Separate `phase-code` agent with clean context (reads tests from disk) + `test_issue` escalation for bad tests + extension type_check (hard gate) + test (advisory) |
| **Verify** | Spec drift, acceptance gaps, stale artifacts | Staleness check (spec/plan mtime vs verify mtime) + full `verification_commands` preflight |

The spec alone covers 16 mandatory topics — from problem statement through acceptance criteria, API contracts, constraints, risks, deployment strategy, rejected alternatives, infra/tooling, security topology, dev ergonomics, and test topology. Every MUST acceptance criterion must have a matching test case before the spec is finalised. The `review-spec` agent then validates structural consistency, and critical findings trigger a fix-and-re-review cycle (up to 2 rounds) before the spec ever reaches the planner.

#### TDD with Context-Isolated Test Authoring

The harness enforces strict TDD — but with a crucial twist: **the agent that writes the tests is not the agent that writes the code**. They run in separate subprocesses with clean context windows, eliminating confirmation bias.

Within a traditional single-agent TDD loop, the same LLM writes tests and then immediately implements against them. It "knows" how it intends to implement, so it writes tests shaped to pass — trivially-true assertions, missing edge cases, tests that exercise a code path without verifying the outcome. The harness fixes this by splitting the loop across three agents:

```
per task:
  phase-test    (clean context: spec ACs + plan guidance → write tests → confirm RED)
      ↓
  review-test   (advisory: pre-impl mode → audit test quality)
      ↓
  phase-code    (clean context: spec ACs + plan guidance → read tests from disk → implement → GREEN)
      ↓
  extension     (automatic: type_check hard gate + test advisory)
```

Here's the detailed flow:

1. **Write tests — `phase-test` (RED)** — Receives the spec's acceptance criteria, test cases, plan guidance, and constraints. Does NOT receive any production code context or implementation hints. Writes tests purely from the spec's observable behaviour contract — what the system should do, not how. Runs the test command and confirms tests fail (RED). A passing test before implementation is a deviation event: the behaviour already exists, or the test is trivially true.

2. **Review tests — `review-test` adversarial analysis (advisory)** — Spawned after every `phase-test` completion. This agent doesn't just audit tests — it actively tries to **break them**. For each acceptance criterion, it devises adversarial implementations: the simplest wrong code that would make every test pass while violating the spec. A hardcoded return value. A counter that resets on every request. A function that returns the right shape with wrong semantics. If an adversarial implementation exists, the tests are insufficient. Specific checks:
   - **Adversarial implementation analysis** — for each AC, construct a wrong implementation that passes all tests. If one exists → critical finding with the exploit and the missing assertion.
   - **AC negation** — negate each criterion ("rate limiting is NOT enforced") and walk through every test. If no test fails → the tests don't actually depend on the correct behaviour.
   - **Side-effect coverage** — for ACs implying side effects (DB writes, events, audit logs), check whether any test asserts the side effect. An adversarial impl can skip untested side effects entirely.
   - **Assertion specificity** — every trivial assertion (`toBeDefined()`, `toBeTruthy()`) is paired with the adversarial impl it permits and the specific assertion that would block it.

   On critical findings, the orchestrator respawns `phase-test` with the adversarial analysis — up to 2 respawns. The test author now knows exactly *how* a wrong implementation could sneak through.

3. **Implement — `phase-code` (GREEN)** — Receives the spec ACs and plan guidance, but NOT the test source code. Reads test files from disk in its own context — approaching them fresh, as a contract to satisfy rather than code it authored. Implements production code to make the tests pass. If it finds a test that appears incorrect or untestable, it emits a `test_issue` event back to the orchestrator (with a recommendation: `fix_test`, `clarify_spec`, or `acceptable`) and continues implementing.

4. **Extension verification** — After `phase-code` completes, the dev-harness extension automatically runs `type_check` (hard gate — failure respawns the agent) and `test` (advisory — results injected into the orchestrator's context).

The `test_issue` event is the escape valve. When `phase-code` encounters a test it believes is wrong, it doesn't modify the test — it flags the issue and keeps working. The orchestrator sees the `test_issue` events after the code phase and can decide whether to respawn `phase-test` with the feedback, escalate to the engineer, or accept the test as-is.

This creates a four-layer verification stack:

| Layer | Agent | What it catches |
|---|---|---|
| **1. Test authoring** | `phase-test` | Spec → executable contract (clean context, no impl bias) |
| **2. Test review** | `review-test` | Adversarial analysis: devises wrong impls that pass tests, AC negation, side-effect gaps |
| **3. Implementation** | `phase-code` | Test issues surfaced by a fresh reader; impl bugs caught by RED→GREEN |
| **4. Extension** | dev-harness hooks | Type errors (hard gate), test failures (advisory), schema violations |

Each layer catches a different category of defect, and the context isolation between layers 1 and 3 prevents the most insidious class of bug: tests that are green but don't actually validate behaviour.

#### Extension-Driven Verification

The key design choice is that agents never decide *when* to verify — the extension's event hooks handle that transparently:

- **`tool_result` hook on subagent completion**: If the agent requires verification (registered in the agent registry), and it didn't return `stuck`/`blocked`, the extension runs `type_check` + `test` and appends formatted results to the tool result. Type check failure injects a hard-gate message.
- **`tool_call` hook on verify-phase dispatch**: Before `phase-verify-*` agents launch, the extension checks artifact staleness (spec/plan modified after the last verify?) and runs the full `verification_commands` array as a preflight. All-fail blocks the launch; partial results are injected into the agent's brief.
- **`tool_result` hook on file writes**: Every write to `.tasks/` or `docs/` is validated against JSON schemas. Invalid shapes are rejected before they hit disk.

#### Other Key Features

- **Multi-pattern support**: `implement/standard` (full ceremony), `implement/express` (gather → code → verify), `implement/orchestrated` (parallel worktrees), `analyse` (investigation, no code), `debug` (hypothesise → test → verify).
- **Auto-config via `/dev init`**: Scans for `go.mod`, `Cargo.toml`, `package.json`, `pyproject.toml`, etc., infers test runners, type checkers, linters from actual project config, fills gaps from built-in lang profiles, and writes a `## Dev Harness` JSON block to `AGENTS.md`. Supports Go, Rust, TypeScript, Python, Ruby, Java, and C#/.NET out of the box.
- **Usage tracking**: Every subagent result is costed and logged to JSONL. The orchestrator sees cumulative cost per work item.
- **Config injection**: Every subagent brief is automatically enriched with the project stack config (language, test command, type checker, linter) and relevant JSON schemas — agents never read config files themselves.

### 📋 Plan Mode

Sometimes I want the agent to analyse code and formulate a plan *without touching anything*. `/plan` (or `Ctrl+Alt+P`) flips into read-only mode: only `read`, `bash` (allowlisted commands like `grep`, `git log`, `ls`), and `find` are available. The agent produces a numbered plan under a `Plan:` header, then I choose whether to execute it. During execution, steps are tracked with `[DONE:n]` markers and a progress widget shows completion.

It's the difference between "think first, then act" and "act and hope for the best."

### ✂️ Token Pruner

The single most impactful extension for cost control. It attacks token usage from both sides:

**Input pruning** (60–80% savings):
- *Strategy A — truncate at source*: When a tool result exceeds configured byte limits (bash: 10KB, read: 20KB, grep/find/ls: 5KB), it's truncated *before* entering the context window. A notice tells the LLM what was trimmed and how to re-read with `offset`/`limit`.
- *Strategy B — stub old turns*: Before each LLM call, tool results older than 3 turns are replaced with one-line stubs like `[bash output — 150 lines, pruned from older turn]`. The stored session is unchanged — this runs on a deep copy.

**Output pruning** (~75% savings):
A system-prompt injection instructs the LLM to maximise information density. At **ultra** level: abbreviations, arrows for causality, fragments OK. `"Inline obj prop → new ref → re-render. useMemo."` Code, file paths, error messages, and config values are never compressed — only natural-language explanations.

Safety guardrails auto-expand to full verbosity for security warnings, irreversible-action confirmations, or when I appear confused.

### 🌳 Git Worktrees

Work on multiple things concurrently without branch-switching. `/wt create auth-refactor` creates a worktree at `.worktrees/auth-refactor` with branch `wt/auth-refactor`. The extension provides tools for status, merge, PR, and cleanup — and crucially, integrates with the subagent system for parallel code execution:

```
subagent({ tasks: [
  { agent: "phase-code", task: "Task A brief", cwd: ".worktrees/task-a" },
  { agent: "phase-code", task: "Task B brief", cwd: ".worktrees/task-b" },
]})
```

The `implement/orchestrated` pipeline uses this for monorepo-scale parallelism.

### 🔧 Tool Integrations

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

### 📓 Journal

Domain-specific tools for my PARA-style work journal (`work-journal.md`). Three tools: `journal-read-entry` (structured parse of a date's sections, frontmatter, guard check), `journal-carry-over` (daily or weekly open-item computation with dedup and recency badges), and `journal-write-entry` (create/update daily entries, merge sections, update frontmatter). These tools power the morning and evening skills described below.

### 🤖 Subagent

Spawn isolated pi subprocesses with separate context windows. Discovers agents from `~/.config/pi/agent/agents/` (user-level) and `.pi/agents/` (project-level), with project agents overriding user agents by name. Each subagent runs in its own process with its own token budget — the orchestrator only sees a structured return packet.

### ⌨️ Vi Mode

A custom `ModalEditor` that intercepts keystrokes and implements vim-like modal editing directly in pi's input area. `Escape` switches to NORMAL mode; motions (`h j k l w b e 0 $ ^ gg G`), operators (`d c` with `w b $ 0` targets, `dd cc`), edits (`x X D C S J u p`), and mode switches (`i a I A o O`) all work. A mode indicator (`NORMAL` / `INSERT` + pending operator) renders in the bottom-right of the input area.

It's not full vim — no count prefixes, no visual mode, no registers — but it covers 90% of my editing muscle memory. For the rest, `Ctrl+G` opens `$EDITOR` (neovim).

### 📊 Statusline

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

### 🔔 Notify

Sends an OSC 9 terminal notification when the agent finishes and awaits input. Handles tmux passthrough via DCS escape + direct client tty write. Simple, essential — I often switch to another tmux pane while the agent works, and the bell brings me back when it's ready.

---

## Skills — Natural Language Commands

Skills are prompt-driven workflows that pi dispatches based on intent matching. Mine cover the full day.

### `/dev` — Agentic Harness Orchestrator

The command-line entry point for all harness-driven work. Parses subcommands (`help`, `init`, `tasks`, `review`, `resume`, `spec`, `plan`, `verify`, `gaps`, `deviations`, `spec-gaps`, `amend-spec`) or classifies free-text intent into a pipeline pattern.

Key design choices:
- **Minimal context**: The orchestrator holds only the work item JSON (~1KB) + agent summaries. Source files, spec bodies, and test output are never loaded into the orchestrator's context — always delegated to agents.
- **Disk-persistent state**: All state lives in `.tasks/` (runtime) and `docs/{specs,plans,verify}/` (committed). You can `/clear` between rounds and resume with `/dev resume PROJ-1234`.
- **Deterministic tools**: `dev_bootstrap`, `dev_transition`, `dev_code_brief`, `dev_promote_events`, etc. handle all file I/O and validation. The orchestrator never parses JSON manually.

### `morning` — Daily Briefing

Runs on invocation, pulling from four sources in parallel:

1. **Jira**: Three JQL queries — active issues, recently updated, backlog. Deduped, routed to Active Work or Backlog sections.
2. **Gmail + Google Chat**: Unread email, unread chat, GDPR-specific threads. Thread-level analysis to surface only actionable items.
3. **Calendar**: Today's events with embedded document link extraction for pre-meeting reading.
4. **Slack**: @mentions, DMs, monitored channel activity (7 channels). Top 5 actionable items per search.

Computes daily carry-over (open items from the previous weekday) and weekly carry-over (Mondays — all open items from the prior week with `carried over` badges). Writes a structured journal entry via `journal-write-entry`, commits and pushes. A guard check prevents duplicate runs — if the entry already exists with Active Work + Backlog populated, it only refreshes meetings.

### `evening` — Journal Reconciliation

Cross-references today's journal against what actually happened:

- **Jira**: Issues updated since last reconciliation → mark completed items `[x]`, add missing work
- **Gmail sent**: Replies sent → mark "Needs response" items `[x]`
- **Calendar**: Attended events (accepted/tentative, time passed) → `[x]`; declined → `[-]`
- **Slack**: Messages I posted → evidence of action on items
- **Google Docs**: Documents I edited → mark "Docs to review" items `[x]`

Appends concise notes to items with partial progress. Updates `reconciled_at` in frontmatter so the next evening run only queries the delta. Five checkbox states: `[ ]` open, `[x]` done, `[~]` partial, `[-]` skipped, `[>]` deferred.

### `commit` — Context-Aware Commits

Calls `git_commit_context` to gather status, diff, log, branch, secrets scan, artifacts (spec/plan/verify files), and ticket ID in one shot. Drafts a structured commit message:

```
[PROJ-10107] Add anonymous order preview endpoint

Context:
Patients need pricing before creating an account.

Decisions:
- invoice_items over subscription_details (no active subscription yet)
- Phase mapped at service boundary to keep API contract clean

Test areas:
- Anonymous preview returns correct line items per phase
- Authenticated preview path unchanged (regression)
```

Always waits for confirmation before executing. Warns on detected secrets. Enriches from dev-harness artifacts when present.

### `pr` — Push & PR

Calls `gh_pr_context` for existing PR, branch, commits, diffstat, spec, and verify report. If a PR exists, pushes (update flow). If not, drafts title + body with sections: Summary, Acceptance Criteria (from spec), Test Plan, Verification Evidence (from verify report), Risks/Notes. Never force-pushes. Reports push rejections cleanly.

### `review` — Standalone Code Review

Spawns `review-code` and `review-test` agents in parallel against the current diff (staged → unstaged → branch diff fallback). `review-test` only runs if test files changed. Synthesises a single report with Critical / Warnings / Suggestions / Test Quality sections. Works without a spec or plan — useful for quick fixes and pre-commit sanity checks.

---

## Agent Fleet

The `agents/` directory contains 18+ markdown files, each defining a specialised agent with frontmatter (name, description, model, tools) and a system prompt body. They run as isolated subagent processes — the orchestrator never shares their context window.

### Phase Agents (Implementation Pipeline)

| Agent | Role |
|---|---|
| `phase-gather` | Collect context from codebase, tickets, docs, Slack, Confluence |
| `phase-spec` | Multi-turn interview → `docs/specs/<ID>-spec.json` |
| `phase-plan` | Multi-turn planning → `docs/plans/<ID>-plan.json` with ordered tasks |
| `phase-code` | Implement production code against tests it didn't write — clean context, reads tests from disk |
| `phase-test` | Write tests in a clean context from spec ACs — no impl knowledge |
| `phase-verify-acceptance` | Verify implementation against spec ACs. Receives preflight results from the extension |
| `phase-verify-infra` | Infrastructure-specific verification (Terraform plans, Helm diffs, etc.) |
| `phase-explore` | Open-ended codebase exploration for investigations |
| `phase-hypothesise` | Generate and rank hypotheses for debugging |
| `phase-gaps` | Identify gaps from verify reports → create follow-up tickets |

### Review Agents (Quality Gates)

| Agent | Role |
|---|---|
| `review-code` | Code quality, simplification, drift from spec |
| `review-test` | Adversarial test review: devises wrong implementations that would pass the tests |
| `review-design` | Architecture, coupling, API design |
| `review-security` | Vulnerability scanning, auth patterns, data exposure |
| `review-spec` | Spec completeness, ambiguity, testability |
| `review-plan` | Plan feasibility, ordering, risk |
| `review-deviation` | Flag and resolve implementation deviations from plan |
| `review-investigation` | Evaluate investigation quality and completeness |

### Tracker Providers & Enrichment Sources

The agents directory also includes pluggable **tracker providers** (`jira.md`, `github.md`, `gitlab.md`, `plain-text.md`) that teach `phase-gather` how to fetch ticket context from different issue trackers, and **enrichment sources** (`confluence.md`, `figma.md`, `github-discussions.md`, `github-pr.md`, `google-docs.md`, `slack.md`) that add domain-specific context during the gather phase.

---

## MCP Servers

Four MCP servers provide external data access:

| Server | Transport | Purpose |
|---|---|---|
| **GitHub** | `npx @modelcontextprotocol/server-github` | Repository operations, PR management, issues |
| **Filesystem** | `npx @modelcontextprotocol/server-filesystem` | Broad filesystem access beyond the working directory |
| **Atlassian** | Remote MCP (`https://mcp.atlassian.com/v1/mcp`) | Jira + Confluence (direct tools enabled) |
| **Google Workspace** | Local node server (`workspace-server/dist/index.js`) | Gmail, Calendar, Drive |

The native tool integrations in `extensions/tools/` call APIs directly when credentials are available, falling back to MCP servers when they're not. This means the fast path (native REST) handles most requests, with MCP as a resilient fallback. The Atlassian MCP server is the only one with `directTools: true`, making its tools available to the LLM without the native wrapper.

---

## Token Economy

The tiered model strategy handles the macro economics — reasoning tier for deep analysis, workhorse for standard execution, lightweight for mechanical tasks, native REST for data fetching. All configurable from a single `subagent-config.json`. The token-pruner extension handles the micro economics — squeezing waste out of every individual call.

### The Tools Extension: Zero-Token API Calls

The biggest cost saving isn't in the pruner — it's in the `tools/` extension. Every Jira search, Gmail query, Slack history fetch, and Calendar lookup is a native HTTP call that returns structured data directly to the agent's context. No LLM interprets the API response; no MCP server translates it. The `defineTool()` framework wires auth gating, a provider chain (native first, MCP fallback), and a `format()` function that runs once regardless of which provider succeeded.

The morning skill alone makes ~15 parallel API calls across four services. At Opus token prices, having the LLM make those calls via function-calling would cost significantly more than having the tools extension handle them as plain HTTP requests. The LLM receives pre-formatted results and reasons over them — it never sees raw API payloads.

### Input Budget

Per-tool byte limits control what enters the context:

| Tool | Limit | Direction | Rationale |
|---|---|---|---|
| `bash` | 10 KB | Tail (keep end) | Exit codes and errors appear last |
| `read` | 20 KB | Head (keep start) | Imports and declarations appear first |
| `grep` | 5 KB | Head | First matches are usually most relevant |
| `find` | 5 KB | Head | First results suffice for discovery |
| `ls` | 5 KB | Head | Directory listing is front-loaded |

The 3-turn recency window means that by the time the agent is 4 interactions deep, early tool results are compressed to stubs. Combined with truncation at source, a typical session uses 60–80% fewer input tokens than it would without pruning.

Error results are *never* truncated — the LLM needs full diagnostics to self-correct.

### Output Budget

At **ultra** compression, the system-prompt injection produces responses like:

> `Inline obj prop → new ref → re-render. useMemo.`

Instead of:

> "Sure! The issue here is that you're creating a new object reference on every render by defining the prop inline. This causes the child component to re-render unnecessarily. You can fix this by wrapping the value in `useMemo`."

The savings are dramatic. An ultra-compressed explanation is typically 3-4× shorter than a normal one, with no information loss for an experienced developer.

### The Statusline as Financial Dashboard

The context bar in the statusline provides real-time cost awareness:

- **Green** (≥50% remaining): Plenty of context budget. Work freely.
- **Amber** (<50% remaining): Getting expensive. Consider `/clear` or starting a new session.
- **Red** (<20% remaining): In the overage zone. Tokens past 200k incur a 1.25× multiplier. The `🔥` indicator shows exactly how much overage.

Cumulative session cost is always visible (e.g. `$0.3842`). Between this and the pruner, I can run Opus 4.6 all day without cost anxiety.

---

## The Dracula Theme

A full semantic theme covering every pi surface: syntax highlighting (pink keywords, green functions, yellow strings, purple numbers, cyan types), markdown rendering (orange headings, cyan links, green code), diff colors, tool result backgrounds (green tint for success, red tint for errors, purple tint for custom messages), and — my favourite detail — **thinking-level gradients**:

| Level | Color |
|---|---|
| Off | Dim grey (`#545978`) |
| Minimal | Comment blue (`#6272a4`) |
| Low | Cyan (`#8be9fd`) |
| Medium | Purple (`#bd93f9`) |
| High | Pink (`#ff79c6`) |
| X-High | Red (`#ff5555`) |

When the model is thinking hard, the indicator glows pink. When it's barely thinking, it fades to grey. It's a small thing, but it gives an intuitive sense of how much cognitive budget the model is spending on each response.

---

## A Day in the Life

Here's what a typical workday looks like with this setup.

### 08:30 — Morning Briefing

```
> morning
```

The skill fires four parallel API queries (Jira, Gmail, Calendar, Slack), computes carry-over from the previous weekday, writes a structured journal entry with sections for GDPR, Needs Response, Active Work, Meetings, Docs to Review, and Backlog. Commits and pushes. Total time: ~15 seconds. I scan the terminal output, mentally prioritise, and start.

### 09:00 — Feature Work

```
> /dev PROJ-1234 add refresh token rotation
```

The harness classifies this as `implement/standard`, creates a work item, and launches `phase-gather` to collect context from the codebase, Jira ticket, linked Confluence docs, and relevant Slack threads. Then `phase-spec` runs a multi-turn interview — asking about edge cases, failure modes, backwards compatibility. I answer 3-4 rounds of questions, the spec is finalised as JSON with acceptance criteria.

`phase-plan` breaks the spec into ordered tasks with file-level guidance. Then for each task, `phase-test` writes tests in a clean context — working purely from the spec's acceptance criteria, with no knowledge of how the implementation will work. The adversarial `review-test` then tries to devise wrong implementations that would pass those tests — if it finds one, `phase-test` is respawned to strengthen the assertions. Then `phase-code` receives the spec and plan guidance (but not the test source code), reads the tests from disk in its own clean context, and implements production code to make them pass. The extension runs `type_check` (hard gate) and `test` (advisory) automatically after each code phase.

After all tasks complete, `phase-verify-acceptance` checks each AC against the implementation. Gaps become follow-up tickets via `phase-gaps`.

### 11:00 — Code Review

```
> review
```

Before committing a quick fix, I run the standalone review skill. It spawns `review-code` and `review-test` in parallel against my staged diff, then synthesises a single report with Critical/Warnings/Suggestions sections. Quick, focused, spec-free.

### 14:00 — Safe Exploration

```
/plan
> How is authentication handled in the order service?
```

Plan mode restricts tools to read-only. The agent explores the codebase, traces auth middleware, and produces a numbered plan for how I might refactor it. I review the plan, toggle `/plan` off, and decide whether to execute.

Meanwhile, the dangerous-command gate has already caught two `rm -rf` attempts from the agent during the morning's code phase — both safely gated behind interactive prompts.

### 16:30 — Commit & PR

```
> commit
```

The commit skill gathers diff, status, branch, ticket ID, and any dev-harness artifacts. It drafts a structured message with Context (why), Decisions (trade-offs), and Test Areas (what could break). I confirm, it commits.

```
> pr
```

The PR skill pushes, detects no existing PR, and drafts one with Summary, Acceptance Criteria (copied from the spec), Test Plan, and Verification Evidence (extracted from the verify report). One command, full PR.

### 17:30 — Evening Reconciliation

```
> evening
```

The skill reads my journal entry, queries all five activity sources for what happened since the last reconciliation, and updates checkboxes: meetings attended → `[x]`, emails replied to → `[x]`, Jira issues completed → `[x]`. Adds items I worked on that weren't in the morning briefing. Appends concise notes to items with partial progress. Updates `reconciled_at` so tomorrow's run only queries the delta.

---

## How It All Fits Together

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ~/.config/pi/agent/                          │
│                                                                     │
│  settings.json ─── provider, model, thinking, theme, packages       │
│                                                                     │
│  extensions/ (auto-loaded on startup)                               │
│  ├── dangerous-command-gate/  ── bash hook ── risk classify ── gate │
│  ├── dev-harness/  ── 6 event hooks ── validation, verification,   │
│  │                    usage tracking, config guard, brief injection  │
│  ├── plan-mode/  ── tool restriction ── progress tracking           │
│  ├── token-pruner/  ── tool_result hook ── context hook ── syspr.   │
│  ├── worktree/  ── git worktree tools ── parallel execution         │
│  ├── tools/  ── Jira, Slack, Gmail, Calendar ── defineTool()        │
│  ├── journal/  ── read, write, carry-over ── PARA journal           │
│  ├── subagent/  ── process spawning ── agent discovery              │
│  ├── git-tools/  ── commit, diff, PR tools                         │
│  ├── vi-mode.ts  ── modal editing (NORMAL/INSERT)                   │
│  ├── statusline.ts  ── 3-line p10k footer                          │
│  └── notify.ts  ── OSC 9 terminal bell                             │
│                                                                     │
│  skills/ (dispatched by intent)                                     │
│  ├── dev/  ── agentic SDLC orchestrator                            │
│  ├── morning/  ── daily briefing → journal                         │
│  ├── evening/  ── journal reconciliation                           │
│  ├── commit/  ── structured commits                                │
│  ├── pr/  ── push + PR open/update                                 │
│  └── review/  ── standalone diff review                            │
│                                                                     │
│  agents/ (spawned as isolated subprocesses)                         │
│  ├── phase-{gather,spec,plan,test,code,verify-*,explore,...}.md      │
│  ├── review-{code,test,design,security,spec,plan,deviation,...}.md │
│  └── providers/ ── tracker + enrichment source agents               │
│                                                                     │
│  mcp.json ─── GitHub, Filesystem, Atlassian, Google Workspace       │
│  subagent-config.json ─── reasoning/workhorse/lightweight → models │
│  themes/dracula.json ─── full semantic Dracula theme                │
│  token-pruner.json ─── per-tool limits, output level, stubs         │
└─────────────────────────────────────────────────────────────────────┘

Data flow:
  User → skill (intent match) → orchestrator (subcommand dispatch)
    → subagent (isolated process) → agent prompt + tools
      → native API tools (Jira, Slack, Gmail, Calendar)
        → MCP fallback if native unavailable
      → dev-harness hooks fire on every tool_result + tool_call
        → schema validation, verification gates, usage tracking
    → return packet → orchestrator promotes events, transitions phase
  → statusline updates (tokens, cost, context %, extension statuses)
```

---

## Key Takeaways

**Pi's extension system is composable enough to build an entire workflow.** What started as "add vi-mode" became a full SDLC pipeline, a daily productivity system, and a cost management layer — all from the same `ExtensionAPI` surface.

**Right-size every token.** Opus for orchestration, three configurable agent tiers (reasoning/workhorse/lightweight), native REST for data fetching — all tunable from a single `subagent-config.json`. Layer on input truncation, turn stubbing, and output compression, and the whole fleet runs for a few dollars a day.

**Transparent hooks beat explicit orchestration.** The dev-harness doesn't ask the LLM to run tests — it runs them automatically at phase boundaries and injects results. The dangerous-command gate doesn't ask the LLM to be careful — it intercepts dangerous commands before they execute. The best guardrails are the ones the agent doesn't know about.

**State on disk enables `/clear` without fear.** Every piece of harness state lives in `.tasks/` and `docs/`. I can `/clear` the context, close the terminal, come back tomorrow, and `/dev resume PROJ-1234` picks up exactly where I left off. The orchestrator's working context is just the work item JSON (~1KB) plus agent summaries.

**The terminal is the IDE.** With vi-mode, a p10k statusline, Dracula theme, native tool integrations, and tmux notifications — pi isn't a chat assistant bolted onto my workflow. It *is* my workflow.

---

*Everything described here is in `~/.config/pi/agent/`, version-controlled as part of my [dotfiles](https://github.com/cshirley/.config). The extensions are TypeScript, the agents are markdown, and the whole thing reloads with `/reload`.*
