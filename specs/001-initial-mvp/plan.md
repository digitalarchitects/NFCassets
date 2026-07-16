# Implementation Plan: Initial MVP — NFC Asset Tracker

**Branch**: `001-initial-mvp` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-initial-mvp/spec.md`

## Summary

Build a lightweight PWA for tracking physical assets using NFC tags with QR fallback. Single-process Node.js/Express server backed by SQLite, deployable on Raspberry Pi, VM, or laptop with zero licensing cost. Frontend uses vanilla JS + Bootstrap 5, leveraging Web NFC API for tag scanning and html5-qrcode for camera-based QR fallback. Offline verification scans queue in IndexedDB and auto-sync via service worker.

## Technical Context

**Language/Version**: JavaScript (Node.js 22+, ES2024)  
**Primary Dependencies**: express 4.x, node:sqlite (built-in), bcryptjs, express-session, express-validator, helmet, express-rate-limit, multer, uuid, csv-parse, dotenv  
**Storage**: SQLite via `node:sqlite` (DatabaseSync), single file `assets.db` with WAL mode  
**Testing**: Manual verification (no test framework configured for PoC)  
**Target Platform**: Linux server (Raspberry Pi, VM, or laptop), Android Chrome for NFC, any browser for QR/manual  
**Project Type**: Web application (monolithic — Express serves both API and static PWA frontend)  
**Performance Goals**: Sub-second asset lookup, support 10k+ assets, < 256MB RAM  
**Constraints**: Must run offline for scan/verify, sync when online, zero paid dependencies  
**Scale/Scope**: PoC for single-site deployment, < 50,000 assets, < 100 concurrent users

## Constitution Check

*GATE: Must pass before implementation.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Lightweight, Zero-Licensing Stack | ✅ PASS | Node.js + Express + SQLite + vanilla JS. All deps MIT/ISC licensed. Zero paid services. |
| II. Offline-First Scanning | ✅ PASS | IndexedDB queue in `offline-queue.js`, auto-flush on `online` event, service worker with cache-first for shell |
| III. GUID Identity, Cheap Tags | ✅ PASS | Every asset gets UUIDv4 GUID. Tags carry only GUID/asset_no. All detail lookups happen server-side via `/api/assets/lookup/:code` |
| IV. Audit Trail on Every Action | ✅ PASS | `asset_history` records create/transfer/verify/update/photo with username + GPS. `verification` table for scan events. WAL mode for concurrent safety. |
| V. Security Before Convenience | ✅ PASS | Helmet CSP, bcrypt (12 rounds), CSRF tokens, rate-limited login, session httpOnly, file type/size validation on uploads, .env secrets |
| VI. Simplicity Until Proven Otherwise | ✅ PASS | SQLite (not PostgreSQL), local auth (not SSO), vanilla JS (not React), single process (not microservices). No build toolchain. |

## Project Structure

### Documentation (this feature)

```text
specs/001-initial-mvp/
├── spec.md              # Feature specification
├── plan.md              # This file
├── data-model.md        # Entity definitions and schema
├── quickstart.md        # Setup and validation steps
├── tasks.md             # Task list (all completed)
└── checklists/          # Quality checklists
```

### Source Code (repository root)

```text
NFCassets/
├── app.js                 # Express server entry point
├── assets.db              # SQLite database (runtime)
├── .env.example           # Environment template
├── package.json           # Dependencies and scripts
├── package-lock.json
├── .gitignore
├── README.md
├── thoughts.md            # Design notes and initial brainstorming
├── db/
│   ├── db.js              # Database connection + schema bootstrap
│   ├── schema.sql         # DDL (users, assets, asset_history, verification, sessions)
│   ├── seed.js            # Admin user seed script
│   └── sessionStore.js    # SQLite-backed express-session store
├── middleware/
│   ├── auth.js            # requireAuth, requireRole
│   ├── csrf.js             # Session-backed CSRF token generation + validation
│   └── upload.js          # Multer config (5MB, image types only)
├── routes/
│   ├── auth.js            # POST /api/auth/login, /logout, GET /me
│   ├── assets.js          # CRUD + lookup + stats + transfer + photo + import
│   ├── history.js         # GET /api/history/:assetId
│   └── verification.js    # POST /api/verification, GET /:assetId
├── uploads/               # Asset photos (runtime)
└── public/                # PWA frontend (static)
    ├── index.html         # Dashboard
    ├── login.html         # Login page
    ├── scan.html          # NFC/QR/manual scan
    ├── asset.html         # Asset detail (verify, transfer, photo, history)
    ├── assets.html        # Asset list with search/filter, admin add/import
    ├── manifest.json      # PWA manifest
    ├── sw.js              # Service worker (cache-first shell, network-first API)
    ├── icons/
    │   └── icon.svg
    ├── css/
    │   └── style.css
    └── js/
        ├── common.js      # AT.apiFetch, AT.requireLogin, AT.renderNav, CSRF
        ├── auth.js        # Login page logic
        ├── dashboard.js   # Dashboard stats
        ├── scan.js        # NFC + QR + manual entry
        ├── asset.js       # Asset detail + verify + transfer + photo + tag write
        ├── assets-list.js # Asset list/search + admin: add/import
        └── offline-queue.js # IndexedDB queue for offline verifications
