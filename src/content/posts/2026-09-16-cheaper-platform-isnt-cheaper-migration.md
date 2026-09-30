---
title: "The Cheaper Platform Isn't the Cheaper Migration"
description: "A replacement workflow engine would have cut the licence bill by more than 90%. The honest business case said the question wasn't cost at all. How to write a platform-migration case that counts engineering time, opportunity cost and operational maturity honestly."
date: 2026-09-16 09:00:00 +0100
draft: true
categories:
- Architecture
tags:
- build vs buy
- workflow orchestration
- Temporal
- Camunda
- decision making
author:
  display_name: Clive Shirley
---

Every so often a platform decision arrives framed as arithmetic: *the incumbent costs X, the alternative costs a tenth of X, why haven't we switched?* I was asked to write the business case for moving our workflow orchestration from Camunda (a BPMN engine, run as SaaS) to Temporal (code-first durable execution). The licence saving was real, better than 90%.

My recommendation wasn't "switch". It was "this is a capacity decision, not a cost decision, so make it as one". This post explains why, and offers a template for writing these cases honestly.

## The saving is real. That's not the question.

It's easy to argue badly in either direction. Engineers who like the new tool understate migration cost; people who are comfortable with the incumbent overstate risk. So start by conceding what's true: **the alternative is cheaper to run.** Once that's said, the real question is clearer:

> Do we want to spend this engineering capacity *now*, and what will we delay to do it?

## Why we'd move

- **Cost:** the recurring licence saving is large and permanent.
- **Fit:** orchestration logic would live in the same TypeScript ecosystem as the rest of the stack, instead of being split across separate modelling tools and Java-based workflow code. That makes workflows easier to change, test, run locally and cover in CI.
- **AI-assisted development:** workflow logic that sits next to the business logic is far more useful to coding agents than orchestration definitions held somewhere else.
- **Delivery speed over time:** better developer experience compounds.

## Why we'd stay (for now)

- **Easier to operate in production today:** the incumbent gives a clear view of workflow state and user journeys, which makes support and debugging easier. The replacement wasn't yet running in production on our platform.
- **It avoids a large chunk of work right now:** engineers stay on roadmap and product delivery instead of migration.

## What the migration actually costs

This is where most business cases are weakest, because "rewrite the workflows" hides most of the work. Our estimate was **27–45 engineering weeks**, made up of:

- shared infrastructure for the new engine;
- the queue-consumer and routing layer that feeds it;
- monitoring and alerting;
- **idempotency hardening**;
- the workflow rewrites themselves;
- a workflow test framework;
- migration handling for long-running workflows that can't simply be restarted;
- integration testing and cutover.

Engineering weeks aren't calendar weeks, but that's still a meaningful slice of a team's year.

## Why first-year ROI was weak

The licence saving looks like pure upside on a slide. In year one, most of it is offset by:

- **engineers migrating instead of shipping features**, the opportunity cost nobody puts in the spreadsheet;
- test and hardening work that doesn't directly create customer value;
- migration risk and temporary operational overhead from running two systems.

So the first-year case isn't "save the licence fee". It's "spend a large amount of engineering time to save it from year two onwards, while delaying other work". That can still be the right call, but it's a different decision from the one the arithmetic suggests.

## The risks, named plainly

- **Idempotency.** Several important write operations weren't protected against replay. In a durable-execution engine, replay safety is fundamental, and getting it wrong in healthcare means duplicate charges, duplicate prescriptions or duplicate shipments. (That's worth fixing whichever engine you run.)
- **Testing.** We lacked strong end-to-end workflow tests, and migrating safely meant building them first.
- **Long-running workflows.** Processes that span weeks need careful migration handling.
- **Opportunity cost.** Probably the biggest risk: every engineer on the migration isn't working on product, growth or reliability.

## The recommendation

- **Temporal is probably the better long-term platform:** cheaper, easier to build on and test, and aligned with the stack.
- **Camunda is still easier to support in production today.**
- **First-year ROI is likely weak** once engineering effort and opportunity cost are included.

So frame it as what it is, **a capacity trade-off**. Is getting off the incumbent by the target date important enough to justify spending that engineering effort now instead of on roadmap features? If yes, the new platform is a reasonable destination. If not, be honest that while it's probably the better long-term choice, the short-term cost isn't the licence bill. It's the engineering time taken from everything else.

## A template for platform-migration cases

1. **Concede the obvious.** State plainly what's true about both options.
2. **Name the real question.** It's usually about capacity and timing, not unit price.
3. **Cost the migration, not the destination.** Include shared infrastructure, hardening, test coverage, dual-running and support tooling.
4. **Count opportunity cost explicitly.** What won't ship?
5. **Separate year-one ROI from steady-state ROI.**
6. **List the risks on *both* sides**, including the risk of staying.
7. **Make a direct recommendation**, with the conditions that would change it.

## The general lesson

The cheapest platform to *run* is rarely the cheapest platform to *get to*. A good business case turns "it's cheaper" into "here's what it costs, when it pays back, and what we give up to do it now", and then says clearly what you'd do.
