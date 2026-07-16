const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../db/db');
const { requireRole } = require('../middleware/auth');
const { testConnection, importFromLDAP, getConfig } = require('../lib/ldap');

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

// ─── LDAP Config ──────────────────────────────────────────────────────────

router.get('/ldap/config', (req, res) => {
    const cfg = getConfig();
    res.json({
        url: cfg.url || '',
        baseDn: cfg.baseDn || '',
        bindDn: cfg.bindDn || '',
        hasPassword: !!cfg.bindPassword,
        attrUsername: cfg.attrUsername,
        attrDisplayName: cfg.attrDisplayName,
        attrEmail: cfg.attrEmail,
        attrOffice: cfg.attrOffice,
        attrGuid: cfg.attrGuid,
    });
});

// ─── Test Connection ──────────────────────────────────────────────────────

router.post(
    '/ldap/test',
    body('url').optional().isString(),
    body('baseDn').optional().isString(),
    body('bindDn').optional().isString(),
    body('password').optional().isString(),
    async (req, res) => {
        if (!checkValidation(req, res)) return;

        const config = {
            url: req.body.url || process.env.LDAP_URL,
            baseDn: req.body.baseDn || process.env.LDAP_BASE_DN,
            bindDn: req.body.bindDn || process.env.LDAP_BIND_DN,
            bindPassword: req.body.password || process.env.LDAP_BIND_PASSWORD,
        };

        if (!config.url || !config.bindPassword) {
            return res.status(400).json({ connected: false, error: 'LDAP URL and bind password are required' });
        }

        try {
            const result = await testConnection(config);
            res.json(result);
        } catch (err) {
            res.json({ connected: false, error: err.message });
        }
    }
);

// ─── Run Import ───────────────────────────────────────────────────────────

router.post('/ldap/import', async (req, res) => {
    try {
        const result = await importFromLDAP();
        if (result.error) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Sync Logs ────────────────────────────────────────────────────────────

router.get('/sync/log', (req, res) => {
    const logs = db.prepare(
        'SELECT id, started, finished, users_created, users_updated, users_disabled, users_missing, errors FROM sync_log ORDER BY id DESC LIMIT 20'
    ).all();
    res.json({ logs });
});

router.get('/sync/log/:id(\\d+)', (req, res) => {
    const log = db.prepare('SELECT * FROM sync_log WHERE id = ?').get(req.params.id);
    if (!log) return res.status(404).json({ error: 'Sync log not found' });

    const issues = db.prepare('SELECT * FROM sync_issues WHERE sync_log_id = ? ORDER BY created DESC').all(log.id);
    res.json({ log, issues });
});

// ─── Sync Issues ──────────────────────────────────────────────────────────

router.get('/sync/issues', (req, res) => {
    // Get unresolved issues from the latest sync log
    const latestLog = db.prepare('SELECT id FROM sync_log ORDER BY id DESC LIMIT 1').get();
    if (!latestLog) return res.json({ issues: [] });

    const issues = db.prepare(
        'SELECT * FROM sync_issues WHERE sync_log_id = ? AND resolved = 0 ORDER BY issue_type, username'
    ).all(latestLog.id);

    res.json({ issues });
});

router.put(
    '/sync/issues/:id(\\d+)',
    param('id').isInt(),
    body('action').isIn(['deactivated', 'ignored', 're_enabled']).withMessage('Action must be deactivated, ignored, or re_enabled'),
    (req, res) => {
        if (!checkValidation(req, res)) return;

        const issue = db.prepare('SELECT * FROM sync_issues WHERE id = ?').get(req.params.id);
        if (!issue) return res.status(404).json({ error: 'Issue not found' });
        if (issue.resolved === 1) return res.status(400).json({ error: 'Issue already resolved' });

        const action = req.body.action;

        if (action === 'deactivated') {
            db.prepare('UPDATE users SET active = 0 WHERE username = ? AND ad_guid IS NOT NULL').run(issue.username);
        } else if (action === 're_enabled') {
            db.prepare('UPDATE users SET active = 1 WHERE username = ?').run(issue.username);
        }

        db.prepare(
            "UPDATE sync_issues SET resolved = 1, resolution = ?, resolved_at = datetime('now', 'localtime') WHERE id = ?"
        ).run(action, issue.id);

        res.json({ resolved: true, action });
    }
);

module.exports = router;
