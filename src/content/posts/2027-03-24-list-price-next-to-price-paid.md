---
title: "Record the List Price Next to the Price Paid"
description: Finance could not tell what a dispensed medication should have cost, what was paid, or which invoice funded it. Three modelling gaps behind a fragile reconciliation chain, and what to record instead.
date: 2027-03-24 09:00:00 +0000
draft: true
categories:
- Payments
tags:
- payments
- pricing
- Stripe
- discounts
author:
  display_name: Clive Shirley
---

"Which payment funded this dispensed medication, and what should it have cost?" Finance asked that question every month, and answering it took five manual steps and a lot of caveats.

I reviewed the problem on a healthcare platform that sells medication through Stripe. The finance team needs to recognise revenue for medication dispensed in a month against the money received, consistently across regions, with the payment provider as the source of truth. They needed four answers per dispensed item: the payment that funded it, the expected cost, the amount actually paid, and the reason for any difference.

This post is about three modelling gaps that made those answers hard, and the simple requirements that would close them.

## The fragile chain

To reconcile one month, finance would:

1. Build the list of dispatched medications by joining payment notices to dispenses through prescribing service requests.
2. Categorise the payment notices as onboarding or prescription.
3. Match the onboarding (blood test) notices to the first prescription notice or invoice.
4. Download a transaction report from Stripe.
5. Reconcile the two sides by invoice ID.

Each step has an assumption in it, and the report sometimes returns empty invoice IDs for transactions that are visible in the dashboard. Reconciliation by hand does not scale, and it quietly produces wrong numbers.

## Gap one: payment before the order exists

During onboarding, the customer pays before the service request is created. The payment notice therefore cannot link to a service request at payment time and is attached to the care plan instead. Finance has to traverse extra relationships and make assumptions to learn which payment funded which fulfilment.

This is a consequence of the flow, not a bug. But the consequence is a link that is *derivable* rather than *direct*, and every derivation is a place for error.

## Gap two: one payment notice, several invoices

The onboarding step can create more than one invoice, so a payment notice and an invoice are not always one to one. It can involve two charges, and in some cases the notice is missing the invoice ID. When the mapping is ambiguous, "which invoice represents this payment" needs a person.

## Gap three: the list price is not recorded

Promotions were applied by changing the onboarding price directly. Stripe and the platform then only record the final amount the customer paid. Nobody stored what the item should have cost, so "how much discount was applied" cannot be answered from data. And where a price ID bakes a discount in, finance maintains the mapping by hand. This is why I like [one list price with discounts as coupons](/payments/2026/07/22/one-list-price-many-coupons.html): the same rule that keeps Stripe tidy keeps finance honest.

## What to require

I framed the fix as requirements, not a design, so the team could choose the implementation:

1. **A deterministic link from fulfilment to payment.** Ideally direct, and never dependent on traversing unrelated entities.
2. **A clear payment-to-invoice mapping.** One to one where possible, and explicit linkage where not.
3. **Expected price and paid price recorded separately,** so that *expected price minus discount equals amount paid* can be checked rather than inferred.

Possible implementations I listed:

- A custom Stripe report driven by invoice ID. It has to handle payments and dispenses falling in different months.
- Fixing the onboarding payment notice linkage.
- Adding metadata to invoices.
- Adding metadata to prices that says which coupon discount is included.

## Things to get right

- Make Stripe the source of truth for money, and make your own records point at it by ID, not by inference.
- Do not rely on the provider's report having every field you need. Test for empty IDs.
- Write the finance questions down before designing the data model, because they define which links must be direct.

## The general lesson

A payments design is not finished when the charge succeeds. It is finished when someone outside engineering can **trace one dispensed item to one payment, one invoice and one list price** without a spreadsheet. Record the list price next to the price paid, and make every link direct, so that reconciliation is a query rather than an investigation.
