# Feature Specification: Initial MVP — NFC Asset Tracker

**Feature Branch**: `001-initial-mvp`  
**Created**: 2026-07-16  
**Status**: Complete (retrospective)  
**Input**: Build a lightweight proof-of-concept asset tracking system using NFC tags with QR fallback, deployable on commodity hardware with zero licensing cost.

## User Scenarios & Testing

### User Story 1 - Scan an Asset Tag (Priority: P1) 🎯 MVP

A staff member at a depot needs to quickly identify an asset by tapping its NFC tag with their phone or scanning its QR label. The system reads the identifier, looks up the asset, and displays its details (serial number, owner, location, status).

**Why this priority**: The core value proposition — you can't track what you can't identify. Every other feature depends on asset lookup.

**Independent Test**: Navigate to `/scan.html`, tap an NFC tag or scan a QR code containing a valid asset GUID or asset number — the asset detail page loads with correct data.

**Acceptance Scenarios**:

1. **Given** an NFC tag containing `AST-00451`, **When** user taps the tag with Chrome on Android, **Then** the asset detail page loads showing asset AST-00451
2. **Given** a QR code encoding `AST-00451`, **When** user scans it with the in-app camera, **Then** the asset detail page loads showing asset AST-00451
3. **Given** no NFC/QR hardware available, **When** user types `AST-00451` into the manual entry field, **Then** the asset detail page loads showing asset AST-00451
4. **Given** a scanned code that doesn't match any asset, **When** the lookup runs, **Then** user sees "Asset not found"

---

### User Story 2 - Verify Asset Presence (Priority: P1) 🎯 MVP

A staff member performing an audit scan confirms that an asset is physically present at its expected location. The verification is recorded with timestamp, username, and GPS coordinates for a tamper-evident audit trail.

**Why this priority**: Verification is the primary business action — proving assets exist where they should. Must work offline for remote sites.

**Independent Test**: From the asset detail page, tap "Verify." A verification record is created with timestamp and GPS (if available). History shows the verify event.

**Acceptance Scenarios**:

1. **Given** a loaded asset with GPS available, **When** user taps "Verify", **Then** a verification record is created with latitude/longitude and appears in history
2. **Given** a loaded asset with GPS unavailable (desktop, denied), **When** user taps "Verify", **Then** a verification record is created with null coordinates
3. **Given** the device is offline, **When** user taps "Verify", **Then** the scan is queued in IndexedDB and auto-synced when connectivity returns

---

### User Story 3 - Transfer Asset Custody (Priority: P2)

A staff member transfers an asset to a new owner or location, and the change is recorded in the audit trail.

**Why this priority**: Asset custody tracking is the second-highest business value after presence verification.

**Independent Test**: From asset detail, expand Transfer panel, enter new owner/location, submit. Asset reflects new values. History shows a transfer event with old and new values.

**Acceptance Scenarios**:

1. **Given** asset LAPTOP-00451 assigned to "Kevin Wilson" at "Head Office", **When** user transfers to "Jane Doe" at "Satellite Office", **Then** asset shows new owner/location and history records the change
2. **Given** a transfer with only owner changed (no location), **When** submitted, **Then** location remains unchanged and history records only the owner delta
3. **Given** GPS is available, **When** transfer is submitted, **Then** history entry includes GPS coordinates

---

### User Story 4 - Admin: Register & Manage Assets (Priority: P2)

An administrator creates new asset records, edits existing ones, uploads photos, and bulk-imports from a CSV file exported from an existing asset register.

**Why this priority**: The system is useless without assets in it. Admin CRUD + bulk import provide the onboarding path.

**Independent Test**: Log in as admin, create asset AST-00123. It appears in the assets list. Import a CSV with 3 rows — all 3 appear. Upload a photo to an asset — it displays on the detail page.

**Acceptance Scenarios**:

1. **Given** admin is logged in, **When** they fill the Add Asset form and submit, **Then** a new asset is created with a GUID and appears in the list
2. **Given** a CSV with columns AssetNo, SerialNo, Description, Owner, Location, **When** admin imports it, **Then** all valid rows create assets; duplicates are skipped with an error message
3. **Given** an existing asset, **When** admin uploads a photo, **Then** the photo is stored in `/uploads/` and displayed on the asset detail page
4. **Given** an existing asset, **When** admin edits serial number or description, **Then** the asset is updated

---

### User Story 5 - Dashboard & Search (Priority: P3)

Any authenticated user sees a dashboard with total assets, verified-today count, and missing-asset count. They can search/filter the full asset list.

**Why this priority**: Situational awareness supports all other workflows — you need to know what's missing before you can go find it.

**Independent Test**: Log in, dashboard shows counts. Search for "laptop" — matching assets appear. Filter by status "missing" — only missing assets shown.

**Acceptance Scenarios**:

1. **Given** multiple assets exist, **When** user visits dashboard, **Then** total, checked-today, and missing counts are displayed
2. **Given** the assets list, **When** user types "Dell" in the search box, **Then** results are filtered to assets with "Dell" in any field
3. **Given** the assets list, **When** user selects status filter "missing", **Then** only missing assets are shown

---

### User Story 6 - Write NFC Tags (Priority: P3)

An admin can write an asset's GUID to an NTAG213/NTAG215 tag directly from the browser using Web NFC, encoding both a URL reference and the raw GUID.

**Why this priority**: NFC tag provisioning is essential for production deployment but can be done in batches separately from day-to-day operations.

