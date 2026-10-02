---
title: "Buy the Feed, Own the Adapter: Build vs Buy for Carrier Tracking"
description: Tracking parcels across several couriers looks like an integration task but is really a maintenance commitment. How we framed build versus buy around expansion, courier leverage and an adapter seam.
date: 2026-12-30 09:00:00 +0000
draft: true
categories:
- Architecture
tags:
- build vs buy
- vendor evaluation
- fulfilment
- integration patterns
author:
  display_name: Clive Shirley
---

Courier tracking looks like an integration task. Call each courier's API, store the status, show it in the app. The estimate comes out as a few engineer-weeks per courier and everyone moves on.

I reviewed a business case for exactly this on a healthcare platform that ships medication to patients in the UK and the US. Patients need live delivery status and push notifications, the clinical record needs an accurate delivery history, and the data team needs courier SLA reporting. The choice was to build each courier integration ourselves or to license an aggregator that sits in front of 100+ couriers.

This post covers how the case was framed, why **the decisive argument was not the licence fee**, and the one architectural rule that makes buying safe.

## Why couriers are not one integration

Every courier exposes tracking differently. One pushes updates to us in real time through webhooks. Another has to be polled on a schedule. Each has its own status codes, data formats and authentication, and each changes them without much notice.

Building in-house means owning all of that variety for good: a client per courier, polling workers for the couriers with no push feed, and a translation layer for status codes. The up-front estimate was 8 to 10 engineer-weeks for the UK and US, against 2 to 3 for a single aggregator integration.

The up-front number is not the important one. The important one is the **maintenance**. Courier API changes arrive in bursts, tracking breaks until someone fixes it, and the load grows with every courier we add. That is unplanned, reactive work, and it is paid for in scarce engineering capacity rather than on an invoice.

## The argument that decided it

| Question | Build in-house | Aggregator |
|---|---|---|
| Add a new region | Build and test a carrier client first | Configuration change |
| Switch or add a courier | Engineering project | Pass a different carrier code |
| Ongoing maintenance | Grows with each courier | Flat |
| Licence cost | None | Small per-shipment fee |

Two points did the work.

**Expansion.** Canada and Germany were planned, with shipping arrangements still undefined. With in-house integrations, tracking would sit on the critical path of every regional launch. With an aggregator, the likely couriers were almost certainly supported already, so tracking would not block a launch whatever the final decision was.

**Courier leverage.** If you can only ship with the couriers you have built integrations for, courier choice becomes an engineering decision. You stay with incumbents longer than is sensible because switching has a hidden build cost, and that weakens your hand at every contract renewal. With an aggregator, moving volume between couriers is a commercial decision. That is a benefit you will not find in a cost spreadsheet.

I would also point out what the case did **not** do. It did not claim the in-house option was free to run, and it did not hide the weak spot: the Canada and Germany volumes and carriers were planning guesses, labelled as such.

## Pick on fit, not on feature count

Four vendors were compared. All of them supported every courier we needed. The cheaper options did exactly one thing: deliver a normalised tracking feed. The pricier ones bundled hosted tracking pages, branded email and SMS, and returns management.

We already had all of that natively: the tracking UI in our own app, notifications through a messaging platform, and delivery data in our own records. Paying the premium would have bought duplication. We needed the feed and nothing else, so we chose the vendor with usage-based pricing and no annual commitment.

## Own the adapter

The risk of buying is lock-in, and the answer is a seam, not a promise. The vendor sits behind a single internal adapter. The patient app, notifications and clinical records see our model of a delivery, never the vendor's.

Two details matter:

- **Keep the raw data.** Aggregator feeds include the standardised status and the original courier-level detail. Store both, so the analytics team loses nothing and a later vendor switch can be replayed.
- **Know the failure mode.** If the vendor is down, tracking updates are delayed, not lost, and shipments are unaffected.

With the adapter in place, switching vendor touches one component. The usage-based contract means no exit cost either.

## Things to get right

- Label estimates you do not have yet. Future-region volumes are guesses, so say so and revisit them.
- Count maintenance as well as build effort. Bursty work annualises into a real cost.
- Check whether you are paying for features you already have.
- Cost the *option value*: what does it cost you to say yes to a new region or a new courier?

## The general lesson

When a dependency changes on someone else's schedule, **buy the commodity and own the seam**. Build only where the variation is your competitive edge. For everything else, the best design is the one that makes the next market, the next courier or the next vendor a configuration change.
