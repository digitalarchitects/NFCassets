# Data Model: Initial MVP — NFC Asset Tracker

## Entity Relationship Diagram

```
┌──────────┐       ┌─────────────────────┐       ┌──────────────────┐
│  users   │       │       assets        │       │  asset_history   │
├──────────┤       ├─────────────────────┤       ├──────────────────┤
│ id (PK)  │       │ id (PK)             │──┐    │ id (PK)          │
│ username │       │ guid (UNIQUE)       │  │    │ asset_id (FK)    │──┐
│ password │       │ asset_no (UNIQUE)   │  │    │ action           │  │
│ role     │       │ serial_no           │  │    │ old_value        │  │
│ created  │       │ description         │  │    │ new_value        │  │
└──────────┘       │ owner               │  │    │ username         │  │
                   │ location            │  │    │ gps              │  │
                   │ status              │  │    │ created          │  │
                   │ nfc_tag             │  │    └──────────────────┘  │
                   │ photo_path          │  │                          │
                   │ created             │  │    ┌──────────────────┐  │
                   │ updated             │  │    │   verification   │  │
                   └─────────────────────┘  │    ├──────────────────┤  │
                          │                 │    │ id (PK)          │  │
                          │                 └────│ asset_id (FK)    │◄─┘
                          │                      │ username         │
                          │                      │ latitude         │
                          │                      │ longitude        │
                          │                      │ created          │
                          │                      └──────────────────┘
                          │
                   ┌──────┴──────┐
                   │  sessions   │
                   ├─────────────┤
                   │ sid (PK)    │
                   │ sess        │
                   │ expires     │
                   └─────────────┘
```

## Tables

### users

Local authentication accounts. Created via `npm run seed` (admin) or future admin UI.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| username | TEXT | UNIQUE NOT NULL | Login name |
| password_hash | TEXT | NOT NULL | bcrypt hash (12 rounds) |
| role | TEXT | NOT NULL DEFAULT 'user' | 'admin' or 'user' |
| created | DATETIME | DEFAULT CURRENT_TIMESTAMP | Account creation time |

### assets

The core asset register. Every asset has a GUID (UUIDv4) for stable identity and an `asset_no` for human readability. The `nfc_tag` column stores the same GUID for NFC/QR encoding.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| guid | TEXT | UNIQUE NOT NULL | UUIDv4 — stable identifier for NFC/QR |
| asset_no | TEXT | UNIQUE NOT NULL | Human-readable asset number (e.g., "LAPTOP-00451") |
| serial_no | TEXT | NULL | Manufacturer serial number |
| description | TEXT | NULL | Free-text description (model, type, etc.) |
| owner | TEXT | NULL | Current custodian name |
| location | TEXT | NULL | Physical location (building, room, site) |
| status | TEXT | NOT NULL DEFAULT 'active' | One of: active, missing, retired |
| nfc_tag | TEXT | NULL | GUID for NFC tag encoding |
| photo_path | TEXT | NULL | Filename in /uploads/ |
| created | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation |
| updated | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last modification |

**Indexes**: `idx_assets_guid`, `idx_assets_asset_no`

### asset_history

Immutable audit trail. Every create, transfer, verify, update, and photo action creates a row. Records are additive — never updated or deleted by normal application flows.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| asset_id | INTEGER | NOT NULL REFERENCES assets(id) ON DELETE CASCADE | Target asset |
| action | TEXT | NOT NULL | One of: create, transfer, verify, update, photo |
| old_value | TEXT | NULL | Previous value (JSON for transfers) |
| new_value | TEXT | NULL | New value |
| username | TEXT | NULL | Username who performed the action |
| gps | TEXT | NULL | "lat,lng" string when available |
| created | DATETIME | DEFAULT CURRENT_TIMESTAMP | Event timestamp |

**Indexes**: `idx_history_asset_id`

### verification

Dedicated table for "asset present" verification scans. Separated from `asset_history` for efficient dashboard queries (checked-today count) and potential geospatial analysis.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal ID |
| asset_id | INTEGER | NOT NULL REFERENCES assets(id) ON DELETE CASCADE | Verified asset |
| username | TEXT | NULL | Verifying user |
| latitude | REAL | NULL | GPS latitude (-90 to 90) |
| longitude | REAL | NULL | GPS longitude (-180 to 180) |
| created | DATETIME | DEFAULT CURRENT_TIMESTAMP | Scan timestamp |

**Indexes**: `idx_verification_asset_id`

### sessions

Express-session store. Managed automatically by `connect-sqlite3`-compatible session store. Rows expire and are cleaned up by the session middleware.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| sid | TEXT | PRIMARY KEY | Session ID (cookie value) |
| sess | TEXT | NOT NULL | Serialized session data (JSON) |
| expires | INTEGER | NOT NULL | Expiration timestamp (unix epoch) |

## State Transitions

### Asset Status

```
  [create] → active
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
     active  missing  retired
                │
        [edit via admin UI]
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
     active  missing  retired
```

### Verification Flow

```
  User taps "Verify"
        │
        ├── Online? ──► POST /api/verification ──► INSERT verification + asset_history
        │
        └── Offline? ──► IndexedDB.add(payload) ──► [on 'online' event] ──► flush ──► POST /api/verification
```

### NFC/QR Scan Flow

```
  NDEFReader / html5-qrcode / manual input
        │
        ▼
  Extract code (strip URL prefix, take last path segment)
        │
        ▼
  GET /api/assets/lookup/:code
        │
        ├── 200 → render asset detail
        └── 404 → "Asset not found"
```
