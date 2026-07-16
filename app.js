require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const csrfProtection = require('./middleware/csrf');

require('./db/db'); // bootstraps schema on boot
const SqliteSessionStore = require('./db/sessionStore');

const authRoutes = require('./routes/auth');
const assetRoutes = require('./routes/assets');
const historyRoutes = require('./routes/history');
const verificationRoutes = require('./routes/verification');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

const CDN = 'https://cdn.jsdelivr.net';

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", CDN],
                styleSrc: ["'self'", "'unsafe-inline'", CDN],
                fontSrc: ["'self'", CDN],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: ["'self'"],
                mediaSrc: ["'self'", 'blob:'],
                workerSrc: ["'self'", 'blob:'],
            },
        },
    })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(
    session({
        store: new SqliteSessionStore(),
        name: 'nfc.sid',
        secret: process.env.SESSION_SECRET,
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

// CSRF protection for all state-changing requests (session-backed token, no extra deps).
app.use('/api', csrfProtection);

app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

app.use('/api/auth', authRoutes);
app.use('/api/assets', requireAuth, assetRoutes);
app.use('/api/history', requireAuth, historyRoutes);
app.use('/api/verification', requireAuth, verificationRoutes);

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

app.listen(PORT, () => {
    console.log(`NFC Asset Tracker listening on http://localhost:${PORT}`);
});
