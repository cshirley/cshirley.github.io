---
title: "Rotating Credentials Without Downtime (and Knowing What They Touched)"
description: "A rotation playbook for third-party credentials across environments and regions: overlapping validity, dual-running webhook secrets, a boring checklist, and the audit trail you need before an incident, not after."
date: 2026-06-24 09:00:00 +0100
categories:
- Engineering
tags:
- security
- secrets management
- AWS
- webhooks
- auditing
author:
  display_name: Clive Shirley
---

Credential rotation is the kind of security work that nobody does until they have to, and then everyone does it at once, under pressure, at the worst possible time. After a platform-wide security review, we turned rotation from an emergency into a routine: a written playbook for every third-party credential our integration layer depends on, plus an audit of how credential *usage* is traced.

Here are the parts that generalise.

## Know the shape of the problem first

Before you rotate anything, map where credentials live and who reads them:

- **Every environment × every region.** Parameter stores are regional. A secret updated in one region doesn't exist in the other. With three environments in separate cloud accounts and two regions each, "rotate the payment key" means six updates, not one.
- **Regional applicability.** Some integrations only exist in one market. Verify, rather than assume, which regions actually hold a parameter.
- **Every consumer.** API pods and background workers read secrets at deploy or sync time. Serverless functions may resolve them at *deploy* time through infrastructure code. CI pipelines hold their own copies for tests and deploys. **Runtime secrets and CI secrets must both be updated.**
- **Ownership.** Some credentials belong to other teams' stores. Rotate them there, but verify them everywhere you depend on them.

We keep an **inventory table**: integration, parameter name, the environment variable it maps to, and vendor-specific rotation notes (where the button is, whether overlapping keys are supported, whether a compromise means a new application rather than a new key).

## Keep secret values out of infrastructure code

Infrastructure code should manage a secret's **existence, type, encryption key and tags**, and explicitly *ignore changes to its value*. Values are set directly in the secret store by the person rotating them. That keeps secrets out of state files and plan output, and stops a routine `apply` from reverting a freshly rotated key.

## The rotation workflow

1. **Prepare.** Open a change ticket naming the credential, environments, regions and window. Confirm the target account and region. List the consumers.
2. **Rotate at the vendor, with overlap where possible.** Prefer vendors that support two active keys, or an old and a new signing secret at once. Enable the new credential *before* decommissioning the old one.
3. **Update the secret store** in each account and region, and update CI secrets where they exist.
4. **Roll the consumers:** API pods, workers, and any functions that resolve secrets at deploy time.
5. **Verify:** smoke test, then watch monitoring for a fixed period (we use 30 minutes).
6. **Revoke the old credential at the vendor.**
7. **Close the ticket.**

Go **development → staging → production**, completing both regions before promoting to the next environment.

### Webhook signing secrets need dual-running

Inbound webhooks are the easiest place to cause an outage, because *the vendor* sends the traffic:

1. Add the new signing secret at the vendor while the old one remains valid.
2. Update your secret store and roll out.
3. Confirm inbound webhooks validate, in both the vendor's dashboard and your logs.
4. Remove the old secret at the vendor.

If a vendor doesn't support overlapping secrets, schedule a short window and **expect** brief webhook failures. Make sure your handlers and the vendor's retry policy can absorb them.

## A deliberately boring checklist

Copy it for each environment and region combination:

```text
[ ] Environment and cloud account verified
[ ] Region verified; CLI/console session on the right account + region
[ ] New credential generated at vendor (matching env tenant)
[ ] Secret store parameter updated
[ ] CI secret updated (if applicable)
[ ] Vendor webhook/callback config updated (if applicable)
[ ] API pods rolled out
[ ] Worker pods rolled out (if applicable)
[ ] Functions verified / redeployed (if applicable)
[ ] Smoke test passed
[ ] Monitoring clear for 30 minutes
[ ] Old credential revoked at vendor
[ ] Change ticket closed
```

Checklists feel patronising right up until the rotation where someone updates the wrong region at 11pm.

## Rotation is half the story: can you answer "what did this credential do?"

Rotation limits future damage. When something goes wrong, the question you'll be asked is about the *past*: **what did credential X access or change, and when?** Work out whether you can answer that *before* the incident.

We audited how our platform authenticates callers and traces credential use, and found the usual layered picture:

- **Resource-level audit events** for data changes. These are the primary trail, and they're only as useful as the identity they record, so make sure the *credential* (or client), not just the resolved user, is captured.
- **Structured logs** for authentication failures and errors. Useful, but retention and query-ability vary.
- **Distributed tracing.** Excellent for correlating a request's path, but only if trace context actually propagates through queues and asynchronous workers.
- **Scope enforcement** controls what a credential *can* do, which is authorisation, not audit. Don't confuse the two when someone asks what it *did*.

The exercise surfaced **gaps in token-usage traceability**: paths where you could see *that* something happened but not reliably *which credential* did it. Common gaps are worth checking on any platform:

- **Are reads audited?** Many audit trails record only writes, which makes a credential's read activity (often the part that matters in a data-exposure incident) invisible.
- **Are failed authentications audited, or only logged?** Rejected tokens that exist only in short-retention logs are hard to investigate later.
- **Does the audit record the credential and client, or only the resolved subject?** If only the subject is recorded, you'll be joining tables by hand mid-incident.
- **Is there a "last used" timestamp per credential?** Without one, finding dormant credentials that are safe to revoke is guesswork.
- **Does auth caching at the edge hide repeat use?** Per-pod caches of authorisation decisions reduce how often the authoriser sees a token, so make sure the audit sits *behind* the cache.
- **Are sensitive headers redacted from auth logs?**

We wrote the investigation queries down ("what did credential X change?", "which client is this?", "did auth fail?", "what scopes does this token have?") so they're ready before they're needed. It was far cheaper than working them out during an incident review.

## The general lesson

Make rotation **routine**: inventory every credential, keep values out of infrastructure code, prefer overlapping validity, dual-run webhook secrets, and follow the same checklist every time. Then test your audit trail by asking the incident question on a quiet day: *what did this credential touch?* If you can't answer it quickly, that's your next piece of work.
