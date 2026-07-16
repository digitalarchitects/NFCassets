# Feature Specification: Admin Master Lists

**Feature Branch**: `003-master-lists`  
**Created**: 2026-07-16  
**Status**: Draft  
**Input**: Admin needs to manage controlled vocabularies (make, model, location, category) so asset data stays consistent. Currently all asset fields are free-text, leading to typos ("Head Office" vs "Head office" vs "HO") and making reporting impossible. This also powers dropdowns instead of free-text inputs on the asset create/edit forms.

## User Scenarios & Testing

### User Story 1 - Admin: Manage Location List (Priority: P1) 🎯 MVP

An administrator builds a list of locations (buildings, sites, depots) that can be assigned to assets. They can add, rename, and deactivate locations. Deactivated locations remain on historical assets but don't appear in the "new asset" dropdown.

**Why this priority**: Location is the most impactful field to standardize — it directly drives the "where is this asset" question and audit verification. Free-text locations make searching and reporting impossible.

**Independent Test**: Admin adds "Head Office", "Satellite Depot", "Warehouse B". Creates a new asset — the location dropdown shows all three. Admin renames "Warehouse B" to "Warehouse C". Asset now shows "Warehouse C". Admin deactivates "Satellite Depot" — it no longer appears in the dropdown, but existing assets there still show it.

**Acceptance Scenarios**:

1. **Given** admin is on the Locations management page, **When** they add "Server Room", **Then** it appears in the list and is available in the asset location dropdown
2. **Given** location "Old Depot" exists, **When** admin renames it to "New Depot", **Then** all assets at "Old Depot" now show "New Depot"
3. **Given** location "Temporary Site" is active, **When** admin deactivates it, **Then** it no longer appears in the dropdown but assets assigned to it still display "Temporary Site" on their detail page
4. **Given** location "Server Room" exists, **When** admin tries to add another "Server Room", **Then** they see "Location already exists"

---

### User Story 2 - Admin: Manage Make & Model Lists (Priority: P1) 🎯 MVP

An administrator builds a list of equipment manufacturers and their models. Models belong to a make (Dell → Latitude 5550, HP → EliteBook 840). When adding a new asset, selecting a make filters the model dropdown to only show that make's models.

**Why this priority**: Make/Model are the primary descriptors of IT assets. Consistent naming means you can answer "how many Dell Latitude 5550s do we have?" without regex gymnastics.

**Independent Test**: Admin adds make "Dell", then adds models "Latitude 5550" and "Precision 5680" under Dell. Creates a new asset, selects Dell from the make dropdown — model dropdown shows only those two models. Selects "Latitude 5550" — asset is created with both.

**Acceptance Scenarios**:

1. **Given** admin is on the Makes page, **When** they add "Lenovo" and "Apple", **Then** both appear in the make list
2. **Given** make "Dell" exists, **When** admin adds model "Latitude 5550" to Dell, **Then** it appears under Dell in the model list
3. **Given** make "Dell" has models "Latitude 5550" and "Precision 5680", **When** user selects "Dell" on the asset form, **Then** the model dropdown shows only those two
4. **Given** admin adds model "ThinkPad X1" to make "Lenovo", **When** they try to add "ThinkPad X1" to Lenovo again, **Then** they see "Model already exists for this make"
5. **Given** a model has existing assets, **When** admin deactivates the model, **Then** it no longer appears in dropdowns but existing assets retain it

---

### User Story 3 - Admin: Manage Category List (Priority: P2)

An administrator defines asset categories (Laptop, Monitor, Printer, Server, Phone, Tablet) to classify assets by type. The category controls which fields are relevant on the asset form.

**Why this priority**: Categories unlock better dashboard filtering and reporting. Lower priority than location and make/model because "type" is often inferable from make/model.

**Independent Test**: Admin adds categories "Laptop", "Monitor", "Printer". Creates an asset, selects "Laptop" from the category dropdown. Dashboard/search can now filter by category.

**Acceptance Scenarios**:

1. **Given** admin is on Categories page, **When** they add "Laptop", "Monitor", "Printer", **Then** all three appear in the asset category dropdown
2. **Given** category "Tablet" exists, **When** admin renames it to "Tablet/Mobile", **Then** all tablet assets now show "Tablet/Mobile"

---

### User Story 4 - Asset Form Uses Dropdowns (Priority: P1) 🎯 MVP

The asset creation and editing forms replace free-text inputs with dropdowns for make, model, location, and category. The model dropdown is dynamically filtered by the selected make. The form remains fully functional for both creating and editing assets.

**Why this priority**: The master lists are pointless if the forms don't use them. This is the integration point that delivers the user-facing value.

**Independent Test**: Open the Add Asset form. Location is a dropdown showing active locations. Select "Dell" from make — model dropdown populates with Dell models only. Select model and location — submit. Asset created with FKs. Edit the asset — dropdowns pre-select current values.

**Acceptance Scenarios**:

1. **Given** master lists have data, **When** admin opens Add Asset form, **Then** location, category, make, and model are dropdowns (not text inputs)
2. **Given** admin selects make "Apple", **When** model dropdown opens, **Then** only Apple models appear
3. **Given** admin edits an existing asset, **When** the form loads, **Then** its current make/model/location/category are pre-selected
4. **Given** a non-admin user creates an asset (if permitted in future), **When** they use the form, **Then** dropdowns work the same way

