const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { tempDbPath, cleanupDb } = require('./helpers');

function seed(dbPath) {
    process.env.DATABASE_PATH = dbPath;
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-password';
    delete require.cache[require.resolve('../db/db')];
    delete require.cache[require.resolve('../db/seed')];
    require('../db/seed');
}

function createApp(dbPath) {
    process.env.DATABASE_PATH = dbPath;
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-must-be-at-least-32-characters-long';
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-password';
    delete require.cache[require.resolve('../db/db')];
    delete require.cache[require.resolve('../db/sessionStore')];
    delete require.cache[require.resolve('../app')];
    return require('../app');
}

/**
 * This test proves the session store is backed by SQLite and not memory.
 * If the store were in-memory, the second app instance would not see the session.
 */
describe('SQLite session store isolation', () => {
    let dbPath;

    before(() => {
        dbPath = tempDbPath();
        seed(dbPath);
    });

    after(() => {
        cleanupDb(dbPath);
    });

    it('shares sessions between separate app instances using the same database', async () => {
        const appOne = createApp(dbPath);
        const agentOne = request.agent(appOne);

        const login = await agentOne
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'change-this-password' })
            .expect(200);

        const setCookie = login.headers['set-cookie'];
        assert.ok(setCookie && setCookie.length > 0, 'expected a session cookie after login');

        const appTwo = createApp(dbPath);
        const agentTwo = request.agent(appTwo);
        agentTwo.set('Cookie', setCookie);

        const me = await agentTwo.get('/api/auth/me').expect(200);
        assert.strictEqual(me.body.user.username, 'admin');
    });
});
