---
title: "Decommissioning a Telehealth Platform Without Losing the Records"
description: "Switching off a platform is easy; keeping its patient records accessible for regulators, lawyers and GDPR requests for another decade is not. How we chose a single final resting place and built a simple, repeatable export."
date: 2025-04-16 09:00:00 +0100
draft: true
categories:
- Architecture
tags:
- decommissioning
- data migration
- GDPR
- ETL
- healthcare
author:
  display_name: Clive Shirley
---

When a digital health service closes, the members can move to a new provider in a matter of weeks. The **data** can't just be switched off. Clinical records have retention obligations measured in years, legal discovery may need them, and patients keep their GDPR rights: access, and in some cases erasure.

This spring we started decommissioning a UK telehealth platform whose members had already moved to another provider. It was a typical microservice estate: many services, each the system of record for its own domain, spread across SQL and NoSQL stores, with data replicated and reshaped into Kafka topics, an analytics warehouse and a FHIR-based health graph. Here's how we approached it.

## First decide what to keep

The retention requirements came first, before any architecture:

- Patients who **never had a medical interaction** with us: delete.
- Patients who **did**: keep their records, and make them readily available.
- Honour retention periods, legal-discovery requirements and GDPR requests for as long as we hold the data.
- Export into a **standard format**, and be able to answer GDPR queries against it.
- Decide which **third-party references** to keep (payment, identity verification, messaging and insurer identifiers), because regulators may ask how a record connects to the outside world.

## Pick one final resting place

It isn't practical to export *every* store, preserve them all, and keep a way to read and amend each one. We also weren't fully confident that the replicas held a complete copy of every system of record.

So we chose **one destination**: the existing Elasticsearch-backed FHIR repository behind the health graph, **augmented** with whatever was missing from the systems of record. The reasons:

1. A substantial share of the data was **already there**, exposed through the health graph and its federated API.
2. The federated graph schema told us which **other data and sources** we needed to fill the gaps.
3. The team already ran Elasticsearch as the read side of a CQRS pattern on the new platform, so **the expertise would outlive the project**.
4. FHIR's subject-centred structure makes it easy to pull **everything about one patient**, which is exactly what regulatory, legal and GDPR requests need.
5. We'd recently done a similar export for another regional platform, so the **key health data and export scripts already existed** to adapt.

## A deliberately simple ETL

Each data source gets a small adapter:

1. **Extract** to CSV, using SQL wherever possible, keyed on the **patient UUID**.
2. **Transform** into one JSON document **per patient**, with one array per data source and one CSV row per array element:

```json
{
  "id": "<patient-uuid>",
  "consultations": [],
  "identity_checks": [],
  "allergies": [],
  "prescriptions": []
}
```

3. **Load** from a sharded directory tree (`shard-N/<patient-uuid>.json`) into the destination.

A few practical details made it work:

- **Database access.** The legacy databases only accepted connections from inside the cluster. `kubectl port-forward` through a pod gave us a tunnel, and standard database tools handled the CSV export, with no new infrastructure needed.
- **Application-level encryption.** Some fields were encrypted with various AES schemes. The transform step decrypts them, so the resting data is readable by authorised staff and the archive is protected by storage-level encryption and access control instead.
- **Multi-line fields.** Free-text clinical notes break naive CSV. We exported those fields as **Base64**, which both database engines support natively, and decoded them during the transform.
- **One mapping rule everywhere.** One CSV row became one array element in every source. That's boring, uniform and easy to review, which matters more than elegance when the output is a legal record.

## Make GDPR operations cheap

Documents named by patient UUID in a sharded tree can be queried with `jq` and `grep` in an emergency. For day-to-day operations we also generated a **CSV index file** of patient metadata, which makes subject-access and erasure requests a lookup rather than a search across millions of files.

## The general lesson

Decommissioning is a **data** project wearing an infrastructure costume. Settle the retention rules first, choose a *single* destination your team will still understand in ten years, and keep the export mechanical: one key, one document per subject, one mapping rule. Clever pipelines are hard to explain to an auditor; simple ones aren't.
