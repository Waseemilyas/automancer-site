---
title: Automating a ~600-person care provider, one governed workstream at a time
description: A multi-branch supported-living provider's whole digital spine, rebuilt as ~18 governed workstreams — with a live ERP that turned messy CSVs into 294 clean carer records and 588 auto-created supervision schedules.
summary: Rebuilding the digital spine of a multi-branch, CQC-regulated care provider as ~18 governed workstreams. The core platform alone imported 294 carers and 293 service users as clean records and auto-created 588 supervision schedules.
date: 2026-06-20
sector: Social care / supported living
tags: [ERP, compliance, LMS, dashboards, custom software]
anonymised: true
featured: true
order: 1
status: Live production pilot
client: A ~600-person supported-living care provider, with branches across the Midlands and West Yorkshire.
headline: Care without the clipboard.
subhead: We're rebuilding the entire digital spine of a multi-branch, CQC-regulated care provider — around 100 office staff and 500 support workers — as roughly eighteen governed workstreams, several already live in production.
stats:
  - { v: "294 + 293", l: "carers and service users imported as clean, canonical records from real CSVs" }
  - { v: "588", l: "supervision & spot-check schedules created automatically" }
  - { v: "274 / 418", l: "duplicate/ambiguous records auto-resolved by identity matching" }
  - { v: "0 / 0", l: "failures and warnings across the production infrastructure audit" }
---

## A whole care business, held together by spreadsheets and goodwill

Supported-living care runs on paperwork — rosters, supervisions, medication records, training compliance, incident logs, mileage claims, timesheets — and this provider was running most of it by hand, across three branches, on a patchwork of outsourced platforms and spreadsheets that didn't talk to each other.

The costs of that show up everywhere a regulator looks. Compliance evidence scattered across different providers. Refresher training tracked manually. Care-quality signals buried in separate systems that only got cross-checked when someone had a spare afternoon. And a 500-strong support-worker workforce that didn't even have a consistent digital identity to log in with.

They didn't need one more app. They needed someone to systematically automate the whole business — carefully, in the right order, without breaking the care in the meantime.

## One transformation, delivered as ~18 governed workstreams

Instead of a risky big-bang overhaul, we broke the transformation into governed lanes — each scoped, built, and board-gated before anything touched real client data. Here are the ones that matter most.

### The core platform (ERP / CRM)

The strongest single piece of the work. We built a modular platform to replace the reach of an outsourced system that only covered recruitment — a canonical people registry with identity matching, an append-only audit trail, an ingestion pipeline (email, automated capture, manual entry), report mirrors reconciled against real exports, a task engine with a "My Planner" view, service-user referral-to-onboarding journeys, incident case management, and a requisition-governance module.

The hard facts, all from the real work:

- A single roster import created **294 carers and 293 service users** as clean canonical records — straight from the client's real CSVs.
- Identity matching **auto-resolved 274 of 418** review candidates, so humans only had to look at the genuinely ambiguous ones.
- **588 supervision and spot-check schedules** were instantiated automatically.
- Everything reconciled against real exports — 500 visits, 175 medication alerts, 416 names routed to review — so the numbers could be trusted.

It's live: a production pilot the client is actively using and giving structured feedback on.

### Self-hosted Learning Management System

We replaced outsourced training and manual, spreadsheet-based refresher-tracking with a self-hosted LMS — plus a custom compliance layer to track mandatory, refresher and overdue training the off-the-shelf tool couldn't handle natively. Seeded across all three branches, courses loaded, and staged for go-live. It turns scattered CQC inspection evidence into one place you can actually point an inspector at.

### QA / management oversight dashboard

Live. It pulls care-quality signals from multiple systems into one view — KPI cards, branch comparisons, a support-worker priority watchlist, a repeat-concern watchlist for service users, medication review, and a filterable review queue. Instead of hunting through separate systems for exceptions, managers see what needs attention in one place.

### Production infrastructure, done properly

All of this runs on hardened, monitored, EU-hosted infrastructure built as code — with real backups and a *verified* restore test, not just a hopeful one. The documented audit came back with **zero failures and zero warnings across every layer.** We don't just build it; we run it properly.

### Support-worker digital identity

The 500-strong support-worker workforce had no consistent login identity — which was quietly blocking the LMS and portal rollout. We gave every worker a managed, EEA-hosted mailbox identity, with DNS verified and provisioning tooling built to roll it out safely.

**And more, in active build:** a staff intranet and portal (announcements, HR resources, policy acknowledgement, clock-in/out), a mobile mileage-claims app with an automated eligibility-and-variance rules engine, and support-worker leave requests — plus a stack of discovery work: an M365 governance audit, an AI rota-scheduler feasibility study, VoIP call-transcription compliance analysis, and governed WhatsApp announcements.

## Governed, staged, and never reckless with real care data

Care is not a place for "move fast and break things." Every workstream was governed: scoped, built on staging, reconciled against the client's real exports, and board-gated before it went anywhere near live service-user data. The client tests each lane and gives structured feedback before it's signed off.

That's the same discipline we hold our own infrastructure to — audited, monitored, backed up, restore-tested. It's why a care provider can trust us with the spine of their business.

## Live, in production, and growing

- The core platform is a **live production pilot** the client is actively using.
- **294 carers and 293 service users** exist as clean, canonical, auditable records where before there were CSVs and duplicates.
- **588 supervision schedules** are created and tracked automatically instead of by hand.
- The QA oversight dashboard is **live**, giving managers one place to see what needs attention.
- Production infrastructure passed its audit with **zero failures and zero warnings.**

[METRIC: hours saved per week on QA/exception review — awaiting Waseem]

[METRIC: time saved on roster/identity reconciliation — awaiting Waseem]

[METRIC: before/after error rate on records and scheduling — awaiting Waseem]

[METRIC: adoption numbers once the LMS and staff portal go live — awaiting Waseem]

[TESTIMONIAL: quote from client owner/operator — awaiting permission & sign-off from Waseem]
