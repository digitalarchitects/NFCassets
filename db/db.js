const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'assets.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Idempotent schema bootstrap - safe to run on every boot.
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

// Split schema into individual statements; handle ALTER TABLE failures
// (duplicate column) gracefully for idempotent re-runs.
const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

for (const stmt of statements) {
    try {
        db.exec(stmt + ';');
    } catch (err) {
        // SQLite "duplicate column" error — column already exists, safe to ignore
        if (err.message && err.message.includes('duplicate column')) {
            console.log(`Schema: skipped (already applied): ${stmt.substring(0, 60)}...`);
            continue;
        }
        throw err;
    }
}

// Spec 003: Migrate existing location text to location_id (idempotent)
try {
    const count = db.prepare(
        "SELECT COUNT(*) AS n FROM assets WHERE location IS NOT NULL AND location_id IS NULL"
    ).get().n;
    if (count > 0) {
        // Seed locations from existing asset location values
        db.exec(`
            INSERT OR IGNORE INTO locations (name)
            SELECT DISTINCT location FROM assets
            WHERE location IS NOT NULL AND location != ''
        `);
        // Link assets to location IDs
        db.exec(`
            UPDATE assets SET location_id = (
                SELECT id FROM locations WHERE name = assets.location
            )
            WHERE location IS NOT NULL AND location_id IS NULL
        `);
        console.log(`Migrated ${count} assets: location text → location_id`);
    }
} catch (err) {
    // locations table may not exist yet (fresh install without spec 003 schema)
    if (!err.message.includes('no such table')) {
        throw err;
    }
}

module.exports = db;
