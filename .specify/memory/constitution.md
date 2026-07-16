<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Template Principle 1 -> I. Lightweight, Zero-Licensing Stack
- Template Principle 2 -> II. Offline-First Scanning
- Template Principle 3 -> III. GUID Identity, Cheap Replaceable Tags
- Template Principle 4 -> IV. Audit Trail on Every Action
- Template Principle 5 -> V. Security Before Convenience
Added principles:
- VI. Simplicity Until Proven Otherwise
Added sections:
- Delivery Standards
- Change Review Workflow
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ✅ .specify/templates/checklist-template.md
Follow-up TODOs:
- None
-->
# NFC Asset Tracker Constitution

## Core Principles

### I. Lightweight, Zero-Licensing Stack
The application MUST run on commodity hardware (Raspberry Pi, small VM, laptop, or existing
Android devices) with no paid licenses required. The stack is fixed as: PWA front end
(Bootstrap + vanilla JS + Web NFC API), Node.js + Express back end, and SQLite for storage.
Introducing a new runtime, framework, or paid service (cloud database, managed auth provider,
SPA framework, etc.) MUST be justified in a plan's Complexity Tracking section and MUST NOT
replace the fixed stack without an explicit constitution amendment. Rationale: this system is a
proof of concept that must stay deployable anywhere with zero software cost.

### II. Offline-First Scanning
Verification and scan flows MUST continue to function without a network connection. Scans made
offline MUST be queued client-side (IndexedDB) and MUST be synced automatically once
connectivity returns, without data loss or duplicate submission. Any feature that depends on
live connectivity MUST surface a clear, user-visible offline/pending state rather than failing
silently. Rationale: assets are verified at remote sites, depots, and locations with unreliable
connectivity.

### III. GUID Identity, Cheap Replaceable Tags
Every asset MUST be identified by a stable GUID, encoded on both its NFC tag and a QR backup
label. NFC tags and QR codes MUST carry only the identifier (e.g. the GUID or asset number) —
never asset details — so tags stay cheap, replaceable, and free of stale data. All asset detail
lookups MUST happen server-side via that identifier. Rationale: keeps tag hardware inexpensive
and avoids re-encoding tags whenever asset data changes.

### IV. Audit Trail on Every Action
Every create, update, transfer, and verification action MUST be recorded with timestamp,
acting user, and — for verification/scan events — GPS coordinates when available. Historical
records in `asset_history` and `verification` MUST NOT be mutated or deleted by normal
application flows; corrections are additive (new entries), not edits of prior entries.
Rationale: the primary business value of this system is a trustworthy, tamper-evident audit
trail for asset location and custody.

### V. Security Before Convenience
Authenticated sessions, password hashing, rate limiting, and security headers (helmet) MUST
remain enabled on every environment. Uploaded files (photos, CSV imports) MUST be validated
for type and size server-side before being persisted or processed. Secrets (session secret,
admin credentials, etc.) MUST be supplied via environment configuration and MUST NOT be
committed to source. Moving from local SQLite auth to an external identity provider (e.g. Entra
ID) MUST preserve these same guarantees. Rationale: the system holds custody, location, and
identity data for physical assets and must resist tampering even as a proof of concept.

### VI. Simplicity Until Proven Otherwise
Start with the simplest solution that satisfies a requirement (SQLite, local auth, plain
server-rendered/vanilla-JS pages) and only add complexity when a concrete limit is reached —
for example, migrate from SQLite to PostgreSQL only once the asset register approaches roughly
50,000 records. Speculative infrastructure, abstractions, or configurability MUST NOT be added
ahead of an actual, stated need. Rationale: this project is explicitly scoped as a proof of
concept that must stay easy to run, read, and modify.

## Delivery Standards

Feature specifications MUST state which parts of the system are in scope (`public/` front end,
`routes/` API, `db/` schema, `middleware/`) and MUST call out: offline behavior impact, NFC/QR
tag format impact, audit-trail (asset_history/verification) impact, and any new/changed
authentication or authorization requirement.

Implementation plans MUST name the real npm scripts used for validation (`npm start`,
`npm run dev`, `npm run seed`) and MUST preserve compatibility with the existing SQLite schema
in [schema.sql](../../db/schema.sql) or include an explicit, reviewed migration path.

## Change Review Workflow

Before implementation begins, the Constitution Check in the plan MUST confirm: stack fit
(Principle I), offline impact (Principle II), tag/identifier format impact (Principle III),
audit-trail impact (Principle IV), security impact (Principle V), and that no unjustified
complexity has been introduced (Principle VI).

Pull requests and reviews MUST verify compliance with this constitution. Any intentional
violation MUST be documented in the plan's Complexity Tracking section with a concrete reason
and the simpler rejected alternative.

## Governance

This constitution overrides conflicting local habits and template defaults. Amendments MUST be
made in the same change set as any required template or guidance updates, and each amendment MUST
add a Sync Impact Report at the top of this file summarizing the propagation work.

Versioning follows semantic versioning for governance: MAJOR for incompatible removals or
redefinitions of principles, MINOR for new principles or materially expanded requirements, and
PATCH for clarifications or wording-only refinements. Compliance review is required during
specification, planning, task generation, and pull request review.

**Version**: 1.0.0 | **Ratified**: 2026-07-16 | **Last Amended**: 2026-07-16
