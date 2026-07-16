# Tasks: LDAP/Active Directory Import

**Input**: Design documents from `/specs/004-ldap-import/`
**Prerequisites**: plan.md, spec.md. Requires spec 002 (user management) and benefits from spec 003 (master lists).

## Phase 1: Setup

- [x] T001 Install `ldapjs` — `npm install ldapjs`
- [x] T002 Add LDAP env vars to `.env.example` — LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD, LDAP_SYNC_HOUR
- [x] T003 Add `ad_guid`, `display_name`, `email` columns to `users` table in `db/schema.sql` — safe ALTER TABLE with try/catch
- [x] T004 Add unique index on `ad_guid` — `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ad_guid ON users(ad_guid) WHERE ad_guid IS NOT NULL`
- [x] T005 Add `sync_log` table to `db/schema.sql` — id, started, finished, users_created, users_updated, users_disabled, users_missing, errors
- [x] T006 Add `sync_issues` table to `db/schema.sql` — id, sync_log_id FK, username, issue_type, details, resolved, resolution, resolved_at, created
- [x] T007 Add idempotent migration guards to `db/db.js` for all new columns and tables

## Phase 2: US1 — Admin: Configure LDAP Connection (P1) 🎯

- [x] T008 [US1] Create `lib/ldap.js` — `testConnection(config)` function: bind, search base DN, return user count or structured error
- [x] T009 [US1] Create `routes/admin.js` — Express Router with admin-only guard
- [x] T010 [US1] Implement `POST /api/admin/ldap/test` — validate config from request body, call testConnection, return success + count or error message
- [x] T011 [US1] Implement `GET /api/admin/ldap/config` — return current config values (LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN) without the password
- [x] T012 [US1] Create `public/admin/ldap.html` — LDAP config page with form (URL, base DN, bind DN, password) and Test Connection button
- [x] T013 [US1] Create `public/js/ldap.js` — wire test button, show connection result (green success + count or red error message)
- [x] T014 [US1] Mount `/api/admin` in `app.js` — `app.use('/api/admin', requireAuth, adminRoutes)`

## Phase 3: US2 — Admin: Run Manual Import (P1) 🎯

- [x] T015 [US2] Add `ldapSearch(config)` to `lib/ldap.js` — paged search with configurable filter, return array of user objects
- [x] T016 [US2] Add `importFromLDAP()` to `lib/ldap.js` — full import logic: connect → search active users → for each: match by objectGUID → create or update → create sync_log
- [x] T017 [US2] Add `generateTempPassword()` helper — random 12-char password for new LDAP users
- [x] T018 [US2] Implement `POST /api/admin/ldap/import` — call importFromLDAP, return sync summary
- [x] T019 [US2] Add "Import Now" button to `public/admin/ldap.html` — trigger import, show progress/summary
- [x] T020 [US2] Update `public/js/ldap.js` — handle import response, display created/updated/disabled counts
- [x] T021 [US2] Handle username conflicts — if AD username matches existing manual user (ad_guid IS NULL), skip and flag as conflict issue

## Phase 4: US3 — Import Office Locations (P1) 🎯

- [x] T022 [US3] Add location resolution to `importFromLDAP()` — for each user's `physicalDeliveryOfficeName`: lookup location by name, create if not exists, get location_id
- [x] T023 [US3] Link imported users to location_id if master lists (spec 003) is active — FK assignment during user creation
- [x] T024 [US3] Handle missing master lists gracefully — if locations table doesn't exist, skip location linking (users created without location_id)

## Phase 5: US4 — Daily Automated Sync (P2)

- [x] T025 [US4] Add daily scheduler to `app.js` — `scheduleDailySync(hour, importFn)`: calculate ms until next run, setInterval for 24h repeats
- [x] T026 [US4] Read `LDAP_SYNC_HOUR` from env — default 3 (03:00 AM)
- [x] T027 [US4] Add sync log retrieval — `GET /api/admin/sync/log` (last 20) and `GET /api/admin/sync/log/:id` (with issues)
- [x] T028 [US4] Skip scheduled sync if LDAP config not set — no errors on fresh install

## Phase 6: US5 — Admin: Review Sync Issues (P2)

- [x] T029 [US5] Add disabled-user detection to `importFromLDAP()` — separate search for disabled AD users with local matches, create 'ad_disabled' issues
- [x] T030 [US5] Add missing-user detection to `importFromLDAP()` — local users with ad_guid not in AD set → 'missing_from_ad' issues
- [x] T031 [US5] Implement `GET /api/admin/sync/issues` — list unresolved issues from latest sync
- [x] T032 [US5] Implement `PUT /api/admin/sync/issues/:id` — resolve with resolution: 'deactivated' (set user active=0), 'ignored' (flag resolved, user stays active), 're_enabled' (set user active=1)
- [x] T033 [US5] Create `public/admin/sync-review.html` — issue table grouped by type with action buttons per row
- [x] T034 [US5] Create `public/js/sync-review.js` — fetch issues, render table, handle resolve actions
- [x] T035 [US5] Add admin nav links for "LDAP Import" and "Sync Review" to `public/js/common.js`

## Phase 7: Polish

- [x] T036 [P] Test with real AD: connection test → import → verify users created → change AD user → re-import → verify update
- [x] T037 [P] Test disabled user scenario: disable a test user in AD → import → verify issue created → resolve by deactivating
- [x] T038 [P] Test missing user scenario: import → manually delete AD user → import again → verify 'missing_from_ad' issue
- [x] T039 [P] Test paged results if AD has > 1,000 users
- [x] T040 [P] Test graceful degradation: no spec 003 tables → import still works, just no location linking
- [x] T041 Update `README.md` — document LDAP import feature and env vars
- [x] T042 Commit all changes

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — schema + deps first
- **Phase 2 (US1)**: Depends on Phase 1 — needs ldapjs + schema
- **Phase 3 (US2)**: Depends on Phase 2 — needs connection infrastructure
- **Phase 4 (US3)**: Depends on Phase 3 — import must work before location integration
- **Phase 5 (US4)**: Depends on Phase 3 — needs working import
- **Phase 6 (US5)**: Depends on Phases 3-5 — needs import + sync + issues infrastructure
- **Phase 7 (Polish)**: Depends on all phases

### Spec Dependencies

- **Spec 002 (user management)**: Required — needs `active` column, user CRUD routes
- **Spec 003 (master lists)**: Optional — location import degrades gracefully without it

### Parallel Opportunities

- T001-T007 are sequential (install → schema → migration guards)
- T008-T013 within Phase 2: `lib/ldap.js` must exist before the route, but HTML/JS can be done in parallel with route implementation
- T015-T017 are sequential (search → import logic → helpers)
- T022-T024 depend on T016 (import logic)
- T029-T030 can be parallel (disabled detection + missing detection are independent functions)
- T036-T040 are parallel polish tests