---

### User Story 5 - Search/Filter by Master Lists (Priority: P3)

The asset search page gains filter dropdowns for make, model, location, and category — replacing or supplementing the free-text search and status filter.

**Why this priority**: Filtering by structured data is more reliable than free-text search. But the existing search already works — this is an enhancement.

**Independent Test**: On the Assets page, use the Location filter dropdown to select "Head Office" — only assets at Head Office appear. Combine with category "Laptop" — only laptops at Head Office shown.

**Acceptance Scenarios**:

1. **Given** assets exist across multiple locations, **When** user selects "Head Office" in the location filter, **Then** only Head Office assets are shown
2. **Given** user selects make "Dell" and category "Laptop", **When** filter applies, **Then** only Dell laptops are shown

---

### Edge Cases

- **Cascading deletes**: Deactivating a make should not orphan its models — models belong to a make even if the make is inactive. Models of an inactive make don't appear in dropdowns.
- **Empty model list**: If a make has no models yet, the model dropdown shows "No models available" and the asset can be saved without a model (nullable FK).
- **Name uniqueness per scope**: Make names are globally unique. Model names are unique within a make (Dell Latitude 5550 is fine, Lenovo Latitude 5550 is also fine). Location names are globally unique. Category names are globally unique.
- **Migration of existing data**: Assets created before 003 have free-text in `owner` and `location`. The migration populates `location_id` where the free-text matches an existing location name. Non-matching locations get a new location entry created. Owner text stays as-is (owner is not a master list).
- **Asset number stays free text**: `asset_no` and `serial_no` remain free-text — they're identifiers, not categorizations.
- **Response format**: API responses for assets should include the resolved names (e.g., `locationName: "Head Office"`) alongside IDs so the frontend doesn't need N+1 lookups.

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow admin to manage locations (CRUD + activate/deactivate)
- **FR-002**: System MUST allow admin to manage makes (CRUD + activate/deactivate)
- **FR-003**: System MUST allow admin to manage models linked to a make (CRUD + activate/deactivate)
- **FR-004**: System MUST allow admin to manage categories (CRUD + activate/deactivate)
- **FR-005**: System MUST replace free-text location with FK to locations table on assets
- **FR-006**: System MUST add make_id and model_id FKs to assets (nullable)
- **FR-007**: System MUST add category_id FK to assets (nullable)
- **FR-008**: System MUST dynamically filter model dropdown based on selected make on asset forms
- **FR-009**: System MUST migrate existing asset location text to location_id during schema upgrade
- **FR-010**: System MUST include resolved names (locationName, makeName, etc.) in asset API responses
- **FR-011**: System MUST support filtering assets by location_id, make_id, model_id, category_id
- **FR-012**: System MUST enforce name uniqueness per scope (make names global, model names per-make, location names global, category names global)
- **FR-013**: System MUST support deactivation (soft delete) for all master list items — deactivated items remain on existing assets but don't appear in dropdowns
- **FR-014**: System MUST allow renaming master list items — rename propagates to all assets using that item (since it's an FK reference, not a copy)

### Key Entities

- **Make**: id, name, active, created. e.g., "Dell", "HP", "Lenovo". Has many models.
- **Model**: id, make_id (FK), name, active, created. e.g., "Latitude 5550" belongs to "Dell".
- **Location**: id, name, active, created. e.g., "Head Office", "Satellite Depot".
- **Category**: id, name, active, created. e.g., "Laptop", "Monitor", "Printer".
- **Asset** (extended): Existing fields retained. New: make_id FK → makes, model_id FK → models, location_id FK → locations, category_id FK → categories. All nullable. Old `location` text column retained temporarily for migration, then dropped.

### Schema Changes

```sql
CREATE TABLE IF NOT EXISTS makes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    make_id INTEGER NOT NULL REFERENCES makes(id),
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(make_id, name)
);

CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Extend assets table
ALTER TABLE assets ADD COLUMN make_id INTEGER REFERENCES makes(id);
ALTER TABLE assets ADD COLUMN model_id INTEGER REFERENCES models(id);
ALTER TABLE assets ADD COLUMN location_id INTEGER REFERENCES locations(id);
ALTER TABLE assets ADD COLUMN category_id INTEGER REFERENCES categories(id);
```

## Success Criteria

- **SC-001**: Asset form dropdowns load in < 200ms with realistic list sizes (50 locations, 20 makes, 200 models)
- **SC-002**: Model dropdown filters by make without a page reload (client-side filtering from preloaded data)
- **SC-003**: Migration of existing assets to location_id completes without error — all existing location values become location entries
- **SC-004**: Search by master list fields returns correct results — same reliability as current free-text search
- **SC-005**: Master list management UI is consistent with existing admin pages (Bootstrap 5, same style)

## Assumptions

- Model list will have at most a few hundred entries — no pagination needed for model dropdown (load all on page)
- Makes are a flat list (no parent/child hierarchy needed for manufacturer)
- Category does NOT control which fields are visible on the form (future enhancement)
- Owner remains free text — it's a person's name, not a master list
- Description remains free text — it's the human-readable asset name/label
- The existing `location` text column on assets is dropped after migration confirmed successful
- Existing `nfc_tag` column remains (GUID for NFC) — not related to master lists
