# Implementation Plan: User & Role Management

**Branch**: `002-user-role-management` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-user-role-management/spec.md`

## Summary

Add full user lifecycle management to the NFC Asset Tracker. Currently only a single admin can be created via `npm run seed`. This feature adds a Users page for admins (list, create, edit role, reset password, deactivate), self-service password change, profile viewing, and active-status enforcement on every authenticated request. Schema change: add `active` column to `users` table.

## Technical Context

**Language/Version**: JavaScript (Node.js 22+, ES2024)  
**Primary Dependencies**: express 4.x, node:sqlite, bcryptjs, express-validator (all already in project)  
**Storage**: SQLite via `node:sqlite` — single-file `assets.db`, schema bootstrapped on app start  
**Testing**: Manual verification  
**Target Platform**: Same as 001 — Linux server, Android Chrome for NFC, any browser for admin  
**Project Type**: Web application (Express serves API + static PWA frontend)  
**Performance Goals**: User list loads in < 200ms for up to 100 users  
**Constraints**: Zero new dependencies. Schema migration must be backward-compatible with existing data.  
**Scale/Scope**: Tens of users, not thousands. No pagination needed for user list.

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Lightweight, Zero-Licensing | ✅ PASS | No new dependencies. Uses existing bcryptjs, express-validator. |
| II. Offline-First Scanning | ✅ PASS | User management is an online-only admin function — does not affect scan/verify offline flow |
| III. GUID Identity | ✅ PASS | No change to asset identification |
| IV. Audit Trail | ⚠️ PARTIAL | User management actions are NOT recorded in asset_history (that table is asset-specific). A separate user audit trail is out of scope per spec assumptions. Deactivated users' historical asset_history records remain intact via username string. |
| V. Security Before Convenience | ✅ PASS | bcrypt (12 rounds), session validation, last-admin guard, self-action protection, minimum password length enforcement |
| VI. Simplicity | ✅ PASS | Extends existing users table in-place with one column. No new tables, no new middleware, no new dependencies. |
| VII. Container-First | ✅ PASS | No new infrastructure — same Express process. Containerization applies when deployed (see 001 deployment). |

## Project Structure

### Documentation

```text
specs/002-user-role-management/
├── spec.md              # This feature's spec
├── plan.md              # This file
├── tasks.md             # Implementation tasks
├── quickstart.md        # Validation steps
└── checklists/
    └── constitution.md  # Compliance checklist
```

### Files to Create

```text
routes/users.js           # New route file: user CRUD endpoints
public/users.html         # Admin user management page
public/js/users.js        # User management page logic
public/profile.html       # Self-service profile + password change
public/js/profile.js      # Profile page logic
```

### Files to Modify

```text
db/schema.sql             # Add ALTER TABLE users ADD COLUMN active
middleware/auth.js         # Add active-status check to requireAuth
app.js                     # Mount /api/users routes, wire profile page
public/js/common.js        # Add profile link to navbar (click username)
public/index.html          # Add "Users" nav link for admins
```

## Routes

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/users` | Session | admin | List all users |
| POST | `/api/users` | Session | admin | Create user |
| PUT | `/api/users/:id` | Session | admin | Update user role or active status |
| PUT | `/api/users/:id/password` | Session | admin | Reset another user's password |
| PUT | `/api/auth/password` | Session | any | Change own password |
| GET | `/api/auth/me` | Session | any | Extended to include role + created date |

## Data Flow

```
Admin creates user:
  POST /api/users { username, password, role }
    → bcrypt hash (12 rounds)
    → INSERT INTO users (username, password_hash, role, active=1)
    → 201 { user: { id, username, role, active, created } }

Admin changes role:
  PUT /api/users/:id { role: "admin" }
    → Check: target is not self
    → Check: if changing FROM admin TO user, ensure at least 1 other active admin exists
    → UPDATE users SET role = ? WHERE id = ?
    → 200 { user }

Admin deactivates:
  PUT /api/users/:id { active: 0 }
    → Check: target is not self
    → Check: if target is admin, ensure at least 1 other active admin remains
    → UPDATE users SET active = 0 WHERE id = ?
    → 200 { user }

Self password change:
  PUT /api/auth/password { currentPassword, newPassword }
    → bcrypt.compare(currentPassword, user.password_hash)
    → bcrypt.hash(newPassword, 12)
    → UPDATE users SET password_hash = ? WHERE id = ?
    → Session stays valid (no regeneration needed)
    → 200 { ok: true }

Every authenticated request:
  requireAuth middleware:
    → Check session exists
    → SELECT active FROM users WHERE id = ? (or embed active in session)
    → If active=0 → 401 "Account is disabled"
    → Continue
```

## Schema Migration

The `active` column is added to `schema.sql` using a safe pattern since SQLite doesn't support `ADD COLUMN IF NOT EXISTS`:

```sql
-- Add active column to users (safe to run even if column already exists)
-- SQLite doesn't have ADD COLUMN IF NOT EXISTS, so we catch the error in db.js
-- or use a PRAGMA table_info check
```

The `db/db.js` bootstrap will be updated to handle this gracefully — using a try/catch or `PRAGMA table_info` check before running the ALTER.

## Complexity Tracking

| Item | Why | Rejected Alternative |
|------|-----|---------------------|
| No user audit table | Spec scopes it out. Adding a `user_history` table would require FK to users, breaking the simplicity of soft-deletes. | Create `user_audit` table — deferred. Current approach keeps username strings in existing asset_history, which survives deactivation. |
| Active flag in users table | Simpler than a separate `deactivated_users` table or moving users to an archive. One column, one boolean. | Separate table or hard delete — rejected. Hard delete breaks FK references in asset_history (username strings). Separate table adds complexity. |
| Active check embedded in session | Active status is fetched once at login and stored in `req.session.user.active`. Avoids a DB query on every request. Trade-off: if admin deactivates a user mid-session, they stay active until next login. Spec requirement FR-011 says "next API call" — we must check on every request. | Session-only check — rejected per FR-011. Will query `active` from DB in requireAuth middleware (single column lookup, indexed by id PK — fast). |
