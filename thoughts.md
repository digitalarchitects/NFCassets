Absolutely. For a proof-of-concept I'd avoid Azure, SQL Server, React, etc. and build something you can run on a Raspberry Pi, small VM, Windows PC, or even a laptop at a site.

Lightweight Stack
Front End
PWA (Progressive Web App)
HTML + Bootstrap
Vanilla JavaScript
Web NFC API
Backend
Node.js
Express
Database
SQLite
Authentication (initially)
Local users in SQLite
Add Entra ID later if needed
Deployment
Android Phone
Android Tablet
     │
Chrome Browser
     │
NodeJS Express
     │
SQLite Database
     │
Asset Images


Everything can live in one folder:

asset-tracker/
│
├── app.js
├── assets.db
├── uploads/
├── public/
│   ├── index.html
│   ├── scan.html
│   ├── assets.html
│   ├── app.js
│   └── style.css
│
└── api/

Core Screens
1. Dashboard
+----------------------+
| Asset Tracker        |
+----------------------+

Assets        12,504
Checked Today    780
Missing          42

[ Scan Asset ]
[ Search ]
[ Reports ]

2. Scan Asset
+---------------------+
|  Scan NFC Tag       |
+---------------------+

Tap asset tag

Waiting for NFC...


When scanned:

Asset: LAPTOP-00451

Dell Latitude 5550
Serial: DLT554433

Assigned To:
Kevin Wilson

Location:
Head Office

Status:
Active

[ Verify ]
[ Transfer ]
[ History ]

3. Transfer Asset
Asset:
LAPTOP-00451

Current Owner:
Kevin Wilson

New Owner:
[dropdown]

Location:
[dropdown]

[ Save ]

4. Location Verification

Useful for annual audits.

Scan asset

✓ Present

Timestamp:
2026-07-16 15:10

User:
Kevin Wilson

GPS:
-26.1234, 28.5678

SQLite Schema
Assets
CREATE TABLE assets (
    id INTEGER PRIMARY KEY,
    guid TEXT UNIQUE,
    asset_no TEXT,
    serial_no TEXT,
    description TEXT,
    owner TEXT,
    location TEXT,
    status TEXT,
    nfc_tag TEXT,
    created DATETIME
);

Asset History
CREATE TABLE asset_history (
    id INTEGER PRIMARY KEY,
    asset_id INTEGER,
    action TEXT,
    old_value TEXT,
    new_value TEXT,
    username TEXT,
    gps TEXT,
    created DATETIME
);

Verification
CREATE TABLE verification (
    id INTEGER PRIMARY KEY,
    asset_id INTEGER,
    username TEXT,
    latitude REAL,
    longitude REAL,
    created DATETIME
);

NFC Flow

The NFC tag only contains:

{
  "asset":"LAPTOP-00451"
}


or

AST-00451


The application then:

Scan NFC
   ↓
Read Asset Number
   ↓
Call API
   ↓
Lookup SQLite
   ↓
Display Asset


This keeps tags cheap and replaceable.

GPS Integration

Android browser:

navigator.geolocation.getCurrentPosition(...)


On every scan:

{
  "asset":"AST00123",
  "lat":-26.1234,
  "lng":28.1234,
  "user":"Kevin Wilson",
  "time":"2026-07-16T15:15:00"
}


This gives an audit trail of where assets were seen.

Offline Support

The PWA can store transactions in:

IndexedDB


Workflow:

No Signal
    ↓
Store Scan Locally
    ↓
Connection Returns
    ↓
Auto Sync


Ideal for remote construction sites and depots.

Additional Features I'd Add Later
Photo Capture
<input type="file" accept="image/*" capture="environment">


Take a photo of:

Asset
Serial number
Damage
Installation
QR Backup

Every NFC label also contains:

QR: AST-00451
NFC: AST-00451


If NFC fails:

Open Camera
Scan QR
Continue

Bulk Import

Upload your existing asset register:

AssetNo,SerialNo,Description,Owner,Location


The system creates all records automatically.

Hardware Cost

For 10,000 assets:

Item	CostNTAG213 On-metal tags	~R5-R15 each
Hosting	Existing VM
Database	SQLite
App Server	NodeJS
Android devices	Existing phones/tablets

So the entire system can be developed and run with essentially zero software licensing cost.

For your environment, I'd actually make the asset identifier a GUID stored in NFC + QR code, capture GPS + photo + timestamp on every verification, and use SQLite initially then switch to PostgreSQL only if you grow beyond about 50,000 assets. That keeps the prototype extremely simple while still being production-capable.