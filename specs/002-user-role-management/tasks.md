# Tasks: User & Role Management

**Input**: Design documents from `/specs/002-user-role-management/`
**Prerequisites**: plan.md, spec.md

## Phase 1: Setup (Schema + Middleware)

- [x] T001 Add `active` column to `db/schema.sql` — `ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1` with safe migration (check if column exists first)
- [x] T002 Update `db/db.js` — handle ALTER TABLE gracefully (catch "duplicate column" error or use PRAGMA table_info)
- [x] T003 Update `middleware/auth.js` `requireAuth` — query user `active` status on every request, return 401 "Account is disabled" if active=0

## Phase 2: User Story 1 — Admin: List & Create Users (P1) 🎯

- [x] T004 [US1] Create `routes/users.js` — Express Router with admin-only guard
- [x] T005 [US1] Implement `GET /api/users` in `routes/users.js` — list all users (id, username, role, active, created), ordered by created DESC. Omit password_hash.
- [x] T006 [US1] Implement `POST /api/users` in `routes/users.js` — validate username (case-insensitive uniqueness), password (min 4 chars), role (admin/user). bcrypt hash, insert, return user (no password_hash).
- [x] T007 [US1] Mount `/api/users` in `app.js` — `app.use('/api/users', requireAuth, userRoutes)`
- [x] T008 [US1] Create `public/users.html` — admin user management page with user table and Add User form
- [x] T009 [US1] Create `public/js/users.js` — fetch user list, render table, handle add-user form submit, show errors
- [x] T010 [US1] Add "Users" nav link to `public/js/common.js` `renderNav` — visible only when `user.role === 'admin'`

## Phase 3: User Story 2 — Admin: Edit Role & Reset Password (P1) 🎯

- [x] T011 [US2] Implement `PUT /api/users/:id` in `routes/users.js` — change role with last-admin guard and self-demotion guard
- [x] T012 [US2] Implement `PUT /api/users/:id/password` in `routes/users.js` — reset password (admin sets new password for any user), validate min 4 chars, bcrypt hash
- [x] T013 [US2] Add role dropdown + "Reset Password" button to user table in `public/js/users.js` — inline editing per row
- [x] T014 [US2] Update `public/js/users.js` — handle role change PUT, handle password reset with prompt for new password

## Phase 4: User Story 3 — Admin: Deactivate Users (P2)

- [x] T015 [US3] Add deactivate/activate toggle to `PUT /api/users/:id` in `routes/users.js` — set active=0 or active=1 with last-admin guard and self-deactivation guard
- [x] T016 [US3] Add activate/deactivate button to user table in `public/js/users.js` — per-row toggle with confirmation
- [x] T017 [US3] Style inactive users differently in table (greyed out, badge showing "Inactive")

## Phase 5: User Story 4 — Self-Service Password Change (P2)

- [x] T018 [US4] Implement `PUT /api/auth/password` in `routes/auth.js` — validate currentPassword, newPassword (min 4 chars), bcrypt compare + hash, update
- [x] T019 [US4] Create `public/profile.html` — profile page with password change form (current password, new password, confirm)
- [x] T020 [US4] Create `public/js/profile.js` — handle form submit, show success/error messages

## Phase 6: User Story 5 — User Profile (P3)

- [x] T021 [US5] Update `GET /api/auth/me` in `routes/auth.js` — return role and created date alongside username/id
- [x] T022 [US5] Render profile info on `public/profile.html` — username, role badge, account created date
- [x] T023 [US5] Make username clickable in navbar → links to `/profile.html` (all users, not just admin)

## Phase 7: Polish

- [x] T024 [P] Verify `.gitignore` still covers `assets.db`, `.env`, `uploads/*`
- [x] T025 [P] Test full flow: seed → create user → login as new user → change password → admin deactivates → login rejected
- [x] T026 [P] Test edge cases: last admin guard, self-deactivation guard, duplicate username, wrong current password
- [x] T027 Update `README.md` — document user management and new env vars (if any)
- [x] T028 Commit all changes

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — schema + middleware changes first
- **US1 (Phase 2)**: Depends on Phase 1 — needs active column and auth middleware
- **US2 (Phase 3)**: Depends on US1 — needs users route + page infrastructure
- **US3 (Phase 4)**: Depends on US2 — extends the same route + page
- **US4 (Phase 5)**: Depends on Phase 1 — needs auth route extension, independent of user stories
- **US5 (Phase 6)**: Depends on US4 — shares the profile page
- **Polish (Phase 7)**: Depends on all user stories being complete

### Parallel Opportunities

- T001 + T002 can be done together (schema + migration handler)
- T004 + T005 + T006 are sequential within the route file
- T008 + T009 are sequential (HTML then JS)
- US4 (T018-T020) is completely independent of US1-US3 — can be done in parallel
- T025 + T026 are parallel verification tasks
