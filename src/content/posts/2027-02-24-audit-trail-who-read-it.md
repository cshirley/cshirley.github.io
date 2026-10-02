---
title: "Your Audit Trail Probably Doesn't Say Who Read It"
description: Mapping how a platform authenticates callers and audits their actions shows what is recorded, what is not, and the questions you cannot answer when an investigation starts.
date: 2027-02-24 09:00:00 +0000
draft: true
categories:
- Engineering
tags:
- auditing
- security
- compliance
- healthcare
author:
  display_name: Clive Shirley
---

Ask a platform team "what did this credential do last Tuesday?" and you will usually get a confident answer about writes. Ask "what did it read?" and the answer gets quieter.

I mapped how a healthcare API platform authenticates callers and audits what they do, working from the code rather than from memory. The useful result was not a flaw. It was a clear list of **which investigation questions the audit trail can answer, and which it cannot**.

## How callers are identified

Every request carries a bearer JWT. The ingress makes an auth call to an authoriser. The authoriser resolves the token to a credential, then builds an identity chain: credential, client application, organisations, roles, scopes and the actors (patient or person) it acts for. The result travels to the API as headers.

Two token types are supported: internally issued tokens verified with a shared secret, and external identity-provider tokens verified against the provider's published keys. The resolver checks that the credential exists, is active, has not expired, matches the issuer and client, and has at least one role.

The ingress caches those auth results for a period per pod. Because the cache is local to each ingress pod, a token can be freshly authorised on one pod while another still serves it from cache.

## Three layers of audit

1. **FHIR `AuditEvent` records**, the main trail. A plugin writes one on every successful create, update or delete, recording the subject, any actors, the resource and version changed, the action, a timestamp, and the trace and span IDs. Writes are asynchronous by default so they do not slow the response.
2. **Structured logs.** The authoriser logs failures such as a missing credential or an expired token. It logs only a short prefix of an invalid token, never the whole thing.
3. **Distributed tracing.** The same trace IDs are copied onto the audit records, so a mutation can be tied to its request path.

One detail I liked concerns document uploads through a pre-signed URL. The caller's identity is embedded in the object's metadata, so the background worker that processes the upload can attribute the eventual change to the right subject.

## What you cannot answer

Reading the code for gaps turns up a short list:

- **Reads and searches are not audited.** Only mutations produce an audit event.
- **Failed authentication produces no audit event.** It appears in logs, and the ingress returns a 401 or 403 before the API is reached.
- **Authorisation denials are not audited either.** Scope enforcement throws an API error, but nothing is written to the audit trail.
- **There is no usage counter or last-used timestamp on a credential.** You cannot list credentials nobody has used for a year without joining other data.

For a healthcare platform that holds patient data, the first one will matter to a privacy or compliance reviewer sooner or later. "Who viewed this record?" is a different question from "who changed it?"

## Investigating with what exists

You can still answer a lot. To find what a credential changed, query audit events by agent, using the credential reference for system tokens or the issuer and subject for external ones. Add action and date filters, and cross-reference the trace ID. To find out what a token can do, a debug operation re-runs the authoriser for a given set of headers and returns the resolved identity and scopes without making a data call.

For failed auth, you go to the logs, not the audit store.

## What I would do next

I would not bolt read auditing onto every endpoint. That produces a firehose that nobody queries. I would start with decisions:

- Decide which resource types have a legitimate "who looked" requirement, and audit reads for those.
- Record authorisation denials, at least in aggregate, so credential misuse shows up.
- Add a last-used timestamp on credentials, updated at a coarse interval, so dormant credentials can be retired. This also helps credential rotation.

## The general lesson

An audit trail is a set of **answers to specific questions**. List the questions an investigator, a regulator or a customer will ask, then check, from the code, that each one has a query that answers it. Where it does not, decide deliberately whether that is a gap you accept.
