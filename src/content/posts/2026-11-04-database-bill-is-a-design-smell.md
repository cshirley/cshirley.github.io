---
title: "Your Database Bill Is a Design Smell"
description: "A document store, a search cluster and an analytics warehouse, each billed on its own growth curve. How we found that the cheapest architecture was already hiding behind our own abstraction seam."
date: 2026-11-04 09:00:00 +0000
draft: true
categories:
- Architecture
tags:
- Postgres
- DynamoDB
- OpenSearch
- CQRS
- cost
- transactional outbox
author:
  display_name: Clive Shirley
---

Infrastructure cost reviews usually start with a spreadsheet of line items and end with "right-size the instances". That's worth doing, but it treats the symptom. When one component's cost grows faster than your users, it's often telling you something about the **shape** of your data architecture.

This post is about a cost review of a FHIR resource platform (the system of record for a multi-region healthcare product) and the recommendation it produced: **two tracks, paced by two different clocks.**

## The setup

The platform followed a textbook CQRS split:

- **Writes** went to DynamoDB as a document store: one table, dozens of resource types, full version history.
- **Reads** went to an OpenSearch cluster holding the current version of every resource, because FHIR search is open-ended (dozens of parameters per resource, in arbitrary combinations, with sorting and text modifiers).
- **Change data capture** streamed every write to consumers and to a Redshift analytics warehouse.

The constraints were firm: keep the API and the CQRS pattern, keep resource versioning, stay on AWS, keep regions isolated, and **reduce** eventual consistency rather than add more.

## Where the money was actually going

### A 2× storage floor from versioning

The write model stored a "current" pointer row plus one row per version, written in the same transaction. That's a reasonable design, because a key-value store can't cheaply answer "give me the latest version" any other way. But it means **a resource that is never updated still costs two rows**. At a million registered users per region, the storage floor doubles before anyone edits anything.

### Storage and compute were coupled in search

At current traffic the search cluster was **oversized for throughput**. At projected data volume it would become **simultaneously oversized for throughput and undersized for storage**, the classic signature of adding nodes just to get disk. Every node added for storage also bills for CPU nobody needs. (The search-native answer is warm storage tiers plus index lifecycle policies. That works, but it means running three storage tiers, and it does nothing for the other half of the bill.)

### Growth drivers weren't the ones on the invoice

| Driver | Scales with |
|---|---|
| Current-pointer duplication | Registered users |
| Version history | Mutation volume (permanent) |
| Audit events | Mutation volume, append-only **and also versioned** |
| Search index | Registered users |

Audit events stood out: one per mutation, never updated, rarely queried (and then almost always by time range and actor), yet stored in the versioned table *and* indexed in the search cluster. Versioning an append-only log is meaningless, and it doubled both the write and the storage cost of what would become the largest dataset. **Turning versioning off for that one resource type was a one-line change that roughly halved the fastest-growing dataset.** Moving audit events out entirely, into cheap time-partitioned or object storage, created most of the headroom for right-sizing everything else.

### The hidden operational cost

There were several Lambdas and Step Functions whose *only* job was operating search: index setup, security setup, cleanup, pipeline management, and a "rehydrate" workflow for rebuilding the index. That's engineering time and on-call surface, not just compute.

## The consistency was worse than it needed to be

Almost every resource was indexed "immediately", meaning the API wrote to DynamoDB and *then* indexed into OpenSearch in the same request. That's a **dual write**:

- It isn't atomic. If indexing fails after the commit, the read model is silently stale, with no retry and no reconciliation. The rehydrate workflow existed to repair exactly this.
- Even on success, search is near-real-time: a refresh interval sits between write and visibility.
- Write latency pays for search, because indexing is synchronous.

(This is the same gap that makes [search-then-create a race condition](/architecture/2026/07/08/search-then-create-is-a-race.html).)

## The critical finding: the seam was already the right shape

Before recommending any migration, we read the code. Three facts changed the conversation:

1. **Every resource service was constructed identically**, with command and query providers injected separately, and there was already a **per-resource switch** for which read provider to use.
2. **The code generator already emitted SQL.**
3. **DynamoDB was used as a plain document store**: one table, *zero* secondary indexes, no clever single-table access patterns to unpick.

