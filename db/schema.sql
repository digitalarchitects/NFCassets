-- SQLite schema for NFC Asset Tracker

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Spec 002: Add active column (safe to re-run)
ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- Spec 004: LDAP import columns on users (safe to re-run)
ALTER TABLE users ADD COLUMN ad_guid TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ad_guid ON users(ad_guid) WHERE ad_guid IS NOT NULL;

-- Spec 003: Master list tables
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guid TEXT UNIQUE NOT NULL,
    asset_no TEXT UNIQUE NOT NULL,
    serial_no TEXT,
    description TEXT,
    owner TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'missing' | 'retired'
    nfc_tag TEXT,
    photo_path TEXT,
    created DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_guid ON assets(guid);
CREATE INDEX IF NOT EXISTS idx_assets_asset_no ON assets(asset_no);

-- Spec 003: FK columns on assets (safe to re-run)
ALTER TABLE assets ADD COLUMN make_id INTEGER REFERENCES makes(id);
ALTER TABLE assets ADD COLUMN model_id INTEGER REFERENCES models(id);
ALTER TABLE assets ADD COLUMN location_id INTEGER REFERENCES locations(id);
ALTER TABLE assets ADD COLUMN category_id INTEGER REFERENCES categories(id);

CREATE INDEX IF NOT EXISTS idx_assets_make_id ON assets(make_id);
CREATE INDEX IF NOT EXISTS idx_assets_model_id ON assets(model_id);
CREATE INDEX IF NOT EXISTS idx_assets_location_id ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON assets(category_id);

CREATE TABLE IF NOT EXISTS asset_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'create' | 'transfer' | 'verify' | 'update' | 'photo'
    old_value TEXT,
    new_value TEXT,
    username TEXT,
    gps TEXT,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_history_asset_id ON asset_history(asset_id);

CREATE TABLE IF NOT EXISTS verification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    username TEXT,
    latitude REAL,
    longitude REAL,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_asset_id ON verification(asset_id);

CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires INTEGER NOT NULL
);

-- Spec 004: LDAP sync audit tables
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started DATETIME NOT NULL,
    finished DATETIME,
    users_created INTEGER DEFAULT 0,
    users_updated INTEGER DEFAULT 0,
    users_disabled INTEGER DEFAULT 0,
    users_missing INTEGER DEFAULT 0,
    errors TEXT
);

CREATE TABLE IF NOT EXISTS sync_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_log_id INTEGER NOT NULL REFERENCES sync_log(id),
    username TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    details TEXT,
    resolved INTEGER DEFAULT 0,
    resolution TEXT,
    resolved_at DATETIME,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);
