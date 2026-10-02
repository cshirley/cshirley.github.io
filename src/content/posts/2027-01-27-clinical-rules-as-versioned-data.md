---
title: "Clinical Rules Belong in Data You Can Version"
description: "Designing a pre-prescription review engine: an event-driven, advisory service with hard blocks, soft holds, rule versions stamped on every record, and a deliberate refusal to prescribe."
date: 2027-01-27 09:00:00 +0000
draft: true
categories:
- Architecture
tags:
- healthcare
- HL7 FHIR
- specifications
- patterns
author:
  display_name: Clive Shirley
---

A clinical rules engine is easy to describe badly. "It reviews prescriptions and decides what to do" sounds like automation of the prescriber. The system I helped design deliberately does not do that.

The context is a UK GLP-1 weight-loss programme. Each prescription case used to pass through two levels of people: a technician who compiled information, and a clinician who decided. Most cases went through without any issue, so the first level was mostly double handling. The aim was a single level, where a rules engine prepares each case and the **prescriber still makes the final decision**.

This post covers four design choices I would repeat:

- The engine is advisory.
- Rules are data you can version.
- Results go in their own resource.
- You run it in parallel before you switch anything over.

## What the engine does and does not do

It reads the relevant clinical data (questionnaire answers, the patient, prescriptions, consent, observations, care plan, medications, prior communications), evaluates the rule set, and produces an analysis for the prescriber. It then triggers automated messages for the simple cases, such as missing blood results.

It does **not** prescribe, replace clinical judgement, message patients directly, or store clinical data of its own. The prescriber's confirmation is mandatory for every case.

One wording decision is worth copying: the output is a **dose summary**, not a dose suggestion. The clinical leads chose that deliberately so the software stays on the right side of medical-device classification. A name is a design constraint.

## Hard blocks and soft holds

The rules fall into series, evaluated in a fixed order:

- **Hard blocks** stop prescribing until resolved: no GP on file, a contraindication, blood results missing or out of range, expired consent, missing transfer evidence.
- **Soft holds** need a prescriber's review but can be overridden with a documented reason: adverse events, weight gain, early refill, medication cautions.
- **Safeguarding patterns** flag rapid weight loss or a low BMI trajectory. These get an elevated approval track for any rule change.
- **Blood result rules** evaluate the standard marker panel.
- **Dose and eligibility rules** derive the dose summary and enforce programme maximums.

The split between hard and soft matters because it decides who acts. Administrative hard blocks, such as missing bloods or consent, go straight to automated patient messages with no prescriber. Clinical holds and clear cases go to the prescriber queue.

## Event-driven, not called

The engine is an independent service that consumes events from the platform: a questionnaire submitted, or a scheduled auto-refill firing. It reads, evaluates, pushes a routing instruction to the existing prescriber tool, and writes its audit trail. Nothing calls it synchronously.

That keeps the first version small. The prescriber UI is the existing one, so the engine delivers clinical value without a new portal. I also argued for a **linear, re-entrant process** rather than a sprawling workflow, because it is far easier to monitor in production when something stalls.

## Store the result as its own resource

We discussed adding fields to the existing prescription resource and decided against it. A separate custom resource acts as an enrichment record. It avoids bloating a resource many other things depend on, and it suits event streaming, auditing and immutable record-keeping.

Every evaluation also writes an append-only audit record, and every prescription and audit entry is tagged with the **rules version** that produced it. When someone asks why a case was held in March, you can answer with the exact rule set.

## Rules are governed like code

Rules live in a configuration repository and are versioned. Changes are classified, and the safeguarding series needs elevated approval. The rule register ran to dozens of rules, and implementation progress was tracked as groups of rules that share data sources, so shared data layers (weight history, for example) were built once.

Two practical lessons from the tracking:

- Group rules by the data they read, not by clinical theme.
- Mark clinical review as open. Rules and message templates were under active review while engineering started, so the spec said so on its first page.

## Run it beside the old process

Phase 1 runs in parallel with the existing rules. The engine's output is advisory at first, and the switch-over is controlled. We also expected it to be more cautious than people: the share of cases passing straight through might drop from around 90% to around 75%. That is still a large efficiency gain once automated communications handle missing information.

A simple agree/disagree control for clinicians on each summary gives you data on where the rules fail.

## The general lesson

When software sits next to a clinical decision, **keep the human decision, version everything that influenced it, and store the analysis separately from the record it informs**. Rules as versioned data, plus an append-only trail, let you change them quickly without losing the ability to explain what you did last month.
