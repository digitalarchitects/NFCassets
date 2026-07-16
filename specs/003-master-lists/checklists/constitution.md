# Constitution Compliance Checklist: Admin Master Lists

**Purpose**: Verify all constitutional principles are satisfied
**Created**: 2026-07-16
**Feature**: [spec.md](../spec.md)

## Principle I: Lightweight, Zero-Licensing Stack

- [ ] CHK001 No new npm dependencies — uses existing express, node:sqlite, express-validator
- [ ] CHK002 No external service for list management — all data in SQLite
- [ ] CHK003 No new infrastructure — same Express process

## Principle II: Offline-First Scanning

- [ ] CHK004 Scanning/verification flow unchanged — list data loaded once on page load, no extra network calls per dropdown interaction
- [ ] CHK005 Service worker caches the new admin pages (lists.html) in app shell

## Principle III: GUID Identity, Cheap Replaceable Tags

- [ ] CHK006 No change to asset identification — GUID + asset_no unchanged
- [ ] CHK007 NFC/QR tags still carry only GUID — unaffected

## Principle IV: Audit Trail on Every Action

- [ ] CHK008 FK changes (location_id, make_id, model_id, category_id) recorded in asset_history on transfer/update
- [ ] CHK009 Rename of a master list item does NOT create history entries for all affected assets (rename is metadata, not an asset action)
- [ ] CHK010 Deactivated list items remain referenced by historical assets — no broken references

## Principle V: Security Before Convenience

- [ ] CHK011 All `/api/lists/*` endpoints are admin-only
- [ ] CHK012 CSRF protection applies to all POST/PUT list endpoints
- [ ] CHK013 Name uniqueness enforced server-side (not trusting client validation)
- [ ] CHK014 Input validation on all list CRUD endpoints (name not empty, max length)

## Principle VI: Simplicity Until Proven Otherwise

- [ ] CHK015 4 flat tables instead of a generic key-value store — clear, queryable, type-safe
- [ ] CHK016 Client-side model filtering instead of extra API calls — simpler UX, fast enough for <500 rows
- [ ] CHK017 No migration framework — ALTER TABLE with try/catch in existing bootstrap
- [ ] CHK018 Old `location` text column retained temporarily — safe rollback path

## Principle VII: Container-First, Cloudflare-Published

- [ ] CHK019 No new ports — same app container
- [ ] CHK020 No new volume mounts — SQLite DB already mounted
- [ ] CHK021 `.env` changes: none required

## Summary

**Total**: 21 | **Passed**: 0 | **Pending**: 21 | **Failed**: 0

All checks pending implementation. No constitutional violations anticipated.
