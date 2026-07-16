const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, param, query, validationResult } = require('express-validator');
const { parse } = require('csv-parse/sync');
const db = require('../db/db');
const upload = require('../middleware/upload');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function recordHistory({ assetId, action, oldValue, newValue, username, gps }) {
    db.prepare(
        `INSERT INTO asset_history (asset_id, action, old_value, new_value, username, gps)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(assetId, action, oldValue ?? null, newValue ?? null, username ?? null, gps ?? null);
}

function checkValidation(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg });
        return false;
    }
    return true;
}

// --- Dashboard stats -------------------------------------------------------
router.get('/stats', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) AS n FROM assets').get().n;
    const missing = db.prepare("SELECT COUNT(*) AS n FROM assets WHERE status = 'missing'").get().n;
    const checkedToday = db
        .prepare(
            `SELECT COUNT(DISTINCT asset_id) AS n FROM verification
             WHERE date(created) = date('now', 'localtime')`
        )
        .get().n;

    res.json({ total, missing, checkedToday });
});

// --- Lookup by GUID or asset number (used by NFC/QR scan) -----------------
router.get('/lookup/:code', param('code').isString().trim().notEmpty(), (req, res) => {
    if (!checkValidation(req, res)) return;
    const { code } = req.params;
    const asset = db
        .prepare('SELECT * FROM assets WHERE guid = ? OR asset_no = ?')
        .get(code, code);

    if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
    }
    res.json({ asset });
});

// --- List / search ----------------------------------------------------------
router.get(
    '/',
    query('q').optional().isString().trim(),
    query('status').optional().isString().trim(),
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const { q, status } = req.query;
        const limit = req.query.limit || 100;
        const offset = req.query.offset || 0;

        let sql = 'SELECT * FROM assets WHERE 1=1';
        const params = [];

        if (q) {
            sql += ' AND (asset_no LIKE ? OR serial_no LIKE ? OR description LIKE ? OR owner LIKE ? OR location LIKE ?)';
            const like = `%${q}%`;
            params.push(like, like, like, like, like);
        }
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        sql += ' ORDER BY updated DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const assets = db.prepare(sql).all(...params);
        res.json({ assets });
    }
);

// --- Get single asset by internal id ---------------------------------------
router.get('/:id(\\d+)', (req, res) => {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset });
});

// --- Create asset (admin) ---------------------------------------------------
router.post(
    '/',
    requireRole('admin'),
    body('assetNo').isString().trim().notEmpty(),
    body('serialNo').optional().isString().trim(),
    body('description').optional().isString().trim(),
    body('owner').optional().isString().trim(),
    body('location').optional().isString().trim(),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const { assetNo, serialNo, description, owner, location } = req.body;
        const guid = uuidv4();

        try {
            const result = db
                .prepare(
                    `INSERT INTO assets (guid, asset_no, serial_no, description, owner, location, status, nfc_tag)
                     VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
                )
                .run(guid, assetNo, serialNo || null, description || null, owner || null, location || null, guid);

            recordHistory({
                assetId: result.lastInsertRowid,
                action: 'create',
                newValue: assetNo,
                username: req.session.user.username,
            });

            const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid);
            res.status(201).json({ asset });
        } catch (err) {
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Asset number already exists' });
            }
            throw err;
        }
    }
);

// --- Update asset (admin) ---------------------------------------------------
router.put(
    '/:id(\\d+)',
    requireRole('admin'),
    body('serialNo').optional().isString().trim(),
    body('description').optional().isString().trim(),
    body('status').optional().isIn(['active', 'missing', 'retired']),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const serialNo = req.body.serialNo ?? asset.serial_no;
        const description = req.body.description ?? asset.description;
        const status = req.body.status ?? asset.status;

        db.prepare(
            `UPDATE assets SET serial_no = ?, description = ?, status = ?, updated = CURRENT_TIMESTAMP
             WHERE id = ?`
        ).run(serialNo, description, status, asset.id);

        if (status !== asset.status) {
            recordHistory({
                assetId: asset.id,
                action: 'update',
                oldValue: asset.status,
                newValue: status,
                username: req.session.user.username,
            });
        }

        const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset.id);
        res.json({ asset: updated });
    }
);

// --- Transfer (owner / location change) -------------------------------------
router.post(
    '/:id(\\d+)/transfer',
    body('newOwner').optional().isString().trim(),
    body('newLocation').optional().isString().trim(),
    body('gps').optional().isString().trim(),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const { newOwner, newLocation, gps } = req.body;
        const finalOwner = newOwner || asset.owner;
        const finalLocation = newLocation || asset.location;

        db.prepare(
            `UPDATE assets SET owner = ?, location = ?, updated = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(finalOwner, finalLocation, asset.id);

        recordHistory({
            assetId: asset.id,
            action: 'transfer',
            oldValue: JSON.stringify({ owner: asset.owner, location: asset.location }),
            newValue: JSON.stringify({ owner: finalOwner, location: finalLocation }),
            username: req.session.user.username,
            gps,
        });

        const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset.id);
        res.json({ asset: updated });
    }
);

// --- Photo upload -------------------------------------------------------------
router.post('/:id(\\d+)/photo', (req, res) => {
    upload.single('photo')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });
        if (!req.file) return res.status(400).json({ error: 'No photo provided' });

        db.prepare('UPDATE assets SET photo_path = ?, updated = CURRENT_TIMESTAMP WHERE id = ?').run(
            req.file.filename,
            asset.id
        );

        recordHistory({
            assetId: asset.id,
            action: 'photo',
            newValue: req.file.filename,
            username: req.session.user.username,
        });

        res.json({ photoPath: req.file.filename });
    });
});

// --- Bulk import (CSV) --------------------------------------------------------
router.post('/import', requireRole('admin'), express.text({ type: '*/*', limit: '2mb' }), (req, res) => {
    let records;
    try {
        records = parse(req.body, { columns: true, skip_empty_lines: true, trim: true });
    } catch (err) {
        return res.status(400).json({ error: 'Invalid CSV data' });
    }

    const insert = db.prepare(
        `INSERT INTO assets (guid, asset_no, serial_no, description, owner, location, status, nfc_tag)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
    );

    let created = 0;
    const errorsList = [];

    db.exec('BEGIN');
    try {
        for (const row of records) {
            const assetNo = row.AssetNo || row.assetNo || row.asset_no;
            if (!assetNo) {
                errorsList.push('Row missing AssetNo, skipped');
                continue;
            }
            const existing = db.prepare('SELECT id FROM assets WHERE asset_no = ?').get(assetNo);
            if (existing) {
                errorsList.push(`${assetNo} already exists, skipped`);
                continue;
            }
            const guid = uuidv4();
            const result = insert.run(
                guid,
                assetNo,
                row.SerialNo || row.serialNo || null,
                row.Description || row.description || null,
                row.Owner || row.owner || null,
                row.Location || row.location || null,
                guid
            );
            recordHistory({
                assetId: result.lastInsertRowid,
                action: 'create',
                newValue: assetNo,
                username: req.session.user.username,
            });
            created += 1;
        }
        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }

    res.json({ created, skipped: errorsList.length, errors: errorsList });
});

module.exports = router;
