const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, param, query, validationResult } = require('express-validator');
const { parse } = require('csv-parse/sync');
const db = require('../db/db');
const upload = require('../middleware/upload');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Base asset query with resolved FK names
const ASSET_SELECT = `
    SELECT a.*,
           loc.name AS locationName,
           mk.name AS makeName,
           mo.name AS modelName,
           cat.name AS categoryName
    FROM assets a
    LEFT JOIN locations loc ON a.location_id = loc.id
    LEFT JOIN makes mk ON a.make_id = mk.id
    LEFT JOIN models mo ON a.model_id = mo.id
    LEFT JOIN categories cat ON a.category_id = cat.id
`;

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
        .prepare(`${ASSET_SELECT} WHERE a.guid = ? OR a.asset_no = ?`)
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
    query('locationId').optional().isInt(),
    query('makeId').optional().isInt(),
    query('modelId').optional().isInt(),
    query('categoryId').optional().isInt(),
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const { q, status, locationId, makeId, modelId, categoryId } = req.query;
        const limit = req.query.limit || 100;
        const offset = req.query.offset || 0;

        let sql = `${ASSET_SELECT} WHERE 1=1`;
        const params = [];

        if (q) {
            sql += ' AND (a.asset_no LIKE ? OR a.serial_no LIKE ? OR a.description LIKE ? OR a.owner LIKE ? OR a.location LIKE ?)';
            const like = `%${q}%`;
            params.push(like, like, like, like, like);
        }
        if (status) {
            sql += ' AND a.status = ?';
            params.push(status);
        }
        if (locationId) {
            sql += ' AND a.location_id = ?';
            params.push(locationId);
        }
        if (makeId) {
            sql += ' AND a.make_id = ?';
            params.push(makeId);
        }
        if (modelId) {
            sql += ' AND a.model_id = ?';
            params.push(modelId);
        }
        if (categoryId) {
            sql += ' AND a.category_id = ?';
            params.push(categoryId);
        }
        sql += ' ORDER BY a.updated DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const assets = db.prepare(sql).all(...params);
        res.json({ assets });
    }
);

// --- Get single asset by internal id ---------------------------------------
router.get('/:id(\\d+)', (req, res) => {
    const asset = db.prepare(`${ASSET_SELECT} WHERE a.id = ?`).get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset });
});

