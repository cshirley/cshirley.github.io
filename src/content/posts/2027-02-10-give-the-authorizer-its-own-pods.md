---
title: "Give the Authoriser Its Own Pods"
description: An auth endpoint running in-process beside a CRUD API shares its CPU, deploys and failure modes with every consumer. A same-image split, rolled out one consumer at a time, fixes the coupling.
date: 2027-02-10 09:00:00 +0000
draft: true
categories:
- Engineering
tags:
- Kubernetes
- scaling
- reliability
- migrations
author:
  display_name: Clive Shirley
---

The authorisation endpoint for a platform is a strange kind of service. It is small, hot, and on the critical path of every request that passes through the ingress. And it is often the last thing anyone thinks to deploy on its own.

On a healthcare platform I work on, the `/authorize` endpoint ran **in the same Node.js process** as the platform's main CRUD API, on a second port. Other services pointed their ingress auth calls at it.

This post covers why that coupling hurt, why "just scale it more" was not the answer, and a low-risk way to split it. It is based on an RFC, so it describes the plan and its safeguards rather than a finished result.

## What the coupling looked like

The two servers shared a pod, a CPU and memory budget, one autoscaling policy and one health check. The authoriser code was already decoupled: its own config, hooks, health API, dependency injection and response cache. The only real coupling was **the pod it lived in**.

Authorisation was also expensive. Each request does lookups against the document store and the search index, and in the biggest region the combined workload scaled to 15 replicas.

## Why scaling the existing workload is not enough

Raising replicas adds capacity. It does not fix:

1. **Noisy neighbours.** A bulk import and an auth spike share one budget, and a single CPU-based autoscaler cannot tell which of them needs help.
2. **Scaling the wrong thing.** Every extra pod duplicates the whole API's footprint, when only the narrow `/authorize` path needed more.
3. **Blast radius.** Every other service's ingress auth depends on these pods. A memory leak or a bad deploy in the CRUD API takes auth down for the whole organisation.
4. **Deploy coupling.** The CRUD API deploys often and has about 70 controllers. Each routine change rolls the pods that serve organisation-wide auth.
5. **Health-check blindness.** Probes only hit the public port. If the authoriser degrades because the cache is down or the database is throttling, the pod still looks healthy.
6. **One scaling signal.** Auth load follows request rate from other services, while CRUD load follows the platform's own domain traffic.

There is a fair counterargument. If you have headroom, no history of one half taking out the other and no need for different autoscaling metrics, scaling the combined workload is simpler. It carries no migration risk. The split is worth it **when the coupling itself is the pain**, not just raw capacity.

## Two options

- **Option A: a fully separate package and image.** Clean, but it needs a new Dockerfile, bundle entry point and image repository, plus an IAM decision and removal of the wiring from the API.
- **Option B: the same image with a mode switch.** An environment variable, `SERVER_MODE`, picks `all`, `platform` or `authorizer`. Two entries in the deployment config build from the same Dockerfile and differ only in mode, ports, replicas, resources and health checks.

```ts
const SERVER_MODE = process.env.SERVER_MODE || "all"; // "all" | "platform" | "authorizer"
const runPlatform = SERVER_MODE === "all" || SERVER_MODE === "platform";
const runAuthorizer = SERVER_MODE === "all" || SERVER_MODE === "authorizer";
```

I recommended B. Flipping between one workload and two becomes a config change with no new infrastructure, and it keeps the migration **purely topological**: no behaviour change, so any incident is attributable to the move. The costs are that a bad build hits both workloads and there is no independent release cadence yet. If you need either one later, you can go to A, and the traffic migration will already be done.

## Watch the connection pools

One effect is easy to miss. Both servers used module-level singleton clients for the document store and search index. In one process they shared a single pool. After the split each workload has **its own pool**, so total connections to the database and search cluster can exceed the old combined total.

That is mostly a good thing, since the pools can now scale separately. But it needs a capacity check before cutover, and it belongs in the bake-period checks.

## Roll out one consumer at a time

The risk is not the code, it is the many consumers. The plan had four phases:

1. **Prepare.** Add the mode switch with a default that changes nothing, add the new workload alongside the old, and pre-scale it. Fully reversible by deleting the new block.
2. **Cut over your own traffic first**, region by region, lowest traffic first, and watch error rate, latency, cache hit ratio and autoscaling on both workloads.
3. **Migrate other consumers** one at a time, lowest risk first. Each is a one-line change in their own pipeline, so rollback is one line.
4. **Decommission the old path** only when metrics show zero requests to it for a full traffic cycle. A config grep misses stale caches and drift.

Keep the combined mode for a release after that. A forgotten consumer fails immediately and obviously, and one environment variable restores it.

## The general lesson

Coupling at the **process level** is easy to ignore until the thing you coupled is on everyone's critical path. Separate hot, shared infrastructure from the code that changes weekly, and do it as a pure topology change with one reversible step per consumer. Once the boundary exists, you can later rewrite the leaner version of the hot path safely in isolation.
