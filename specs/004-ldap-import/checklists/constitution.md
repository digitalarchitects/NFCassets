# Constitution Compliance Checklist: LDAP/AD Import

**Purpose**: Verify all constitutional principles are satisfied
**Created**: 2026-07-16
**Feature**: [spec.md](../spec.md)

## Principle I: Lightweight, Zero-Licensing Stack

- [ ] CHK001 `ldapjs` is MIT-licensed, pure JavaScript — no native addons
- [ ] CHK002 No external SaaS for identity — AD is existing infrastructure, not new
- [ ] CHK003 No new infrastructure — import runs in the same Express process

## Principle II: Offline-First Scanning

- [ ] CHK004 LDAP import is an admin-only online function — does not affect scan/verify
- [ ] CHK005 Local users created by import are fully functional offline after first sync

## Principle III: GUID Identity, Cheap Replaceable Tags

- [ ] CHK006 AD `objectGUID` used as immutable link — survives renames, OU moves
- [ ] CHK007 No change to asset identification

## Principle IV: Audit Trail on Every Action

- [ ] CHK008 Every import creates a `sync_log` row with timestamps and counts
- [ ] CHK009 Every issue creates a `sync_issues` row with type, details, resolution
- [ ] CHK010 Import does not modify `asset_history` (no asset operations)
- [ ] CHK011 User deactivation via sync review is recorded in sync_issues (resolution + timestamp)

## Principle V: Security Before Convenience

- [ ] CHK012 LDAP bind password stored in `.env` — never committed, never exposed in API responses
- [ ] CHK013 Connection test does not return raw LDAP errors that might leak internal info
- [ ] CHK014 `GET /api/admin/ldap/config` omits password field
- [ ] CHK015 All admin LDAP endpoints require admin role
- [ ] CHK016 CSRF protection applies to all POST/PUT endpoints
- [ ] CHK017 Imported users get random temp passwords — not predictable
- [ ] CHK018 AD passwords are NEVER synced — authentication remains local

## Principle VI: Simplicity Until Proven Otherwise

- [ ] CHK019 In-process scheduler instead of separate cron container
- [ ] CHK020 Single `lib/ldap.js` module — all LDAP logic in one file
- [ ] CHK021 Flat tables — no complex relationships beyond FK to users
- [ ] CHK022 No message queue for sync — direct function call
- [ ] CHK023 Import degrades gracefully without spec 003 — no location linking, not an error

## Principle VII: Container-First, Cloudflare-Published

- [ ] CHK024 No new ports — same app container
- [ ] CHK025 LDAP server must be reachable from container network (host network mode or routable IP)
- [ ] CHK026 `.env` changes only — no new volume mounts

## Summary

**Total**: 26 | **Passed**: 0 | **Pending**: 26 | **Failed**: 0

All checks pending implementation. No constitutional violations anticipated.
