# Tasks: Admin Master Lists

**Input**: Design documents from `/specs/003-master-lists/`
**Prerequisites**: plan.md, spec.md

## Phase 1: Setup (Schema)

- [x] T001 Add 4 master list tables to `db/schema.sql` — `makes`, `models`, `locations`, `categories` with `CREATE TABLE IF NOT EXISTS`
- [x] T002 Add 4 FK columns to `assets` table in `db/schema.sql` — `make_id`, `model_id`, `location_id`, `category_id` (all nullable, each with try/catch for "duplicate column")
- [x] T003 Add migration logic to `db/db.js` — after schema bootstrap: seed locations from `SELECT DISTINCT location FROM assets`, then `UPDATE assets SET location_id = ...`
- [x] T004 Add indexes on new FK columns — `idx_assets_make_id`, `idx_assets_model_id`, `idx_assets_location_id`, `idx_assets_category_id`

## Phase 2: US1 — Admin: Manage Location List (P1) 🎯

- [x] T005 [US1] Create `routes/lists.js` — Express Router with admin-only guard
- [x] T006 [US1] Implement `GET /api/lists/locations` — list all locations (id, name, active, created), ordered by name
- [x] T007 [US1] Implement `POST /api/lists/locations` — create location with name uniqueness check
- [x] T008 [US1] Implement `PUT /api/lists/locations/:id` — update name and/or active status, with uniqueness guard
- [x] T009 [US1] Create `public/admin/lists.html` — master list management page skeleton with tab navigation (Locations / Makes & Models / Categories)

## Phase 3: US2 — Admin: Manage Makes & Models (P1) 🎯

- [x] T010 [US2] Implement `GET /api/lists/makes` — list all makes with their models (nested JSON: `{ makes: [{ id, name, active, models: [...] }] }`)
- [x] T011 [US2] Implement `POST /api/lists/makes` — create make with name uniqueness check
- [x] T012 [US2] Implement `PUT /api/lists/makes/:id` — update name and/or active status
- [x] T013 [US2] Implement `GET /api/lists/models` — list models, with optional `?make_id=` filter
- [x] T014 [US2] Implement `POST /api/lists/models` — create model (make_id + name), uniqueness per make_id
- [x] T015 [US2] Implement `PUT /api/lists/models/:id` — update name and/or active status
- [x] T016 [US2] Add Makes & Models tab to `public/admin/lists.html` — table of makes with expandable model lists, add/edit/activate/deactivate per make and model

## Phase 4: US3 — Admin: Manage Categories (P2)

- [x] T017 [US3] Implement `GET /api/lists/categories` — list all categories
- [x] T018 [US3] Implement `POST /api/lists/categories` — create category with name uniqueness
- [x] T019 [US3] Implement `PUT /api/lists/categories/:id` — update name and/or active status
- [x] T020 [US3] Add Categories tab to `public/admin/lists.html`

## Phase 5: Convenience Endpoint + JS

- [x] T021 Implement `GET /api/lists/all` — return `{ locations, makes, models, categories }` in one call for form dropdowns (all active items only)
- [x] T022 Create `public/js/lists.js` — tab switching, fetch + render for each master list type, add/edit/activate/deactivate handlers
- [x] T023 Mount `/api/lists` in `app.js` — `app.use('/api/lists', requireAuth, listRoutes)`
- [x] T024 Add "Lists" nav link to `public/js/common.js` `renderNav` — visible only to admin

## Phase 6: US4 — Asset Form Dropdowns (P1) 🎯

- [x] T025 [US4] Update `GET /api/assets` in `routes/assets.js` — add JOINs to include `makeName`, `modelName`, `locationName`, `categoryName` in response
- [x] T026 [US4] Update `GET /api/assets/:id` — include resolved FK names
- [x] T027 [US4] Update `GET /api/assets/lookup/:code` — include resolved FK names
- [x] T028 [US4] Update `POST /api/assets` — accept `makeId`, `modelId`, `locationId`, `categoryId` instead of (or in addition to) `location` text
- [x] T029 [US4] Update `PUT /api/assets/:id` — support FK fields for editing
- [x] T030 [US4] Update `public/assets.html` Add Asset form — replace text inputs with dropdowns for location, make, model, category
- [x] T031 [US4] Update `public/js/assets-list.js` — on form load: `GET /api/lists/all` → populate dropdowns. Filter model dropdown by selected make.
- [x] T032 [US4] Update `public/asset.html` asset detail page — show "Dell Latitude 5550" instead of or alongside raw IDs
- [x] T033 [US4] Update `public/js/asset.js` transfer form — replace location text input with dropdown
- [x] T034 [US4] Update `POST /api/assets/import` in `routes/assets.js` — CSV Location column maps to locations table (lookup or create)

## Phase 7: US5 — Search/Filter by Master Lists (P3)

- [x] T035 [US5] Update `GET /api/assets` filter logic — accept `locationId`, `makeId`, `modelId`, `categoryId` query params alongside existing `q` and `status`
- [x] T036 [US5] Update `public/assets.html` — add dropdown filters for location, make, category above the asset table
- [x] T037 [US5] Update `public/js/assets-list.js` — wire filter dropdowns to search function, load filter options from `/api/lists/all`

## Phase 8: Polish

- [x] T038 Run full migration against a copy of assets.db — verify all existing location values become location entries, no data loss
- [x] T039 Test cascading: deactivate a location → verify it's hidden from dropdowns but existing asset still shows it
- [x] T040 Test make→model filter: select Dell → only Dell models appear
- [x] T041 Verify CSV import still works with Location column mapping
- [x] T042 Update `README.md` — document master lists feature
- [x] T043 Commit all changes

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Schema)**: No dependencies — run first, blocks all other phases
- **Phase 2 (US1)**: Depends on Phase 1
- **Phase 3 (US2)**: Depends on Phase 2 (shares routes/lists.js infrastructure)
- **Phase 4 (US3)**: Depends on Phase 2 (shares routes/lists.js)
- **Phase 5 (Convenience)**: Depends on Phases 2-4 (all list endpoints exist)
- **Phase 6 (US4)**: Depends on Phase 5 (needs `/api/lists/all` for dropdowns)
- **Phase 7 (US5)**: Depends on Phase 6 (needs FK columns populated)
- **Phase 8 (Polish)**: Depends on all phases

### Parallel Opportunities

- T001-T004 are sequential (schema first, then migration, then indexes)
- T006-T008 within US1 are sequential (route → GET → POST → PUT)
- US2+T013-T015 and US3+T017-T019 can be done in parallel once routes/lists.js scaffold exists
- T022 (lists.js) depends on all list endpoints existing
- T025-T029 (API changes) can be done in parallel with T030-T033 (frontend changes) once API shape is agreed
- T038-T041 are parallel polish tasks