```

**Structure Decision**: Single-project monolithic structure. Express serves both the REST API under `/api/` and static PWA files from `/public/`. No build step — all JS/HTML/CSS is served as-authored. This aligns with Principle VI (Simplicity) and avoids the overhead of a separated frontend/backend architecture for the PoC.

## Complexity Tracking

No constitution violations. All principles satisfied directly. The only architectural choice worth noting:

- **Why not better-sqlite3 (as in thoughts.md)?** The Node.js 22 built-in `node:sqlite` module provides synchronous SQLite access without native addon compilation. For the PoC, this eliminates the most common install failure point (node-gyp, build-essential) while providing identical API ergonomics. Migration path to better-sqlite3 exists if performance profiling shows it's needed — just swap `require('node:sqlite')` → `require('better-sqlite3')`.

## Routes

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/csrf-token` | None | - | Get CSRF token |
| POST | `/api/auth/login` | None | - | Login (rate limited) |
| POST | `/api/auth/logout` | Session | - | Logout |
| GET | `/api/auth/me` | Session | - | Current user |
| GET | `/api/assets/stats` | Session | - | Dashboard counts |
| GET | `/api/assets/lookup/:code` | Session | - | Lookup by GUID or asset_no |
| GET | `/api/assets` | Session | - | List/search assets |
| GET | `/api/assets/:id` | Session | - | Get single asset |
| POST | `/api/assets` | Session | admin | Create asset |
| PUT | `/api/assets/:id` | Session | admin | Update asset |
| POST | `/api/assets/:id/transfer` | Session | - | Transfer custody |
| POST | `/api/assets/:id/photo` | Session | - | Upload photo |
| POST | `/api/assets/import` | Session | admin | Bulk CSV import |
| GET | `/api/history/:assetId` | Session | - | Asset history |
| POST | `/api/verification` | Session | - | Record verification |
| GET | `/api/verification/:assetId` | Session | - | Get verifications |

## Data Flow

```
NFC Tag / QR Code
       │
       ▼
  [Scan Page] ──NDEFReader / html5-qrcode──► Extract code (GUID or asset_no)
       │
       ▼
  GET /api/assets/lookup/:code ──► SQLite ──► Asset JSON
       │
       ▼
  [Asset Detail Page]
       │
       ├── Verify ──► POST /api/verification ──► verification + asset_history
       │                   │
       │            [Offline?] ──► IndexedDB Queue ──► auto-sync on online
       │
       ├── Transfer ──► POST /api/assets/:id/transfer ──► asset_history
       │
       ├── Photo ──► POST /api/assets/:id/photo ──► /uploads/
       │
       └── Write Tag ──► NDEFReader.write() ──► URL + text records
```
