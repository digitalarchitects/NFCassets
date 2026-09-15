const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Returns a fresh temporary database file path and ensures its directory exists.
 * The caller is responsible for deleting the file afterwards.
 */
function tempDbPath() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nfc-test-'));
    return path.join(dir, 'test.db');
}

/**
 * Delete a temporary database and its WAL/shm sidecars.
 */
function cleanupDb(dbPath) {
    for (const ext of ['', '-wal', '-shm']) {
        try {
            fs.unlinkSync(dbPath + ext);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
    }
    try {
        fs.rmdirSync(path.dirname(dbPath));
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

module.exports = { tempDbPath, cleanupDb };
