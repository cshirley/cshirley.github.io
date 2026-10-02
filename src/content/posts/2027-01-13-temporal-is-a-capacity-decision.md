---
title: "Camunda to Temporal Is a Capacity Decision, Not a Cost Saving"
description: A workflow engine that is far cheaper to license can still lose its first-year business case once migration effort is counted. How to frame a platform move as an engineering capacity trade-off.
date: 2027-01-13 09:00:00 +0000
draft: true
categories:
- Architecture
tags:
- Temporal
- Camunda
- workflow orchestration
- decision making
author:
  display_name: Clive Shirley
---

"Temporal costs a fraction of what Camunda costs" is true, and it is the least useful sentence in the business case.

We run a healthcare platform whose orchestration sits on Camunda. I reviewed the case for moving to Temporal, and the licence difference was large enough that the first draft read as an obvious yes. Then the migration estimate went in: **27 to 45 engineer-weeks** of effort, to be absorbed alongside the roadmap before a contract renewal date.

This post is about why I think that decision should be framed as a capacity trade-off, and what the honest version of the case looks like.

## What the saving buys you

Cost is not the only reason to move. Temporal keeps orchestration logic in the same TypeScript ecosystem as the rest of the stack, instead of splitting it across separate tooling and Java-based workflow logic. That should make workflows easier to:

- write and change
- test, including in CI
- run locally
- reason about, for engineers and for AI-assisted development alike, because the logic sits next to the business logic

So the long-term case is run cost plus developer experience, and developer experience compounds into delivery speed. I believe that case.

## What staying buys you

Camunda has real advantages today. It is easier to operate in production: its view of workflow state and user journeys makes support and debugging faster. And it avoids a large chunk of migration work right now, which lets engineers keep shipping product.

## What the migration actually costs

The estimate is not a workflow rewrite. It includes:

- shared Temporal infrastructure
- a queue consumer and routing layer
- monitoring and alerting
- idempotency hardening
- the workflow rewrites themselves
- a workflow test framework
- migration support for long-running workflows
- integration testing and cutover

The unit matters. **Engineer-weeks are not calendar weeks.** The question is not whether it fits into four months on a calendar. It is how many engineers you can put on it, what gets pushed out, and what those pushed-out features were worth.

## Why the first-year return is weak

The licence saving is visible. The cost is not on any invoice: engineers on migration instead of features, hardening and test work that creates no new customer value, and temporary operational overhead while two systems run.

So year one is not "save the licence difference". It is "save platform cost, and spend a meaningful amount of engineering capacity to do it". That may still be the right trade, but it is not a quick win.

## The risks that matter

**Idempotency.** Temporal treats replay safety as central. Several important POST operations were not protected against replay. The failure modes are duplicate charges, duplicate prescriptions, duplicate shipments or wrong state transitions. This is a good reason to harden those paths whichever engine you use.

**Testing.** We lacked strong end-to-end workflow tests. You cannot migrate safely without them, and you cannot trust either engine without them.

**Long-running workflows.** In-flight work needs careful handling at cutover.

**Opportunity cost.** The biggest business risk. Every engineer on migration is not working on product, growth or reliability.

Notice that two of those are not Temporal risks at all. They are gaps in the current system that a migration forces you to confront.

## The recommendation I made

Temporal is probably the better long-term platform. Camunda is better for production support today. And the decision depends on one question: **is getting off Camunda by the renewal date worth spending that capacity now, instead of on roadmap features?**

If yes, Temporal is a reasonable destination. If not, be honest that the short-term cost is not the licence bill. It is the engineering time taken from other work.

## The general lesson

A platform move that saves licence money but costs engineering weeks is **a capacity decision wearing a cost-saving hat**. Write the case in the units you will actually spend, name the work you would delay, and keep any hardening that pays off whichever way you decide.
