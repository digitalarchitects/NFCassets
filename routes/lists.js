const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes admin-only
router.use(requireRole('admin'));

function checkValidation(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg });
        return false;
    }
    return true;
}

// ─── Locations ────────────────────────────────────────────────────────────────

router.get('/locations', (req, res) => {
    const locations = db.prepare('SELECT id, name, active, created FROM locations ORDER BY name').all();
    res.json({ locations });
});

router.post(
    '/locations',
    body('name').isString().trim().isLength({ min: 1 }).withMessage('Location name is required'),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const name = req.body.name.trim();
        const existing = db.prepare('SELECT id FROM locations WHERE LOWER(name) = LOWER(?)').get(name);
        if (existing) return res.status(409).json({ error: 'Location already exists' });

        const result = db.prepare('INSERT INTO locations (name) VALUES (?)').run(name);
        const location = db.prepare('SELECT id, name, active, created FROM locations WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ location });
    }
);

router.put(
    '/locations/:id(\\d+)',
    param('id').isInt(),
    body('name').optional().isString().trim().isLength({ min: 1 }),
    body('active').optional().isIn([0, 1]),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
        if (!loc) return res.status(404).json({ error: 'Location not found' });

        if (req.body.name) {
            const dup = db.prepare('SELECT id FROM locations WHERE LOWER(name) = LOWER(?) AND id != ?').get(req.body.name.trim(), loc.id);
            if (dup) return res.status(409).json({ error: 'Location already exists' });
        }

        const name = req.body.name ? req.body.name.trim() : loc.name;
        const active = req.body.active !== undefined ? req.body.active : loc.active;

        db.prepare('UPDATE locations SET name = ?, active = ? WHERE id = ?').run(name, active, loc.id);
        const updated = db.prepare('SELECT id, name, active, created FROM locations WHERE id = ?').get(loc.id);
        res.json({ location: updated });
    }
);

// ─── Makes ────────────────────────────────────────────────────────────────────

router.get('/makes', (req, res) => {
    const makes = db.prepare('SELECT id, name, active, created FROM makes ORDER BY name').all();
    const models = db.prepare('SELECT id, make_id, name, active, created FROM models ORDER BY name').all();

    const makesWithModels = makes.map(m => ({
        ...m,
        models: models.filter(mo => mo.make_id === m.id)
    }));
    res.json({ makes: makesWithModels });
});

router.post(
    '/makes',
    body('name').isString().trim().isLength({ min: 1 }).withMessage('Make name is required'),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const name = req.body.name.trim();
        const existing = db.prepare('SELECT id FROM makes WHERE LOWER(name) = LOWER(?)').get(name);
        if (existing) return res.status(409).json({ error: 'Make already exists' });

        const result = db.prepare('INSERT INTO makes (name) VALUES (?)').run(name);
        const make = db.prepare('SELECT id, name, active, created FROM makes WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ make: { ...make, models: [] } });
    }
);

router.put(
    '/makes/:id(\\d+)',
    param('id').isInt(),
    body('name').optional().isString().trim().isLength({ min: 1 }),
    body('active').optional().isIn([0, 1]),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const make = db.prepare('SELECT * FROM makes WHERE id = ?').get(req.params.id);
        if (!make) return res.status(404).json({ error: 'Make not found' });

        if (req.body.name) {
            const dup = db.prepare('SELECT id FROM makes WHERE LOWER(name) = LOWER(?) AND id != ?').get(req.body.name.trim(), make.id);
            if (dup) return res.status(409).json({ error: 'Make already exists' });
        }

        const name = req.body.name ? req.body.name.trim() : make.name;
        const active = req.body.active !== undefined ? req.body.active : make.active;

        db.prepare('UPDATE makes SET name = ?, active = ? WHERE id = ?').run(name, active, make.id);
        const updated = db.prepare('SELECT id, name, active, created FROM makes WHERE id = ?').get(make.id);
        res.json({ make: { ...updated, models: [] } });
    }
);

// ─── Models ───────────────────────────────────────────────────────────────────

router.get(
    '/models',
    query('make_id').optional().isInt(),
    (req, res) => {
        const makeId = req.query.make_id ? parseInt(req.query.make_id, 10) : null;
        let models;
        if (makeId) {
            models = db.prepare('SELECT id, make_id, name, active, created FROM models WHERE make_id = ? ORDER BY name').all(makeId);
        } else {
            models = db.prepare('SELECT id, make_id, name, active, created FROM models ORDER BY make_id, name').all();
        }
        res.json({ models });
    }
);

