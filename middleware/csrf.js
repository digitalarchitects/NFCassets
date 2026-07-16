const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Minimal synchronizer-token CSRF protection backed by the session, avoiding
// the unmaintained `csurf` package and its vulnerable `cookie` dependency.
function csrfProtection(req, res, next) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }

    req.csrfToken = () => req.session.csrfToken;

    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    const supplied = req.headers['csrf-token'] || req.body?._csrf;
    if (!supplied || supplied !== req.session.csrfToken) {
        const err = new Error('Invalid or missing CSRF token');
        err.code = 'EBADCSRFTOKEN';
        err.status = 403;
        return next(err);
    }

    return next();
}

module.exports = csrfProtection;
