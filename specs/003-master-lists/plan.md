# Implementation Plan: Admin Master Lists

**Branch**: `003-master-lists` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-master-lists/spec.md`

## Summary

Replace free-text location, make, model, and category fields on assets with foreign keys to admin-managed master lists. Add 4 new tables (makes, models, locations, categories). Add 4 new FK columns to assets. Admin gets CRUD pages for each master list. Asset forms switch from text inputs to dropdowns with make-to-model cascading. Asset API includes resolved names to avoid N+1 frontend lookups. Search/filter adds dropdown filters for these fields.

## Technical Context

**Language/Version**: JavaScript (Node.js 22+)  
**Primary Dependencies**: express, node:sqlite, express-validator (all existing)  
**Storage**: SQLite — 4 new tables, 4 new columns on assets  
**Testing**: Manual verification  
**Target Platform**: Same as 001/002  
**Performance Goals**: Dropdowns load all values on page load (no lazy-loading needed for <500 rows)  
**Constraints**: Must migrate existing asset data without loss. Must remain backward-compatible with 001 and 002.  
**Scale/Scope**: ~50 locations, ~20 makes, ~200 models, ~15 categories

## Constitution Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Lightweight | ✅ PASS | No new deps. SQLite handles 4 small lookup tables trivially. |
| II. Offline-First | ✅ PASS | Master list data loaded on page load — no extra API calls per dropdown interaction. |
| III. GUID Identity | ✅ PASS | No change to asset identification |
| IV. Audit Trail | ✅ PASS | FK changes (location_id, make_id, model_id, category_id) trigger asset_history entries on transfer/update |
| V. Security | ✅ PASS | Master list CRUD is admin-only. CSRF applies to all endpoints. |
| VI. Simplicity | ✅ PASS | 4 flat tables, no ORM, no migrations framework — ALTER TABLE in schema.sql with idempotent guards |
| VII. Container-First | ✅ PASS | Same app container, no new ports |

## Project Structure

### Files to Create

```text
routes/lists.js            # Master list CRUD (makes, models, locations, categories)
public/admin/lists.html    # Admin page to manage all master lists
public/js/lists.js         # Master list management page logic
```

### Files to Modify

```text
db/schema.sql              # 4 new tables + 4 ALTER TABLE on assets
middleware/upload.js        # (unchanged — no photo changes)
routes/assets.js            # Include resolved names in responses. Add filter by FK params. Update create/update to use FKs.
routes/auth.js              # (unchanged)
app.js                      # Mount /api/lists routes
public/assets.html          # Update Add Asset form with dropdowns
public/asset.html           # Update asset detail to show resolved names
public/js/assets-list.js    # Add dropdown filters for location/category/make
public/js/asset.js          # Update transfer form with location dropdown
public/js/common.js         # Add admin nav links for Lists page
```

## Routes

### Master List CRUD (all admin-only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/lists/locations` | List all locations (active + inactive) |
| POST | `/api/lists/locations` | Create location |
| PUT | `/api/lists/locations/:id` | Update location (name, active) |
| GET | `/api/lists/makes` | List all makes |
| POST | `/api/lists/makes` | Create make |
| PUT | `/api/lists/makes/:id` | Update make (name, active) |
| GET | `/api/lists/models` | List models. Query: `?make_id=` for filtering. |
| POST | `/api/lists/models` | Create model (make_id, name) |
| PUT | `/api/lists/models/:id` | Update model (name, active) |
| GET | `/api/lists/categories` | List all categories |
| POST | `/api/lists/categories` | Create category |
| PUT | `/api/lists/categories/:id` | Update category (name, active) |
| GET | `/api/lists/all` | Convenience: returns all 4 lists in one call for form dropdowns |

### Asset Routes (modified)

| Method | Path | Change |
|--------|------|--------|
| GET | `/api/assets` | Add filter params: `locationId`, `makeId`, `modelId`, `categoryId` |
| GET | `/api/assets/:id` | Include `locationName`, `makeName`, `modelName`, `categoryName` |
| GET | `/api/assets/lookup/:code` | Include resolved names |
| POST | `/api/assets` | Accept `locationId`, `makeId`, `modelId`, `categoryId` instead of `location` text |
| PUT | `/api/assets/:id` | Accept FK fields for editing |
| POST | `/api/assets/import` | CSV import maps Location column → locations table |

## Migration Strategy

The schema change is applied in `db/db.js` bootstrap — same as always, idempotent with try/catch for ALTER TABLE:

1. Create 4 new tables (`makes`, `models`, `locations`, `categories`) — `CREATE TABLE IF NOT EXISTS`
2. Add 4 FK columns to assets — each wrapped in try/catch for "duplicate column"
3. Seed locations from existing `SELECT DISTINCT location FROM assets WHERE location IS NOT NULL`
4. `UPDATE assets SET location_id = (SELECT id FROM locations WHERE name = assets.location)`
5. (Optional) Drop old `location` column — deferred to a future cleanup migration for safety

## Data Flow

```
Admin manages lists:
  POST/GET/PUT /api/lists/locations  →  locations table
  POST/GET/PUT /api/lists/makes      →  makes table
  POST/GET/PUT /api/lists/models     →  models table
  POST/GET/PUT /api/lists/categories →  categories table

Asset form loads:
  GET /api/lists/all  →  { locations, makes, models, categories }
  Renders 4 dropdowns
  Model dropdown filtered client-side by selected make

Asset created:
  POST /api/assets { assetNo, makeId, modelId, locationId, categoryId, ... }
  → INSERT into assets with FKs
  → Response includes resolved names via JOIN

Asset searched:
  GET /api/assets?locationId=3&categoryId=1
  → SELECT ... FROM assets
    LEFT JOIN locations ON assets.location_id = locations.id
    LEFT JOIN makes ON assets.make_id = makes.id
    LEFT JOIN models ON assets.model_id = models.id
    LEFT JOIN categories ON assets.category_id = categories.id
    WHERE location_id = ? AND category_id = ?
```

## Complexity Tracking

| Item | Why | Rejected Alternative |
|------|-----|---------------------|
| 4 separate tables, not one `master_lists` with type column | Models need FK to makes. A generic table can't express that relationship cleanly. | Single `master_lists` table with `type` + `parent_id` — rejected because it loses type safety and makes JOINs harder. |
| Client-side model filtering | 200 models total — loading all on page load is faster than an extra API call per make selection. | Server-side filtering with `?make_id=` — still supported for API consumers, but UI preloads all. |
| Resolved names in asset response | Avoids N+1 frontend lookups. Cost: slightly larger JSON payload (a few strings). | Separate API calls per asset — rejected for performance. |
| `location` text column retained temporarily | Safety net during migration. Allows rollback if FK migration fails. Drops later in cleanup. | Drop immediately — rejected because it's irreversible if something goes wrong. |