The architecture we wanted was already hiding behind our own abstraction. A migration didn't need a rewrite, just new providers behind an existing interface.

## The options

| Option | Summary | Verdict |
|---|---|---|
| **A. Aurora PostgreSQL replaces both stores** | One engine; CQRS preserved *physically* via writer and reader endpoints; all versions in one table, with "current" as a flag and a partial unique index instead of a duplicate row; search parameters as indexed JSONB expressions | **Recommended end state** |
| **B. Keep DynamoDB, replace only search with Postgres** | Kills the biggest cost line and the search ops burden; can run in **shadow mode**, diffing results against OpenSearch before any write changes | **Staging post to A**, but leaves the 2× floor and version growth untouched |
| **C. Right-size search, retire the ingestion pipeline** | No code change: drop dedicated masters, move the pipeline's few jobs into the existing stream worker, and cut data nodes *only after* audit events move out | **Do regardless, now** |
| **D. DynamoDB only, search via secondary indexes** | FHIR search is open-ended and there's a hard cap on indexes per table | Not viable in general |

Option D did hide one good tactic: **audit which search parameters production clients actually use**. We were paying to index every parameter of every resource. If real usage is a small fraction of the generated surface, the read model shrinks under *any* option.

With Postgres, one transaction writes the document, its version row and its search projections. You get read-your-writes on the writer endpoint, replica lag measured in milliseconds on readers, and **no second system to reconcile**, so no repair tooling.

## Don't forget the event stream

Consumers and analytics depended on change-data-capture events, so any migration had to preserve that contract. The target is a **transactional outbox**: write the event row in the same transaction as the resource and its version row, and have a relay publish from the outbox in order.

The obvious like-for-like alternative is database logical replication into a managed CDC service. We rejected it for three reasons:

1. **You need the transformation code anyway.** Replication gives you row images, not domain events. Reconstructing "created" versus "updated" events, with a correctly shaped previous state, means writing the transformation regardless, so a replication service moves the work without removing it.
2. **Previous state is expensive from the write-ahead log.** It requires logging the full old row on every update, a big WAL increase at scale. The application already holds the previous and current resource in memory when it updates.
3. **Replication slots are an availability footgun.** A stalled consumer makes the primary retain WAL until the disk fills.

The review also found defects in the existing CDC path that needed fixing whatever we decided, including delete events that weren't emitted faithfully and broken trace propagation. Build a fidelity checklist of *today's* event behaviour before reimplementing it, or you'll faithfully migrate your bugs.

## Two tracks, two clocks

**Track 1: capacity, paced by the growth curve.** Config and small code changes: stop versioning audit events and move them out, retire the ingestion pipeline, drop dedicated masters, right-size data nodes (*only after* audit events have gone), and land analytics in object storage instead of a warehouse. None of it depends on choosing a target architecture, and all of it is valuable even if Track 2 never happens.

**Track 2: migration, paced by engineering capacity and risk appetite.** Audit real search-parameter usage (a genuine gate, since it determines index design). Then a Postgres read provider in shadow mode, per resource, starting with low-risk reference data. Then Postgres as the read model (Option B), then the write side (Option A) with the outbox running in compare-only mode first. No artificial deadline, **because Track 1 buys the runway.**

## What we considered and rejected

- **Tiering version history to object storage.** Version reads are public API contracts, and indexed lookups would become analytical queries.
- **Storing history as JSON Patch deltas.** Replaying a delta chain to reconstruct a *clinical record* adds correctness risk to a legal document. Compression gets most of the benefit.
- **A globally distributed active-active database.** Under data residency, cross-region replication is a liability, not a feature.
- **Deleting old history.** Retention is driven by clinical record-keeping, not by cost.
- **Adding Kafka for CDC.** Introducing a streaming platform in a cost-reduction programme is self-defeating.

## The general lesson

When a bill grows faster than your business, look for **duplicated state** (the same data stored twice to work around a store's limitations), **coupled scaling** (paying for CPU to get disk) and **repair tooling** (a sign that two systems silently diverge). Then read your own code before you draw a new architecture. Sometimes the cheaper design is already there, waiting behind an interface you built years ago.
