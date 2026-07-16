const { Store } = require('express-session');
const db = require('./db');

// Minimal session store backed by node:sqlite, avoiding native-module
// dependencies like connect-sqlite3/sqlite3 which require compilation.
class SqliteSessionStore extends Store {
    constructor() {
        super();
        this.getStmt = db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?');
        this.upsertStmt = db.prepare(
            `INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
             ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`
        );
        this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
        this.clearExpiredStmt = db.prepare('DELETE FROM sessions WHERE expires < ?');
    }

    get(sid, cb) {
        try {
            this.clearExpiredStmt.run(Date.now());
            const row = this.getStmt.get(sid);
            if (!row) return setImmediate(() => cb(null, null));
            return setImmediate(() => cb(null, JSON.parse(row.sess)));
        } catch (err) {
            return setImmediate(() => cb(err));
        }
    }

    set(sid, session, cb) {
        try {
            const maxAge = session.cookie && session.cookie.maxAge ? session.cookie.maxAge : 86400000;
            const expires = Date.now() + maxAge;
            this.upsertStmt.run(sid, JSON.stringify(session), expires);
            setImmediate(() => cb(null));
        } catch (err) {
            setImmediate(() => cb(err));
        }
    }

    destroy(sid, cb) {
        try {
            this.destroyStmt.run(sid);
            setImmediate(() => cb(null));
        } catch (err) {
            setImmediate(() => cb(err));
        }
    }

    touch(sid, session, cb) {
        return this.set(sid, session, cb || (() => { }));
    }
}

module.exports = SqliteSessionStore;
