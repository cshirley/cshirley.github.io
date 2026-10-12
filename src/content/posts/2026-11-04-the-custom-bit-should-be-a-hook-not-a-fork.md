---
title: "The Custom Bit Should Be a Hook, Not a Fork: Extensibility in Enterprise Products"
description: Enterprise customers always need one more rule, one more integration or one more approval step. What I learned from building a mobility product is that extensibility is a product feature, not a last-minute escape hatch.
date: 2026-11-04 09:00:00 +0000
draft: true
categories:
- Architecture
tags:
- architecture
- integration patterns
- configuration
- async
- reliability
- patterns
author:
  display_name: Clive Shirley
---

One of the most reliable facts in enterprise software is that the standard workflow is never quite standard enough.

A customer wants one extra menu action on the client. Another wants outbound documents scrubbed before they leave the organisation. Another wants filed mail marked with an internal rule. Another needs matter or workspace rules enforced differently for a legal team. Someone else needs a different mail, fax or content provider because that is what their estate already uses, whether that means Exchange, GroupWise, Lotus Notes or something equally entrenched.

I saw this very clearly in the WorkSite mobility product I eventually sold to Interwoven. Looking back, one of the best product decisions we made was not any one feature. It was treating extensibility as part of the design, rather than as an awkward concession after the first large customer asked for changes.

This post covers what that taught me, and why **the custom bit should live in a hook, not in a fork of the product**.

## Enterprise products do not stay generic for long

A team can persuade itself that version one should stay clean and opinionated, and that special cases can wait. That can work for consumer products. It rarely works for enterprise software.

Enterprise customers already have policy, tooling, compliance rules and operational habits before your product arrives. They do not replace all of that to match your neat default flow. They ask where your product can bend.

That does not mean every request is sensible, or that every request should be accepted. It means the product needs a clear answer to three questions:

- Which parts of the workflow are invariant?
- Which parts are likely to vary by customer or deployment?
- How can that variation happen without turning upgrades into a rewrite?

If you cannot answer those questions, the next large deal will answer them for you, usually by asking for a branch that never rejoins the main line.

## Forks solve the short-term problem and create the long-term one

At first glance, a customer fork looks pragmatic. You duplicate the code, make the requested changes, ship the deal and promise yourself you will clean it up later.

The trouble is that a fork moves the cost, rather than removing it. Every future fix, security patch and enhancement now has to be merged, translated or reimplemented. The more successful the product becomes, the worse the economics get.

That is why I have become suspicious of any design that depends on remembering which customer has which behaviour. If the variation matters enough to sell, support and operate, it matters enough to model explicitly.

A hook does exactly that. It says: this workflow is stable, but this step is allowed to vary. This is where you plug policy in. This is the contract you must honour. This is what the core system promises not to break casually.

That is a much healthier promise than "we can patch your copy".

## Good extension points start with boundaries

The useful question is not "where can we add plugins?" It is "where does local policy naturally belong?"

In the mobility product, that often meant looking for moments where the core workflow had done its job and customer-specific behaviour could safely take over. After an email had been filed into the right matter or workspace, a post-processing hook made sense. Before a document left the system, a transformation hook made sense. On the client, a menu extension made sense because it added behaviour without redefining navigation.

Those hooks worked because the surrounding workflow stayed owned by the product. Authentication, queue handling, retries, status transitions, accurate filing to the right matter or workspace, and the main integration path remained centralised. The extension saw a narrow contract, not the whole internals of the system.

That is the balance to aim for. If a hook is too narrow, nobody can do anything useful with it. If it is too wide, you have exported your internal architecture and made it someone else's dependency.

## Configuration is part of the architecture

One lesson I learned slowly is that extensibility is not only about code. It is also about selection.

If a system can talk to different providers, choose different handlers or enable different policies per deployment, that choice has to live somewhere durable and legible. In practice, that usually means configuration.

I do not mean magical configuration that can express an entire programme in XML and becomes impossible to reason about. I mean a simpler rule: put stable choices in configuration, and put variable business logic behind explicit interfaces.

That split matters because it changes the operational model.

- A new provider can be selected without editing core code.
- A deployment-specific rule can be added without cloning the workflow.
- An operator can inspect how a system is wired without reading the source.

Configuration is often treated as secondary to architecture diagrams. In integration-heavy products, it *is* architecture. It tells you which parts are meant to move and which parts are meant to stay put.

## Extensibility needs operational discipline

There is a trap here. Once a product has hooks, every new requirement looks like one more extension point.

That is not always right. Every hook becomes part of the support burden. You have to version it, document it, test it, and think about what happens when an extension fails in production.

So I prefer a stricter standard now:

- add a hook only where multiple customers are likely to vary in the same place
- make the contract explicit and narrow
- define what happens when the hook fails
- keep extension code out of the control flow that maintains system integrity

That last point matters most. If an extension decides whether the queue can advance, whether a user can recover a failed item, or whether core state remains consistent, you no longer have an extension. You have a second product living inside the first one.

Good extension models preserve the recoverability of the core system.

## The architecture benefit is not only customer flexibility

There is another reason to invest in this early: the architecture gets cleaner for the team as well.

Once you start asking "is this core behaviour or local policy?", design decisions become easier. Teams stop hiding customer-specific rules in random parts of the codebase. You can see which modules should be generic, which should adapt an external dependency, and which should exist only as examples or samples.

That makes testing easier too. The core workflow can be tested for invariants. Extensions can be tested against a contract. Support teams get a clearer picture of whether a fault lives in the product, the deployment, or a custom component.

It also improves product management. If a requested change can fit an existing hook, it is a deployment concern. If it needs a new hook, that is a product decision. If it needs a fork, something in the architecture has already gone wrong.

## What I would do the same now

I would still design extension points early in any enterprise product that sits between several systems and several customers.

I would still prefer adapters and hooks to customer branches. I would still separate invariant workflow from local policy. I would still treat configuration as first-class design. And I would be even firmer about documenting failure behaviour, because extensions are easy to sell and much harder to operate.

Modern stacks change the mechanics, not the principle. Today the hook might be a webhook, an event consumer, a policy engine or a small internal service rather than a loaded assembly. The question is unchanged: can the customer-specific behaviour live behind a stable contract, while the core product remains upgradeable?

If the answer is yes, you have an extensible product. If the answer is no, you have a future maintenance bill.

## The general lesson

Enterprise products need to bend without splitting. **Put variation behind a deliberate hook, keep the main workflow invariant, and never make a fork your customisation model.** The short-term convenience of a branch is rarely worth the long-term drag on every release that follows.
