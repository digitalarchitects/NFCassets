# Feature Specification: User & Role Management

**Feature Branch**: `002-user-role-management`  
**Created**: 2026-07-16  
**Status**: Draft  
**Input**: Admin needs to manage user accounts (create, edit, deactivate) and control role-based access. All users need self-service password changes. Currently only a single admin account can be created via `npm run seed`.

## User Scenarios & Testing

### User Story 1 - Admin: List & Create Users (Priority: P1) 🎯 MVP

An administrator needs to add staff accounts so multiple people can use the asset tracker with their own logins. They view the current user list, create a new user with a username, temporary password, and assigned role.

**Why this priority**: The system is useless for a team without multi-user support. Every staff member scanning assets needs their own identity for the audit trail.

**Independent Test**: Log in as admin, navigate to Users page. See the list of existing users. Fill in "newuser" + password + "user" role, submit. Log out, log in as "newuser" — succeeds. Audit trail from newuser's scans shows their username.

**Acceptance Scenarios**:

1. **Given** admin is on the Users page, **When** they click "Add User" and fill username/password/role, **Then** the user is created and appears in the list
2. **Given** admin tries to create a user with an existing username, **When** they submit, **Then** they see "Username already exists"
3. **Given** admin creates a user with role "user", **When** that user logs in, **Then** they can scan/verify/transfer but cannot access admin features
4. **Given** a non-admin user tries to access the Users page, **When** the page loads, **Then** they see "Access denied"

---

### User Story 2 - Admin: Edit User Role & Reset Password (Priority: P1) 🎯 MVP

An administrator needs to promote a user to admin, demote an admin to user, or reset a forgotten password.

**Why this priority**: Role changes and password resets are the most common admin actions after account creation. Without them, every password problem requires the seed script.

**Independent Test**: On the Users page, change a user's role from "user" to "admin". That user logs out and back in — sees admin features. Reset their password, they log in with the new password — succeeds.

**Acceptance Scenarios**:

1. **Given** a user "staff1" with role "user", **When** admin changes their role to "admin", **Then** staff1's next session shows admin features (Add Asset, Import, Users page)
2. **Given** a user forgot their password, **When** admin resets it to "temp123", **Then** the user can log in with "temp123"
3. **Given** admin tries to change the role of the last remaining admin to "user", **When** they submit, **Then** they see "Cannot remove the last admin"

---

### User Story 3 - Admin: Deactivate Users (Priority: P2)

An administrator needs to disable a user account without deleting their historical audit trail records.

**Why this priority**: Staff turnover requires account deactivation. Deletion would break audit trail referential integrity.

**Independent Test**: Admin deactivates "staff1". Staff1 tries to log in — gets "Account is disabled". Staff1's past verification records still show their username in history.

**Acceptance Scenarios**:

1. **Given** user "staff1" is active, **When** admin clicks "Deactivate", **Then** staff1 cannot log in and their status shows as inactive
2. **Given** user "staff1" is inactive, **When** admin clicks "Activate", **Then** staff1 can log in again
3. **Given** admin tries to deactivate their own account, **When** they submit, **Then** they see "Cannot deactivate your own account"

---

### User Story 4 - Self-Service: Change Own Password (Priority: P2)

Any authenticated user needs to change their own password without admin intervention.

**Why this priority**: Security hygiene — users should be able to rotate passwords. Sending passwords through an admin is a bad security practice.

**Independent Test**: Log in as "staff1", navigate to profile, enter current password + new password. Log out, log in with new password — succeeds. Old password — fails.

**Acceptance Scenarios**:

1. **Given** user is on their profile page, **When** they enter correct current password + new password + confirm, **Then** password is changed and they see confirmation
2. **Given** user enters wrong current password, **When** they submit, **Then** they see "Current password is incorrect"
3. **Given** user enters new password that doesn't match confirmation, **When** they submit, **Then** they see "Passwords do not match"
4. **Given** user enters a new password shorter than 4 characters, **When** they submit, **Then** they see "Password must be at least 4 characters"

---

### User Story 5 - User Sees Own Profile (Priority: P3)

