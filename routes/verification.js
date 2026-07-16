const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db/db');

const router = express.Router();

function checkValidation(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg });
        return false;
    }
    return true;
}

// Record a "present" verification scan for an asset (annual audit / location check).
router.post(
    '/',
    body('assetId').isInt(),
    body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
    body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
    (req, res) => {
        if (!checkValidation(req, res)) return;

        const { assetId, latitude, longitude } = req.body;
        const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const username = req.session.user.username;

        const result = db
            .prepare(
                'INSERT INTO verification (asset_id, username, latitude, longitude) VALUES (?, ?, ?, ?)'
            )
            .run(assetId, username, latitude ?? null, longitude ?? null);

        db.prepare(
            `INSERT INTO asset_history (asset_id, action, new_value, username, gps)
             VALUES (?, 'verify', 'present', ?, ?)`
        ).run(assetId, username, latitude != null ? `${latitude},${longitude}` : null);

        const verification = db.prepare('SELECT * FROM verification WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ verification });
    }
);

router.get('/:assetId(\\d+)', param('assetId').isInt(), (req, res) => {
    if (!checkValidation(req, res)) return;
    const verifications = db
        .prepare('SELECT * FROM verification WHERE asset_id = ? ORDER BY created DESC')
        .all(req.params.assetId);
    res.json({ verifications });
});

module.exports = router;
