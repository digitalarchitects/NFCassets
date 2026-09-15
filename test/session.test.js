const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { tempDbPath, cleanupDb } = require('./helpers');

// Seed script uses the same DATABASE_PATH env var when required.
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

describe('Session persistence', () => {
    let dbPath;

    before(() => {
        dbPath = tempDbPath();
        seed(dbPath);
    });

    after(() => {
        cleanupDb(dbPath);
    });

    it('should keep a user logged in after the app restarts', async () => {
        const agent = request.agent(createApp(dbPath));

        const login = await agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'change-this-password' })
            .expect(200);
        assert.strictEqual(login.body.user.username, 'admin');

        const meBefore = await agent.get('/api/auth/me').expect(200);
        assert.strictEqual(meBefore.body.user.username, 'admin');

        // Simulate restart: require a fresh app instance backed by the same DB.
        const restartedApp = createApp(dbPath);
        const agentAfterRestart = request.agent(restartedApp);
        // Carry the session cookie from the original login response.
        const setCookie = login.headers['set-cookie'];
        assert.ok(setCookie && setCookie.length > 0, 'expected a session cookie after login');
        agentAfterRestart.set('Cookie', setCookie);

        const meAfter = await agentAfterRestart.get('/api/auth/me').expect(200);
        assert.strictEqual(meAfter.body.user.username, 'admin');

        const logout = await agentAfterRestart.post('/api/auth/logout').expect(200);
        assert.strictEqual(logout.body.ok, true);
        await agentAfterRestart.get('/api/auth/me').expect(401);
    });
});
