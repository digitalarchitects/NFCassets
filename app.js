const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const csrfProtection = require('./middleware/csrf');
const SqliteSessionStore = require('./db/sessionStore');
const config = require('./config');

require('./db/db'); // bootstraps schema on boot

const authRoutes = require('./routes/auth');
const assetRoutes = require('./routes/assets');
const historyRoutes = require('./routes/history');
const verificationRoutes = require('./routes/verification');
const userRoutes = require('./routes/users');
const listRoutes = require('./routes/lists');
const adminRoutes = require('./routes/admin');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = config.PORT;
const isProd = config.NODE_ENV === 'production';

// Export the app for testing; only start the server when this file is run directly.
function startServer() {
    app.listen(PORT, () => {
        console.log(`NFC Asset Tracker listening on http://localhost:${PORT}`);

        // Spec 004: Schedule daily LDAP sync if configured
        if (process.env.LDAP_URL && process.env.LDAP_BIND_PASSWORD) {
            const { importFromLDAP } = require('./lib/ldap');
            const syncHour = parseInt(process.env.LDAP_SYNC_HOUR || '3', 10);
            const msPerDay = 24 * 60 * 60 * 1000;

            function scheduleNext() {
                const now = new Date();
                const next = new Date(now);
                next.setHours(syncHour, 0, 0, 0);
                if (next <= now) next.setDate(next.getDate() + 1);
                const delay = next - now;
                console.log(`LDAP sync scheduled for ${next.toISOString()} (in ${Math.round(delay / 60000)} min)`);
                setTimeout(() => {
                    console.log('Running scheduled LDAP sync...');
                    importFromLDAP().then(r => console.log('LDAP sync done:', r)).catch(e => console.error('LDAP sync error:', e));
                    scheduleNext();
                }, delay);
            }
            scheduleNext();
        }
    });
}

app.set('trust proxy', 1);

if (require.main === module) {
    startServer();
}

module.exports = app;

const CDN = 'https://cdn.jsdelivr.net';

app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(
    session({
        store: new SqliteSessionStore(),
        secret: config.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: isProd,
            maxAge: 8 * 60 * 60 * 1000, // 8 hours
        },
    })
);

// Auth routes must mount BEFORE CSRF — login creates the session that CSRF depends on
app.use('/api/auth', authRoutes);

// CSRF protection for all other state-changing requests
app.use('/api', csrfProtection);

// Endpoint to fetch the CSRF token for the current session (used by the SPA and tests)
app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

app.use('/api/assets', requireAuth, assetRoutes);
app.use('/api/history', requireAuth, historyRoutes);
app.use('/api/verification', requireAuth, verificationRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/lists', requireAuth, listRoutes);
app.use('/api/admin', requireAuth, adminRoutes);

app.use('/uploads', requireAuth, express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// JSON error handler (keep stack traces out of responses).
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ error: 'Invalid or missing CSRF token' });
    }
    console.error(err);
    res.status(err.status || 500).json({ error: isProd ? 'Server error' : err.message });
});
