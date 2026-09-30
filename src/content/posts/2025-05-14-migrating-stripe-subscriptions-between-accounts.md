---
title: "Move the Smaller Population: Migrating Live Stripe Subscriptions Between Accounts"
description: "When two businesses sharing one Stripe account need to separate, the question isn't how to move customers. It's which customers to move. Move the smaller, quieter population and leave the growing one alone."
date: 2025-05-14 09:00:00 +0100
categories:
- Payments
tags:
- Stripe
- subscriptions
- migrations
author:
  display_name: Clive Shirley
---

Early-stage businesses often share infrastructure for speed. A new consumer brand launches on its parent company's platform, and on its parent's **Stripe account**. It works well until the new brand incorporates, opens its own bank account and wants to take its own payments.

We were in exactly that position. The new brand had **over 30,000 paying customers and was growing fast**. The same Stripe account also held a few hundred **active legacy subscriptions** (monthly and annual) from an older telehealth product that was being wound down.

## The options

When we first looked at this, we wrote down three options:

1. **Migrate the new brand's customers** to a new Stripe account. That's the obvious reading of "they need their own account".
2. **Send only new customers** to a new account. That needs the payment architecture to support *multiple accounts for the same provider* in one deployment, which it didn't, and it leaves the brand's revenue split across two accounts for years.
3. **Migrate the legacy customers out**, then hand the original account, with its customers, history and integrations intact, to the new brand.

Option 3 is the counter-intuitive one, and it's the right one.

## Why move the smaller population

- **Blast radius.** The growing brand's customers were actively served by the platform every day: refills, payments, webhooks. Any change to them, even a configuration change, risks disrupting live treatment. The legacy customers weren't being served by any active system.
- **Volume and risk.** A few hundred subscriptions is a migration you can verify line by line. Tens of thousands isn't.
- **Nothing to re-integrate.** The account that stays keeps its API keys, webhooks, products, prices and reporting. The platform doesn't change at all.
- **It fits the wind-down.** The legacy product was being decommissioned anyway, and exporting its Stripe data was already part of that plan.

We also wrote down a red flag at the time: *one platform taking payments into several organisations' accounts isn't a pattern to adopt casually.* If more partners were going to work that way, the payment architecture would need rework, not account shuffling.

## The migration steps

1. **Identify** the legacy customers with active subscriptions, expanding each customer object to include its metadata so the new objects can be updated after transfer. Save the full list locally as JSON, because it's your source of truth for verification.
2. **Request the customer transfer.** Stripe can copy customers and payment methods between accounts, but subscriptions don't come with them.
3. **Recreate the catalogue.** For each product and price in use, create an equivalent in the new account and keep a **mapping of old IDs to new IDs**.
4. **Recreate each subscription** in the new account against the mapped prices, preserving billing dates. **Annual subscriptions need subscription schedules**, so the customer isn't charged early or twice.
5. **Export** all legacy customer data from the original account, as part of the decommissioning archive.
6. **Delete** the legacy customers and their data from the original account.
7. **Update the downstream consumers.** A partner used an eligibility list, generated from subscription status, to decide whether a legacy member could still book appointments. It needed the new API key and product ID.
8. **Hand over** the original account to the new brand.

## Things to get right

- **Dry-run everything** against the saved JSON, and diff expected against actual after each step.
- **Pause payment activity** for the migrating population during the switch, and make sure nothing (webhooks, scheduled jobs) is still pointed at old IDs.
- **Keep the ID mapping forever.** Finance, support and refunds will need to trace old invoices to new subscriptions long after the project ends.

## The general lesson

When two populations share an account, move the one that's **smaller, quieter and not growing**, and leave the busy one completely untouched. The best migration for your most valuable customers is the one that doesn't happen to them.