**Independent Test**: On Chrome/Android, load an asset, tap "Write to NFC Tag," hold phone near a blank tag. Tag now reads back to the same asset.

**Acceptance Scenarios**:

1. **Given** a Chrome/Android device with NDEFReader support, **When** admin taps "Write to NFC Tag" on an asset page, **Then** the tag is encoded with both a URL record and a text record containing the asset GUID

---

### Edge Cases

- **Concurrent scans**: Two staff members verify the same asset simultaneously — each creates an independent verification record (no conflict)
- **NFC tag with URL**: Tags may contain a full URL like `https://example.com/asset.html?code=AST-00123`. The scanner extracts the last path segment as the code
- **CSV with mixed column casing**: Import handles `AssetNo`, `assetNo`, and `asset_no` column headers interchangeably
- **Duplicate asset numbers**: Creating an asset with an existing `asset_no` returns 409 Conflict
- **Session expiry**: After 8 hours, session cookie expires and API returns 401, redirecting to login
- **Browser without Web NFC**: iOS, desktop — the NFC scan button is hidden; QR and manual entry serve as fallbacks
- **Photo type validation**: Only JPEG, PNG, GIF, and WebP up to 5MB are accepted; server rejects others
- **Rate limiting**: More than 10 login attempts in 15 minutes triggers a cooldown response

## Requirements

### Functional Requirements

- **FR-001**: System MUST identify assets by GUID and human-readable asset number via NFC scan, QR scan, or manual entry
- **FR-002**: System MUST record every verification with timestamp, username, and GPS coordinates (when available)
- **FR-003**: System MUST record every transfer with old/new owner/location, username, and GPS
- **FR-004**: System MUST maintain an append-only audit trail (`asset_history`) — past events must not be mutable
- **FR-005**: System MUST allow admin users to create, update, and bulk-import assets
- **FR-006**: System MUST support photo upload per asset with server-side type and size validation
- **FR-007**: System MUST support NFC tag writing via NDEFReader for admin users
- **FR-008**: System MUST function offline for verification scans and auto-sync when connectivity returns
- **FR-009**: System MUST authenticate users via local username/password accounts with bcrypt hashing
- **FR-010**: System MUST provide a dashboard showing total, verified-today, and missing asset counts
- **FR-011**: System MUST support full-text search across asset number, serial number, description, owner, and location
- **FR-012**: System MUST serve as an installable PWA with a service worker caching the app shell
- **FR-013**: System MUST enforce CSRF protection on all state-changing API endpoints
- **FR-014**: System MUST enforce security headers via Helmet and rate-limit login attempts

### Key Entities

- **User**: Local account with username, bcrypt password hash, role (admin/user). Created via seed script or future admin UI.
- **Asset**: Core entity identified by GUID (UUIDv4) and human-readable asset_no. Has serial_no, description, owner, location, status (active/missing/retired), optional photo_path, nfc_tag. Timestamped with created/updated.
- **AssetHistory**: Immutable audit record. Linked to asset via FK. Records action type (create/transfer/verify/update/photo), old_value, new_value, username, GPS, timestamp.
- **Verification**: "Present" confirmation record. Linked to asset via FK. Records username, latitude, longitude, timestamp. Separate from asset_history for efficient querying (dashboard stats, audit reports).

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can scan an NFC tag and see asset details in under 2 seconds on local network
- **SC-002**: Verification scans made offline sync automatically within 5 seconds of connectivity restoration
- **SC-003**: System supports at least 10,000 assets with sub-second search on SQLite
- **SC-004**: Entire app runs on a Raspberry Pi or small VM with < 256MB RAM usage
- **SC-005**: Zero software licensing cost — all dependencies are open-source
- **SC-006**: Admin can bulk-import 1,000 assets from CSV in under 30 seconds

## Assumptions

- Primary users are staff with Android phones (Chrome) — Web NFC requires Chrome/Android
- iOS and desktop users fall back to QR scanning or manual entry
- Assets are tagged with NTAG213/NTAG215 NFC tags containing only the identifier (GUID or asset_no)
- Existing asset register data is exportable to CSV with standard columns
- Deployed on a single server (no clustering needed for PoC)
- Internet access is intermittent at some sites — offline-first design is critical
- SQLite is sufficient for the proof-of-concept scale (< 50,000 assets)
- Local username/password auth is acceptable initially; SSO can be added later

## Implementation Notes (Retrospective)

The implementation deviated from the original `thoughts.md` vision in minor ways:

- **Database driver**: Uses Node.js built-in `node:sqlite` (DatabaseSync) instead of `better-sqlite3` — zero native addon dependencies, simpler install
- **Frontend framework**: Bootstrap 5 via jsDelivr CDN instead of local Bootstrap files — faster setup, automatic updates
- **QR library**: html5-qrcode (v2.3.8) from CDN — chosen for its simple API and environment-camera support
- **NFC tag format**: Tags carry both a URL record (`/asset.html?code=<GUID>`) and a text record (raw GUID) for maximum compatibility
- **Photo storage**: Filesystem (`/uploads/`) rather than database blobs — simpler backup, no DB bloat
- **Asset identifier**: Uses UUIDv4 as GUID, stored in both `guid` and `nfc_tag` columns — `nfc_tag` doubles as the QR/NFC payload
- **Stateless validation**: express-validator is used at the route level; no shared validation middleware
