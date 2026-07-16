# Quickstart: Initial MVP — NFC Asset Tracker

## Prerequisites

- Node.js 22+ (for built-in `node:sqlite` module)
- npm 10+

## Setup

```bash
cd /home/server/github/NFCassets
npm install
cp .env.example .env
```

Edit `.env` and set:
- `SESSION_SECRET` — long random string (e.g., `openssl rand -hex 32`)
- `ADMIN_USERNAME` — default: `admin`
- `ADMIN_PASSWORD` — strong password for initial admin account

## Seed the Admin User

```bash
npm run seed
```

This creates the initial admin account from your `.env` values. Safe to re-run — skips if user already exists.

## Run

```bash
# Production
npm start              # http://localhost:3000

# Development (auto-reload via nodemon)
npm run dev            # http://localhost:3000
```

## Verify

1. **Login**: Open `http://localhost:3000/login.html`, log in with admin credentials
2. **Dashboard**: Should show 0/0/0 assets initially
3. **Create asset**: Navigate to Assets → Add Asset, create "LAPTOP-001"
4. **Scan**: Navigate to Scan, enter "LAPTOP-001" manually → asset detail loads
5. **Verify**: On asset detail, tap "Verify" → history shows verify event
6. **Transfer**: Expand Transfer, change owner → asset updates, history records transfer
7. **CSV import**: Create a CSV with `AssetNo,SerialNo,Description,Owner,Location` headers, import via Assets page
8. **Photo**: On asset detail, upload a JPEG/PNG → photo displays

## NFC Testing (Android Chrome Required)

1. Open `https://<your-server>:3000/scan.html` or `http://localhost:3000/scan.html` on an Android phone with Chrome
2. Tap "Tap to Scan NFC Tag"
3. Hold an NFC tag against the phone
4. Asset detail loads if tag contains a valid GUID or asset_no

To write a tag:
1. Load an asset on Chrome/Android
2. Tap "Write to NFC Tag"
3. Hold a blank NTAG213/NTAG215 against the phone

## HTTPS for Web NFC

Web NFC (NDEFReader) only works on secure origins. For LAN testing:

```bash
# Install mkcert (once)
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
./mkcert-v*-linux-amd64 -install

# Generate local cert
mkcert localhost 192.168.x.x
```

Then run Express behind a reverse proxy or use the certs directly (requires code change to `app.js`).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 3000 | Server port |
| SESSION_SECRET | Yes | - | Express session signing key |
| ADMIN_USERNAME | No | admin | Seed admin username |
| ADMIN_PASSWORD | Yes | - | Seed admin password |
| NODE_ENV | No | development | 'production' enables secure cookies |

## Directory Layout After Setup

```text
NFCassets/
├── assets.db        # Created on first boot (SQLite, WAL mode)
├── uploads/          # Asset photos stored here
└── node_modules/    # Installed dependencies
```
