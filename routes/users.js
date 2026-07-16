const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');
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

// --- List all users -----------------------------------------------------------
router.get('/', (req, res) => {
    const users = db
        .prepare('SELECT id, username, role, active, created, ad_guid, display_name, email FROM users ORDER BY created DESC')
        .all();
    res.json({ users });
});

// --- Create user --------------------------------------------------------------
router.post(
    '/',
    body('username').isString().trim().isLength({ min: 1 }).withMessage('Username is required'),
    body('password').isString().isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
    body('role').optional().isIn(['admin', 'user']).withMessage('Role must be admin or user'),
    (req, res) => {
        if (!checkValidation(req, res)) return;

        const { username, password, role } = req.body;
        const finalRole = role || 'user';

        // Case-insensitive uniqueness check
        const existing = db
            .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
            .get(username);
        if (existing) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const passwordHash = bcrypt.hashSync(password, 12);

        try {
            const result = db
                .prepare(
                    'INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, ?, 1)'
                )
                .run(username, passwordHash, finalRole);

            const user = db
                .prepare('SELECT id, username, role, active, created FROM users WHERE id = ?')
                .get(result.lastInsertRowid);

            res.status(201).json({ user });
        } catch (err) {
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Username already exists' });
            }
            throw err;
        }
    }
);

// --- Update user (role, active status) -----------------------------------------
router.put(
    '/:id(\\d+)',
    param('id').isInt(),
    body('role').optional().isIn(['admin', 'user']).withMessage('Role must be admin or user'),
    body('active').optional().isIn([0, 1]).withMessage('Active must be 0 or 1'),
    (req, res) => {
        if (!checkValidation(req, res)) return;

        const userId = parseInt(req.params.id, 10);
        const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentUserId = req.session.user.id;

        // Self-action guard — cannot deactivate or demote yourself
        if (userId === currentUserId) {
            if (req.body.active === 0) {
                return res.status(403).json({ error: 'Cannot deactivate your own account' });
            }
            if (req.body.role && req.body.role !== targetUser.role) {
                return res.status(403).json({ error: 'Cannot change your own role' });
            }
        }

        const newRole = req.body.role || targetUser.role;
        const newActive = req.body.active !== undefined ? req.body.active : targetUser.active;

        // Last-admin guard: if demoting or deactivating an admin, ensure another active admin remains
        if (targetUser.role === 'admin' && targetUser.active === 1) {
            if (newRole !== 'admin' || newActive === 0) {
                const adminCount = db
                    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id != ?")
                    .get(userId).n;
                if (adminCount === 0) {
                    return res.status(403).json({ error: 'Cannot remove the last active admin' });
                }
            }
        }

        db.prepare('UPDATE users SET role = ?, active = ? WHERE id = ?').run(newRole, newActive, userId);

        const updated = db
            .prepare('SELECT id, username, role, active, created FROM users WHERE id = ?')
            .get(userId);

        res.json({ user: updated });
    }
);

// --- Reset user password (admin) -----------------------------------------------
router.put(
    '/:id(\\d+)/password',
    param('id').isInt(),
    body('password').isString().isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
    (req, res) => {
        if (!checkValidation(req, res)) return;

        const userId = parseInt(req.params.id, 10);
        const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const passwordHash = bcrypt.hashSync(req.body.password, 12);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);

        res.json({ ok: true });
    }
);

module.exports = router;