Any authenticated user can view their own account details: username, role, account creation date.

**Why this priority**: Low priority quality-of-life feature. Users should be able to confirm their identity and role.

**Independent Test**: Log in as "staff1", click username in navbar, see profile page with username, role, created date.

**Acceptance Scenarios**:

1. **Given** user is logged in, **When** they click their username in the nav bar, **Then** they see a profile page showing username, role, and account creation date

---

### Edge Cases

- **Last admin protection**: Cannot demote or deactivate the last remaining admin account. System must query `SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1` before allowing role change or deactivation.
- **Self-deactivation**: Admin cannot deactivate their own account. Check `req.session.user.id !== targetId` before deactivation.
- **Self-demotion**: Admin cannot demote themselves from admin role. Same check as self-deactivation plus a last-admin guard.
- **Username uniqueness**: Case-insensitive comparison for username uniqueness (SQLite does case-sensitive UNIQUE by default — use `LOWER(username)` in queries or add a COLLATE NOCASE index).
- **Password minimum length**: Enforced at 4 characters server-side via express-validator.
- **Seed admin protection**: The initial seeded admin account must be treated like any other user — editable, deactivatable (with last-admin guard).
- **Session invalidation on deactivation**: If a user's account is deactivated while they have an active session, their next API call should return 401. This requires checking `active` status in `requireAuth` middleware.

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow admin users to list all user accounts (GET /api/users)
- **FR-002**: System MUST allow admin users to create new user accounts with username, password, and role (POST /api/users)
- **FR-003**: System MUST allow admin users to change any user's role (PUT /api/users/:id)
- **FR-004**: System MUST allow admin users to reset any user's password (PUT /api/users/:id/password)
- **FR-005**: System MUST allow admin users to deactivate and reactivate user accounts (PUT /api/users/:id with active field)
- **FR-006**: System MUST prevent deactivation or demotion of the last active admin account
- **FR-007**: System MUST prevent users from deactivating or demoting their own account
- **FR-008**: System MUST allow any authenticated user to change their own password (PUT /api/auth/password)
- **FR-009**: System MUST require current password verification for self-service password changes
- **FR-010**: System MUST enforce minimum password length of 4 characters
- **FR-011**: System MUST check account active status on every authenticated request and reject deactivated accounts
- **FR-012**: System MUST allow any authenticated user to view their own profile (GET /api/auth/me extended, or GET /api/users/me)
- **FR-013**: System MUST store passwords as bcrypt hashes (12 rounds) — consistent with existing auth
- **FR-014**: System MUST enforce username uniqueness case-insensitively
- **FR-015**: System MUST keep deactivated users' historical data (audit trail, verifications) intact

### Key Entities

- **User** (extended): Existing fields retained. New field: `active` (INTEGER, 1=active, 0=deactivated, default 1). Deactivation is a soft delete — `asset_history.username` and `verification.username` continue to reference the username string.

### Schema Change

```sql
ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
```

No new tables required. The existing `users` table is extended in-place.

## Success Criteria

- **SC-001**: Admin can create a user and that user can log in within 30 seconds
- **SC-002**: Deactivated accounts are rejected at the next API call (not just next login)
- **SC-003**: Password change takes effect immediately — old password stops working
- **SC-004**: All user management actions are recorded in the audit trail (action=user_create, user_update, user_deactivate, etc.) — note: this requires extending asset_history or a new table; scope decision needed
- **SC-005**: Zero downtime — schema migration runs on app boot via existing `db/db.js` bootstrap

## Assumptions

- User management audit trail is desirable but may be scoped to a future spec — audit of user actions (who created/disabled whom) is separate from asset audit trail
- No email integration for password resets (admin does it manually) — consistent with the local-auth, no-external-dependencies principle
- The existing `seed.js` continues to work and creates the first admin; subsequent admins are created via the UI
- Username format is free-text (no email requirement) — consistent with the current system
- The `active` column is added via ALTER TABLE in `schema.sql` (idempotent — uses `IF NOT EXISTS`-style pattern or catches the "duplicate column" error)
