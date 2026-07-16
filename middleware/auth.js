const db = require('../db/db');

function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        // Check if account is still active (FR-011)
        const user = db.prepare('SELECT active FROM users WHERE id = ?').get(req.session.user.id);
        if (!user) {
            req.session.destroy(() => {});
            if (req.originalUrl.startsWith('/api/')) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            return res.redirect('/login.html');
        }
        if (user.active === 0) {
            req.session.destroy(() => {});
            if (req.originalUrl.startsWith('/api/')) {
                return res.status(401).json({ error: 'Account is disabled' });
            }
            return res.redirect('/login.html?reason=disabled');
        }
        return next();
    }
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/login.html');
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (req.session.user.role !== role) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return next();
    };
}

module.exports = { requireAuth, requireRole };
