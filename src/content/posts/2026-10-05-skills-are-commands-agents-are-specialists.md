---
title: "Skills Are Commands, Agents Are Specialists: How My Pi Day Is Organised"
description: "The six natural-language skills, the fleet of phase and review agents, and the MCP servers that sit behind my Pi workflow, from the morning briefing to commit and pull request."
date: 2026-10-05 10:30 +0100
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

This post is part of my [Pi workflow series](/ai/2026/05/06/ai-native-workflow-with-pi.html), which starts with the overall picture of how I run my working day inside Pi. This part covers the layer you type into: skills, the agents they dispatch, and the MCP servers they can call.

**A skill is a command with an intent. An agent is a specialist with a narrow job and a fresh context.**

## Skills: natural language commands

Skills are prompt-driven workflows that pi dispatches based on intent matching. Mine cover the full day.

### `/dev`: the agentic harness orchestrator

The command-line entry point for all harness-driven work. Parses subcommands (`help`, `init`, `tasks`, `review`, `resume`, `spec`, `plan`, `verify`, `gaps`, `deviations`, `spec-gaps`, `amend-spec`) or classifies free-text intent into a pipeline pattern.

Key design choices:
- **Minimal context**: The orchestrator holds only the work item JSON (~1KB) + agent summaries. Source files, spec bodies, and test output are never loaded into the orchestrator's context: always delegated to agents.
- **Disk-persistent state**: All state lives in `.tasks/` (runtime) and `docs/{specs,plans,verify}/` (committed). You can `/clear` between rounds and resume with `/dev resume PROJ-1234`.
- **Deterministic tools**: `dev_bootstrap`, `dev_transition`, `dev_code_brief`, `dev_promote_events`, etc. handle all file I/O and validation. The orchestrator never parses JSON manually.

### `morning`: daily briefing

Runs on invocation, pulling from four sources in parallel:

1. **Jira**: Three JQL queries: active issues, recently updated, backlog. Deduped, routed to Active Work or Backlog sections.
2. **Gmail + Google Chat**: Unread email, unread chat, GDPR-specific threads. Thread-level analysis to surface only actionable items.
3. **Calendar**: Today's events with embedded document link extraction for pre-meeting reading.
4. **Slack**: @mentions, DMs, monitored channel activity (7 channels). Top 5 actionable items per search.

Computes daily carry-over (open items from the previous weekday) and weekly carry-over (Mondays, all open items from the prior week with `carried over` badges). Writes a structured journal entry via `journal-write-entry`, commits and pushes. A guard check prevents duplicate runs, if the entry already exists with Active Work + Backlog populated, it only refreshes meetings.

### `evening`: journal reconciliation

Cross-references today's journal against what actually happened:

- **Jira**: Issues updated since last reconciliation → mark completed items `[x]`, add missing work
- **Gmail sent**: Replies sent → mark "Needs response" items `[x]`
- **Calendar**: Attended events (accepted/tentative, time passed) → `[x]`; declined → `[-]`
- **Slack**: Messages I posted → evidence of action on items
- **Google Docs**: Documents I edited → mark "Docs to review" items `[x]`

Appends concise notes to items with partial progress. Updates `reconciled_at` in frontmatter so the next evening run only queries the delta. Five checkbox states: `[ ]` open, `[x]` done, `[~]` partial, `[-]` skipped, `[>]` deferred.

### `commit`: context-aware commits

Calls `git_commit_context` to gather status, diff, log, branch, secrets scan, artefacts (spec/plan/verify files), and ticket ID in one shot. Drafts a structured commit message:

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

Always waits for confirmation before executing. Warns on detected secrets. Enriches from dev-harness artefacts when present.

### `pr`: push and open a pull request

Calls `gh_pr_context` for existing PR, branch, commits, diffstat, spec, and verify report. If a PR exists, pushes (update flow). If not, drafts title + body with sections: Summary, Acceptance Criteria (from spec), Test Plan, Verification Evidence (from verify report), Risks/Notes. Never force-pushes. Reports push rejections cleanly.

### `review`: standalone code review

Spawns `review-code` and `review-test` agents in parallel against the current diff (staged → unstaged → branch diff fallback). `review-test` only runs if test files changed. Synthesises a single report with Critical / Warnings / Suggestions / Test Quality sections. Works without a spec or plan, useful for quick fixes and pre-commit sanity checks.

## The agent fleet

The `agents/` directory contains 18+ markdown files, each defining a specialised agent with frontmatter (name, description, model, tools) and a system prompt body. They run as isolated subagent processes, the orchestrator never shares their context window.

### Phase agents (implementation pipeline)

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

### Review agents (quality gates)

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

### Tracker providers and enrichment sources

The agents directory also includes pluggable **tracker providers** (`jira.md`, `github.md`, `gitlab.md`, `plain-text.md`) that teach `phase-gather` how to fetch ticket context from different issue trackers, and **enrichment sources** (`confluence.md`, `figma.md`, `github-discussions.md`, `github-pr.md`, `google-docs.md`, `slack.md`) that add domain-specific context during the gather phase.

## MCP servers

Four MCP servers provide external data access:

| Server | Transport | Purpose |
|---|---|---|
| **GitHub** | `npx @modelcontextprotocol/server-github` | Repository operations, PR management, issues |
| **Filesystem** | `npx @modelcontextprotocol/server-filesystem` | Broad filesystem access beyond the working directory |
| **Atlassian** | Remote MCP (`https://mcp.atlassian.com/v1/mcp`) | Jira + Confluence (direct tools enabled) |
| **Google Workspace** | Local node server (`workspace-server/dist/index.js`) | Gmail, Calendar, Drive |

The native tool integrations in `extensions/tools/` call APIs directly when credentials are available, falling back to MCP servers when they're not. This means the fast path (native REST) handles most requests, with MCP as a resilient fallback. The Atlassian MCP server is the only one with `directTools: true`, making its tools available to the LLM without the native wrapper.

## The general lesson

Keep the commands you type small and the agents they dispatch narrow. **Each agent should do one job in its own clean context, and each skill should only decide which agent to send for it.** That keeps every step easy to reason about, replace and review.
