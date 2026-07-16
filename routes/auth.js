const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../db/db');

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again later.' },
});

router.post(
    '/login',
    loginLimiter,
    body('username').isString().trim().notEmpty(),
    body('password').isString().notEmpty(),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const { username, password } = req.body;
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        if (user.active === 0) {
            return res.status(401).json({ error: 'Account is disabled' });
        }

        req.session.user = { id: user.id, username: user.username, role: user.role };
        res.json({ user: req.session.user });
    }
);

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

router.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        const user = db
            .prepare('SELECT id, username, role, active, created FROM users WHERE id = ?')
            .get(req.session.user.id);
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        return res.json({ user });
    }
    return res.status(401).json({ error: 'Not authenticated' });
});

// Self-service password change
router.put(
    '/password',
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    body('newPassword').isString().isLength({ min: 4 }).withMessage('New password must be at least 4 characters'),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { currentPassword, newPassword } = req.body;

        if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hash = bcrypt.hashSync(newPassword, 12);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

        res.json({ ok: true });
    }
);

module.exports = router;