// --- Create asset (admin) ---------------------------------------------------
router.post(
    '/',
    requireRole('admin'),
    body('assetNo').isString().trim().notEmpty().withMessage('Asset number is required'),
    body('serialNo').optional().isString().trim(),
    body('description').optional().isString().trim(),
    body('owner').optional().isString().trim(),
    body('location').optional().isString().trim(),
    body('locationId').optional().isInt(),
    body('makeId').optional().isInt(),
    body('modelId').optional().isInt(),
    body('categoryId').optional().isInt(),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const { assetNo, serialNo, description, owner, location, locationId, makeId, modelId, categoryId } = req.body;
        const guid = uuidv4();

        try {
            const result = db
                .prepare(
                    `INSERT INTO assets (guid, asset_no, serial_no, description, owner, location, status, nfc_tag,
                     location_id, make_id, model_id, category_id)
                     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
                )
                .run(guid, assetNo, serialNo || null, description || null, owner || null,
                    location || null, guid,
                    locationId || null, makeId || null, modelId || null, categoryId || null);

            recordHistory({
                assetId: result.lastInsertRowid,
                action: 'create',
                newValue: assetNo,
                username: req.session.user.username,
            });

            const asset = db.prepare(`${ASSET_SELECT} WHERE a.id = ?`).get(result.lastInsertRowid);
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
    body('locationId').optional().isInt(),
    body('makeId').optional().isInt(),
    body('modelId').optional().isInt(),
    body('categoryId').optional().isInt(),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const serialNo = req.body.serialNo ?? asset.serial_no;
        const description = req.body.description ?? asset.description;
        const status = req.body.status ?? asset.status;
        const locationId = req.body.locationId !== undefined ? req.body.locationId : asset.location_id;
        const makeId = req.body.makeId !== undefined ? req.body.makeId : asset.make_id;
        const modelId = req.body.modelId !== undefined ? req.body.modelId : asset.model_id;
        const categoryId = req.body.categoryId !== undefined ? req.body.categoryId : asset.category_id;

        db.prepare(
            `UPDATE assets SET serial_no = ?, description = ?, status = ?,
             location_id = ?, make_id = ?, model_id = ?, category_id = ?,
             updated = CURRENT_TIMESTAMP
             WHERE id = ?`
        ).run(serialNo, description, status, locationId, makeId, modelId, categoryId, asset.id);

        const changes = [
            { field: 'serial_no', oldValue: asset.serial_no, newValue: serialNo },
            { field: 'description', oldValue: asset.description, newValue: description },
            { field: 'status', oldValue: asset.status, newValue: status },
            { field: 'location_id', oldValue: asset.location_id, newValue: locationId },
            { field: 'make_id', oldValue: asset.make_id, newValue: makeId },
            { field: 'model_id', oldValue: asset.model_id, newValue: modelId },
            { field: 'category_id', oldValue: asset.category_id, newValue: categoryId },
        ].filter((change) => String(change.oldValue) !== String(change.newValue));

        for (const change of changes) {
            recordHistory({
                assetId: asset.id,
                action: `update:${change.field}`,
                oldValue: String(change.oldValue ?? ''),
                newValue: String(change.newValue ?? ''),
                username: req.session.user.username,
            });
        }

        const updated = db.prepare(`${ASSET_SELECT} WHERE a.id = ?`).get(asset.id);
        res.json({ asset: updated });
    }
);

// --- Transfer (owner / location change) -------------------------------------
router.post(
    '/:id(\\d+)/transfer',
    body('newOwner').optional().isString().trim(),
    body('newLocation').optional().isString().trim(),
    body('locationId').optional().isInt(),
    body('gps').optional().isString().trim(),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const { newOwner, newLocation, locationId, gps } = req.body;
        const finalOwner = newOwner || asset.owner;
        const finalLocation = newLocation || asset.location;
        const finalLocationId = locationId !== undefined ? locationId : asset.location_id;

        db.prepare(
            `UPDATE assets SET owner = ?, location = ?, location_id = ?, updated = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(finalOwner, finalLocation, finalLocationId, asset.id);

        recordHistory({
            assetId: asset.id,
            action: 'transfer',
            oldValue: JSON.stringify({ owner: asset.owner, location: asset.location }),
            newValue: JSON.stringify({ owner: finalOwner, location: finalLocation }),
            username: req.session.user.username,
            gps,
        });

        const updated = db.prepare(`${ASSET_SELECT} WHERE a.id = ?`).get(asset.id);
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
        `INSERT INTO assets (guid, asset_no, serial_no, description, owner, location, status, nfc_tag, location_id)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    );

    const locationCache = new Map();
    function resolveLocation(name) {
        if (!name) return null;
        const trimmed = name.trim();
        if (locationCache.has(trimmed.toLowerCase())) return locationCache.get(trimmed.toLowerCase());
        let loc = db.prepare('SELECT id FROM locations WHERE LOWER(name) = LOWER(?)').get(trimmed);
        if (!loc) {
            const result = db.prepare('INSERT INTO locations (name) VALUES (?)').run(trimmed);
            loc = { id: result.lastInsertRowid };
        }
        locationCache.set(trimmed.toLowerCase(), loc.id);
        return loc.id;
    }

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
            const locationName = row.Location || row.location || null;
            const locationId = resolveLocation(locationName);

            const result = insert.run(
                guid,
                assetNo,
                row.SerialNo || row.serialNo || null,
                row.Description || row.description || null,
                row.Owner || row.owner || null,
                locationName,
                guid,
                locationId
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
