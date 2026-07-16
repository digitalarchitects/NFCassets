# NFC Asset Tracker

Lightweight PWA for tracking physical assets using NFC tags (with a QR code
fallback), built as a proof of concept that runs anywhere Node.js runs
(Raspberry Pi, small VM, or a laptop).

## Stack
- **Front end:** PWA (manifest + service worker), Bootstrap, vanilla JS, Web NFC API
- **Back end:** Node.js + Express
- **Database:** SQLite (via `better-sqlite3`)
- **Auth:** local username/password accounts stored in SQLite (session-based)

## Setup

```bash
npm install
cp .env.example .env   # then edit SESSION_SECRET / ADMIN_USERNAME / ADMIN_PASSWORD
npm run seed            # creates the initial admin user
npm start                # or `npm run dev` for auto-reload
```

The app listens on `http://localhost:3000` by default.

## Web NFC requires HTTPS

Chrome only exposes `NDEFReader` on secure origins (HTTPS or `localhost`). To
test scanning/writing on an Android phone over your LAN, generate a locally
trusted certificate with [mkcert](https://github.com/FiloSottile/mkcert) and
serve the app behind it (e.g. via a small HTTPS wrapper or a reverse proxy
such as Caddy/nginx pointed at port 3000). Devices without Web NFC support
(iOS, desktop browsers) automatically fall back to the in-app QR scanner or
manual asset-number entry — no code changes required.

## Data model

- `users` — local accounts (`admin` / `user` roles)
- `assets` — asset register, identified by a GUID (also encoded in the asset's
  NFC tag / QR code) and a human-readable `asset_no`
- `asset_history` — audit trail of create/update/transfer/verify/photo events
- `verification` — GPS-stamped "asset present" checks, used for audits

## Bulk import

Admins can import a CSV with columns `AssetNo,SerialNo,Description,Owner,Location`
from the Assets page.

## Offline scans

Verification scans made while offline are queued in IndexedDB on the device
and automatically synced the next time the browser regains connectivity.

## Roadmap ideas

- Swap local auth for Entra ID / SSO once beyond proof-of-concept
- Printable QR labels for asset tags
- Migrate from SQLite to PostgreSQL if the register grows beyond ~50,000 assets