router.post(
    '/models',
    body('make_id').isInt().withMessage('Make ID is required'),
    body('name').isString().trim().isLength({ min: 1 }).withMessage('Model name is required'),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const makeId = req.body.make_id;
        const name = req.body.name.trim();

        const make = db.prepare('SELECT id FROM makes WHERE id = ?').get(makeId);
        if (!make) return res.status(404).json({ error: 'Make not found' });

        const existing = db.prepare('SELECT id FROM models WHERE make_id = ? AND LOWER(name) = LOWER(?)').get(makeId, name);
        if (existing) return res.status(409).json({ error: 'Model already exists for this make' });

        const result = db.prepare('INSERT INTO models (make_id, name) VALUES (?, ?)').run(makeId, name);
        const model = db.prepare('SELECT id, make_id, name, active, created FROM models WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ model });
    }
);

router.put(
    '/models/:id(\\d+)',
    param('id').isInt(),
    body('name').optional().isString().trim().isLength({ min: 1 }),
    body('active').optional().isIn([0, 1]),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const model = db.prepare('SELECT * FROM models WHERE id = ?').get(req.params.id);
        if (!model) return res.status(404).json({ error: 'Model not found' });

        if (req.body.name) {
            const dup = db.prepare('SELECT id FROM models WHERE make_id = ? AND LOWER(name) = LOWER(?) AND id != ?').get(model.make_id, req.body.name.trim(), model.id);
            if (dup) return res.status(409).json({ error: 'Model already exists for this make' });
        }

        const name = req.body.name ? req.body.name.trim() : model.name;
        const active = req.body.active !== undefined ? req.body.active : model.active;

        db.prepare('UPDATE models SET name = ?, active = ? WHERE id = ?').run(name, active, model.id);
        const updated = db.prepare('SELECT id, make_id, name, active, created FROM models WHERE id = ?').get(model.id);
        res.json({ model: updated });
    }
);

// ─── Categories ───────────────────────────────────────────────────────────────

router.get('/categories', (req, res) => {
    const categories = db.prepare('SELECT id, name, active, created FROM categories ORDER BY name').all();
    res.json({ categories });
});

router.post(
    '/categories',
    body('name').isString().trim().isLength({ min: 1 }).withMessage('Category name is required'),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const name = req.body.name.trim();
        const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(name);
        if (existing) return res.status(409).json({ error: 'Category already exists' });

        const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
        const category = db.prepare('SELECT id, name, active, created FROM categories WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ category });
    }
);

router.put(
    '/categories/:id(\\d+)',
    param('id').isInt(),
    body('name').optional().isString().trim().isLength({ min: 1 }),
    body('active').optional().isIn([0, 1]),
    (req, res) => {
        if (!checkValidation(req, res)) return;
        const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
        if (!cat) return res.status(404).json({ error: 'Category not found' });

        if (req.body.name) {
            const dup = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?').get(req.body.name.trim(), cat.id);
            if (dup) return res.status(409).json({ error: 'Category already exists' });
        }

        const name = req.body.name ? req.body.name.trim() : cat.name;
        const active = req.body.active !== undefined ? req.body.active : cat.active;

        db.prepare('UPDATE categories SET name = ?, active = ? WHERE id = ?').run(name, active, cat.id);
        const updated = db.prepare('SELECT id, name, active, created FROM categories WHERE id = ?').get(cat.id);
        res.json({ category: updated });
    }
);

// ─── Convenience: all lists for form dropdowns ────────────────────────────────

router.get('/all', (req, res) => {
    const locations = db.prepare('SELECT id, name FROM locations WHERE active = 1 ORDER BY name').all();
    const makes = db.prepare('SELECT id, name FROM makes WHERE active = 1 ORDER BY name').all();
    const models = db.prepare(
        `SELECT m.id, m.make_id, m.name FROM models m
         JOIN makes mk ON m.make_id = mk.id
         WHERE m.active = 1 AND mk.active = 1
         ORDER BY mk.name, m.name`
    ).all();
    const categories = db.prepare('SELECT id, name FROM categories WHERE active = 1 ORDER BY name').all();

    res.json({ locations, makes, models, categories });
});

module.exports = router;
