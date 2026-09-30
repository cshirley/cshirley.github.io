---
title: "Carving a Shared Service Out Into a Regional Environment"
description: "When a regional business is divested, the shared services it depends on have to move too. A practical checklist for relocating a multi-tenant service and its data: stand up, copy, prune, re-point, verify."
date: 2025-03-12 09:00:00 +0000
draft: true
categories:
- Architecture
tags:
- migrations
- multi-tenancy
- divestiture
- Kubernetes
- Postgres
author:
  display_name: Clive Shirley
---

Platforms built for global growth accumulate **shared services**: a tenancy authority that knows every partner and their hierarchy, an authorisation evaluator, configuration services. They run once, in a "global" environment, and every regional stack calls them.

That's efficient until a region has to stand alone, for example when a regional business is sold and its platform must run independently in its own environments. That's the situation we were in with a Canadian telehealth operation. Its region-specific services all depended on a tenancy service that lived in the shared global environment.

Here's the approach we took to carve it out. It's mundane, and that's the point.

## Principles

- **Copy, don't move.** The global service and its database stay untouched. The regional copy is created from an export, then pruned. Nothing is deleted from the global side.
- **Run inside the region.** The regional copy runs *in* the regional cluster, and every regional service is re-pointed to an in-cluster address. No cross-environment calls remain.
- **Rehearse in pre-production first**, with a written runbook, then repeat it exactly in production.

## The checklist

1. **Stand the service up in the regional environments.**
   - Add it to the regional infrastructure project and to observability.
   - Add the deployment manifest.
   - Copy the secrets it needs from the global secret store into the regional one.
   - Make any service changes needed to run standalone (in our case, database migration tooling had to run on a fresh database).
2. **Export the database** from the global environment, using a scripted, repeatable runbook.
3. **Import it** into the regional environment.
4. **Prune, in the region only.** Remove tenants that don't belong to the regional business, then clean up references to deleted tenants in dependent data (portal logins, partner-scoped configuration). Partner hierarchies are trees, so deleting a partner means deleting its descendants too. A recursive query that walks ancestors and descendants makes this safe and reviewable. **Take a backup before and after pruning.**
5. **Test the copy directly**: health endpoints, then real lookups for the tenants that should exist (and a check that the ones that shouldn't are gone).
6. **Re-point the dependent services** to the in-cluster address and deploy them.
7. **Smoke-test the user-facing surfaces**, particularly partner portals, which exercise tenancy most heavily.
8. **Re-point any remaining regional services**, then monitor tenancy errors in the regional telemetry for a period before calling it done.

## Things that bite

- **Implicit dependants.** The hardest part is knowing *every* service that calls the shared one. We listed them explicitly (core API, consultations, feature configuration, the GraphQL gateway, membership plans, product configuration) rather than trusting memory.
- **Secrets drift.** Copying secrets by hand is where typos live. Script it, and verify each one by exercising the path that uses it.
- **Referential leftovers.** Pruning tenants from the authority doesn't prune references to them held by other services. Find those references before users do.
- **"Test" tenants.** Every environment has a few. Decide deliberately whether they travel.

## The general lesson

Shared services are a loan against future independence. When a region has to stand alone, don't try to make the shared service multi-region on the fly. **Copy it into the region, prune what doesn't belong, and re-point the consumers**, using a runbook you rehearse before production. Boring migrations are the ones that work.
