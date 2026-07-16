# Constitution Compliance Checklist: Initial MVP

**Purpose**: Verify all constitutional principles are satisfied by the implementation
**Created**: 2026-07-16
**Feature**: [spec.md](../spec.md)

## Principle I: Lightweight, Zero-Licensing Stack

- [x] CHK001 All dependencies are MIT/ISC/Apache-2.0 licensed — no paid or proprietary packages
- [x] CHK002 No external SaaS/cloud services required for core functionality
- [x] CHK003 App runs in a single Node.js process — no separate frontend build toolchain
- [x] CHK004 Total dependency footprint fits a single `npm install` with no native compilation (node:sqlite is built-in)

## Principle II: Offline-First Scanning

- [x] CHK005 Verification scans work without network — queued in IndexedDB via `offline-queue.js`
- [x] CHK006 Offline queue auto-flushes on `online` event and page load
- [x] CHK007 Service worker caches app shell (HTML, JS, CSS, CDN libs) for offline access
- [x] CHK008 API calls fail gracefully with "Offline" JSON response when unreachable

## Principle III: GUID Identity, Cheap Replaceable Tags

- [x] CHK009 Every asset created gets a UUIDv4 GUID — `POST /api/assets` generates one
- [x] CHK010 NFC tags contain only identifier (GUID URL + raw GUID text) — no asset details on tag
- [x] CHK011 QR codes mirror NFC — same identifier, no details encoded
- [x] CHK012 Asset detail lookup always goes through `GET /api/assets/lookup/:code` — server is source of truth

## Principle IV: Audit Trail on Every Action

- [x] CHK013 Asset creation records `asset_history` row (action=create, username, new_value)
- [x] CHK014 Verification records both `asset_history` (action=verify) and `verification` table rows
- [x] CHK015 Transfer records `asset_history` (action=transfer, old_value as JSON, new_value as JSON, gps)
- [x] CHK016 Photo upload records `asset_history` (action=photo, new_value=filename)
- [x] CHK017 Status change records `asset_history` (action=update, old_value, new_value)
- [x] CHK018 No application code mutates or deletes existing `asset_history` or `verification` rows
- [x] CHK019 All history entries include username from session

## Principle V: Security Before Convenience

- [x] CHK020 Passwords hashed with bcrypt (12 rounds) — never stored in plaintext
- [x] CHK021 Session cookies are httpOnly, sameSite=lax, secure=true in production
- [x] CHK022 Helmet CSP configured with restrictive directives (no unsafe-eval, CDN whitelist for scripts/styles)
- [x] CHK023 Login rate-limited: 10 attempts per 15 minutes per IP
- [x] CHK024 CSRF tokens required on all state-changing requests (POST/PUT/DELETE)
- [x] CHK025 File uploads validated server-side: image types only, 5MB max
- [x] CHK026 Secrets (SESSION_SECRET, ADMIN_PASSWORD) supplied via .env, gitignored
- [x] CHK027 Authentication required for all `/api/assets/*`, `/api/history/*`, `/api/verification/*` and `/uploads/*`
- [x] CHK028 Admin-only endpoints (create/update/import assets) enforce `requireRole('admin')`

## Principle VI: Simplicity Until Proven Otherwise

- [x] CHK029 SQLite used instead of PostgreSQL — no separate database server
- [x] CHK030 Local auth instead of SSO (Entra ID) — no external identity provider dependency
- [x] CHK031 Vanilla JS instead of React/Vue/Svelte — no build step, no framework lock-in
- [x] CHK032 Single Express process serves both API and static frontend — no reverse proxy required for dev
- [x] CHK033 No ORM — direct SQL via `db.prepare().run()/.get()/.all()`
- [x] CHK034 No abstraction layers between routes and database — reads are clear and traceable

## Principle VII: Container-First, Cloudflare-Published (v1.1.0)

- [ ] CHK039 Dockerfile for the app — multi-stage, production-slim image
- [ ] CHK040 nginx reverse proxy sidecar — serves frontend + proxies /api/ to backend
- [ ] CHK041 docker-compose.yml — app + nginx, single host port mapped to nginx:80
- [ ] CHK042 Cloudflare Tunnel (`cloudflared`) pointing to `127.0.0.1:<host-port>`
- [ ] CHK043 Same-origin — no CORS configuration needed (/api/ proxied by nginx)
- [ ] CHK044 TLS terminated by Cloudflare — internal traffic is plain HTTP
- [ ] CHK045 Host port checked against PORT MAP in Hermes memory — no conflicts
- [ ] CHK046 Host port added to PORT MAP in memory after deployment

## Delivery Standards

- [x] CHK035 Spec clearly scopes frontend (`public/`), API (`routes/`), schema (`db/`), middleware
- [x] CHK036 Spec calls out offline behavior, NFC/QR tag format, audit trail impact, and auth requirements
- [x] CHK037 Plan names real npm scripts: `npm start`, `npm run dev`, `npm run seed`
- [x] CHK038 Plan preserves compatibility with existing `db/schema.sql` (no breaking migrations needed)

## Summary

**Total**: 46 | **Passed**: 38 | **Pending**: 8 (Principle VII — containerization) | **Failed**: 0 | **N/A**: 0

Constitution v1.0.0 principles (I-VI): all satisfied. Principle VII (Container-First, v1.1.0) added — Docker/nginx/Cloudflare deployment pending.
