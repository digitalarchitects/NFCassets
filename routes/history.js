const express = require('express');
const { param, validationResult } = require('express-validator');
const db = require('../db/db');

const router = express.Router();

router.get('/:assetId(\\d+)', param('assetId').isInt(), (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid asset id' });
    }

    const history = db
        .prepare('SELECT * FROM asset_history WHERE asset_id = ? ORDER BY created DESC')
        .all(req.params.assetId);

    res.json({ history });
});

module.exports = router;
