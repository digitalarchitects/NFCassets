# Tasks: Initial MVP — NFC Asset Tracker

**Input**: Design documents from `/specs/001-initial-mvp/`
**Prerequisites**: plan.md, spec.md, data-model.md
**Status**: ✅ All tasks complete (retrospective)

## Phase 1: Setup

- [x] T001 Initialize Node.js project with package.json, install dependencies (express, bcryptjs, helmet, express-session, express-validator, express-rate-limit, multer, uuid, csv-parse, dotenv, nodemon)
- [x] T002 [P] Create `.env.example` with PORT, SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD, NODE_ENV
- [x] T003 [P] Create `.gitignore` with node_modules/, assets.db, uploads/* (except .gitkeep), .env

## Phase 2: Foundational (Blocking)

- [x] T004 Create `db/schema.sql` with DDL for users, assets, asset_history, verification, sessions tables and indexes
- [x] T005 Create `db/db.js` — DatabaseSync connection, WAL mode, foreign keys ON, idempotent schema bootstrap
- [x] T006 [P] Create `db/sessionStore.js` — SQLite-backed express-session store
- [x] T007 [P] Create `db/seed.js` — admin user seed script reading ADMIN_USERNAME/ADMIN_PASSWORD from env
- [x] T008 [P] Create `middleware/auth.js` — requireAuth and requireRole middleware
- [x] T009 [P] Create `middleware/csrf.js` — session-backed CSRF token generation + validation
- [x] T010 [P] Create `middleware/upload.js` — multer config: 5MB limit, image types only, /uploads/ destination
- [x] T011 Create `app.js` — Express server entry: helmet CSP, JSON parsing, session, CSRF, route mounting, static files, error handler

## Phase 3: User Story 1 — Scan Asset Tag (P1) 🎯

- [x] T012 [US1] Implement `GET /api/assets/lookup/:code` in `routes/assets.js` — lookup by guid OR asset_no
- [x] T013 [US1] Create `public/scan.html` — scan page with NFC button, QR button, manual entry form
- [x] T014 [US1] Create `public/js/scan.js` — NDEFReader scan, Html5Qrcode camera scan, manual entry submit, extractCode helper for URLs
- [x] T015 [US1] Create `public/asset.html` — asset detail page skeleton (will be enriched by US2, US3)
- [x] T016 [US1] Create `public/js/asset.js` — load asset from code or id param, renderAsset helper, NFC tag write button
- [x] T017 [US1] Create `public/js/common.js` — AT.apiFetch (CSRF-aware), AT.requireLogin (auth guard), AT.renderNav (navbar), service worker registration

## Phase 4: User Story 2 — Verify Asset Presence (P1) 🎯

- [x] T018 [US2] Implement `POST /api/verification` in `routes/verification.js` — validate assetId/lat/lng, insert into verification + asset_history
- [x] T019 [US2] Implement `GET /api/verification/:assetId` in `routes/verification.js` — list verifications for asset
- [x] T020 [US2] Add verify button + GPS capture to `public/js/asset.js`
- [x] T021 [US2] Create `public/js/offline-queue.js` — IndexedDB-backed queue, add/all/remove/flush, online event listener
- [x] T022 [US2] Add offline fallback to verify flow in `public/js/asset.js` — check navigator.onLine, queue offline

## Phase 5: User Story 3 — Transfer Asset (P2)

- [x] T023 [US3] Implement `POST /api/assets/:id/transfer` in `routes/assets.js` — validate newOwner/newLocation/gps, update asset, record history
- [x] T024 [US3] Add transfer panel (toggle, form, GPS capture) to `public/js/asset.js`
- [x] T025 [US3] Implement `GET /api/history/:assetId` in `routes/history.js`
- [x] T026 [US3] Add history panel (toggle, load, render) to `public/js/asset.js`

## Phase 6: User Story 4 — Admin: Manage Assets (P2)

- [x] T027 [US4] Implement `POST /api/assets` in `routes/assets.js` — create asset with GUID, validate assetNo uniqueness
- [x] T028 [US4] Implement `PUT /api/assets/:id` in `routes/assets.js` — update serial_no, description, status
- [x] T029 [US4] Implement `POST /api/assets/:id/photo` in `routes/assets.js` — multer single upload, update photo_path, record history
- [x] T030 [US4] Implement `POST /api/assets/import` in `routes/assets.js` — CSV parse, bulk insert with transaction, duplicate skip, error reporting
- [x] T031 [US4] Create `public/assets.html` — asset list page with add form, CSV import form
- [x] T032 [US4] Create `public/js/assets-list.js` — search/filter, add asset form, CSV import, admin-only toggle
- [x] T033 [US4] Add photo upload form to `public/js/asset.js`

## Phase 7: User Story 5 — Dashboard & Search (P3)

- [x] T034 [US5] Implement `GET /api/assets/stats` in `routes/assets.js` — total, missing, checkedToday counts
- [x] T035 [US5] Implement `GET /api/assets` in `routes/assets.js` — search by q (LIKE across 5 fields), filter by status, pagination (limit/offset)
- [x] T036 [US5] Create `public/index.html` — dashboard with stat cards
- [x] T037 [US5] Create `public/js/dashboard.js` — fetch and render stats

## Phase 8: User Story 6 — Write NFC Tags (P3)

- [x] T038 [US6] Add "Write to NFC Tag" button + NDEFReader.write() to `public/js/asset.js` — encode URL + text records

## Phase 9: User Story 7 — Authentication (P1)

*Note: Implicitly required by all other stories but formally tracked here*

- [x] T039 [US7] Implement `POST /api/auth/login` in `routes/auth.js` — bcrypt verify, session regenerate, rate limiting
- [x] T040 [US7] Implement `POST /api/auth/logout` in `routes/auth.js` — session destroy, clear cookie
- [x] T041 [US7] Implement `GET /api/auth/me` in `routes/auth.js` — return session user or 401
- [x] T042 [US7] Create `public/login.html` — login form
- [x] T043 [US7] Create `public/js/auth.js` — login form submit, redirect to dashboard on success

## Phase 10: PWA & Polish

- [x] T044 Create `public/manifest.json` — PWA manifest with name, icons, theme_color
- [x] T045 Create `public/sw.js` — service worker: cache-first for shell, network-first for API, cache CDN libs
- [x] T046 [P] Create `public/css/style.css` — custom styles (asset card max-width, history items, badge colors)
- [x] T047 [P] Create `public/icons/icon.svg` — app icon
- [x] T048 [P] Create `README.md` — project overview, stack, setup, Web NFC HTTPS note
- [x] T049 Create `.specify/` speckit configuration (constitution, extensions, templates, workflow)

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — project scaffolding
- **Foundational (Phase 2)**: Depends on Setup — DB, auth, CSRF, upload middleware
- **User Stories (Phase 3-9)**: All depend on Foundational completion
- **PWA (Phase 10)**: No dependencies on user stories — can be done in parallel

### User Story Dependencies

- **US1 (Scan)**: Independent — only needs Foundational + lookup endpoint
- **US2 (Verify)**: Depends on US1 (needs asset loaded) but independently testable
- **US3 (Transfer)**: Depends on US1 (needs asset loaded) but independently testable
- **US4 (Admin CRUD)**: Independent — only needs Foundational
- **US5 (Dashboard)**: Depends on US4 (needs assets to exist) but independently testable
- **US6 (Write Tag)**: Depends on US1 (needs asset page + NDEFReader)
- **US7 (Auth)**: Required by ALL other user stories — implemented concurrently with Foundational
