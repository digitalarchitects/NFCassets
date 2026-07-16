# Constitution Compliance Checklist: User & Role Management

**Purpose**: Verify all constitutional principles are satisfied by the implementation
**Created**: 2026-07-16
**Feature**: [spec.md](../spec.md)

## Principle I: Lightweight, Zero-Licensing Stack

- [ ] CHK001 No new npm dependencies added — uses existing bcryptjs and express-validator
- [ ] CHK002 No external SaaS for identity (no Auth0, Firebase Auth, etc.)
- [ ] CHK003 Schema migration is a single ALTER TABLE — no migration framework needed

## Principle II: Offline-First Scanning

- [ ] CHK004 Scanning/verification flow unchanged — user management is online-only admin function
- [ ] CHK005 Deactivated users' offline queue items are not affected (username string survives)

## Principle III: GUID Identity, Cheap Replaceable Tags

- [ ] CHK006 No change to asset identification — NFC/QR flow untouched

## Principle IV: Audit Trail on Every Action

- [ ] CHK007 Deactivated users' historical `asset_history` and `verification` records remain intact
- [ ] CHK008 Username string in audit trail survives deactivation (soft delete, not string mutation)
- [ ] CHK009 User management actions are NOT recorded in asset_history (by design — asset_history is asset-specific; user audit is out of scope per spec)

## Principle V: Security Before Convenience

- [ ] CHK010 Passwords hashed with bcrypt (12 rounds) — same as existing auth
- [ ] CHK011 Password minimum length enforced server-side (4 characters)
- [ ] CHK012 Current password required for self-service change
- [ ] CHK013 Last-admin guard prevents removing all admin access
- [ ] CHK014 Self-action guard prevents deactivating/demoting own account
- [ ] CHK015 Deactivated accounts rejected on every request (not just login)
- [ ] CHK016 Password hashes never returned in API responses
- [ ] CHK017 CSRF protection applies to all user management endpoints
- [ ] CHK018 Admin-only guard on all `/api/users` endpoints

## Principle VI: Simplicity Until Proven Otherwise

- [ ] CHK019 Single column addition to existing table — no new tables
- [ ] CHK020 No new middleware files — active check added to existing requireAuth
- [ ] CHK021 No pagination on user list (tens of users, not thousands)
- [ ] CHK022 Username case-insensitivity handled in query, not via DB collation change
- [ ] CHK023 Self-service password change lives in `routes/auth.js` — not a separate route file

## Principle VII: Container-First, Cloudflare-Published

- [ ] CHK024 No new infrastructure needed — same Express process, same container pattern as 001
- [ ] CHK025 If deploying to Docker, no new port assignment needed (same app container)
- [ ] CHK026 `.env` changes: none required (existing SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD suffice)

## Summary

**Total**: 26 | **Passed**: 0 | **Pending**: 26 | **Failed**: 0

All checks pending implementation. No constitutional violations anticipated.
