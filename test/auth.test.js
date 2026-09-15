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

describe('Authentication API', () => {
    let dbPath;

    before(() => {
        dbPath = tempDbPath();
        seed(dbPath);
    });

    after(() => {
        cleanupDb(dbPath);
    });

    it('rejects invalid credentials', async () => {
        const app = createApp(dbPath);
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'wrong-password' })
            .expect(401);
        assert.strictEqual(res.body.error, 'Invalid username or password');
    });

    it('logs in with valid credentials and exposes /api/auth/me', async () => {
        const app = createApp(dbPath);
        const agent = request.agent(app);

        const login = await agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'change-this-password' })
            .expect(200);
        assert.strictEqual(login.body.user.username, 'admin');
        assert.strictEqual(login.body.user.role, 'admin');

        const me = await agent.get('/api/auth/me').expect(200);
        assert.strictEqual(me.body.user.username, 'admin');
    });

    it('destroys the session on logout', async () => {
        const app = createApp(dbPath);
        const agent = request.agent(app);

        await agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'change-this-password' })
            .expect(200);

        await agent.post('/api/auth/logout').expect(200);
        await agent.get('/api/auth/me').expect(401);
    });

    it('protects routes that require authentication', async () => {
        const app = createApp(dbPath);
        const res = await request(app).get('/api/assets').expect(401);
        assert.ok(res.body.error);
    });
});
