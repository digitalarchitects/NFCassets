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

describe('Asset update audit trail', () => {
    let dbPath;
    let app;
    let agent;
    let assetId;

    before(async () => {
        dbPath = tempDbPath();
        seed(dbPath);
        app = createApp(dbPath);
        agent = request.agent(app);

        await agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'change-this-password' })
            .expect(200);

        const tokenRes = await agent.get('/api/csrf-token').expect(200);
        const csrfToken = tokenRes.body.csrfToken;

        const create = await agent
            .post('/api/assets')
            .set('csrf-token', csrfToken)
            .send({ assetNo: 'AUDIT-001', serialNo: 'SN1', description: 'Before' })
            .expect(201);

        assetId = create.body.asset.id;
    });

    it('records history for each changed field on update', async () => {
        const tokenRes = await agent.get('/api/csrf-token').expect(200);
        const csrfToken = tokenRes.body.csrfToken;

        await agent
            .put(`/api/assets/${assetId}`)
            .set('csrf-token', csrfToken)
            .send({ serialNo: 'SN2', description: 'After' })
            .expect(200);

        const history = await agent.get(`/api/history/${assetId}`).expect(200);
        const updates = history.body.history.filter((h) => h.action && h.action.startsWith('update:'));

        const serialUpdate = updates.find((h) => h.action === 'update:serial_no');
        const descriptionUpdate = updates.find((h) => h.action === 'update:description');

        assert.ok(serialUpdate, 'expected update:serial_no history entry');
        assert.strictEqual(serialUpdate.old_value, 'SN1');
        assert.strictEqual(serialUpdate.new_value, 'SN2');

        assert.ok(descriptionUpdate, 'expected update:description history entry');
        assert.strictEqual(descriptionUpdate.old_value, 'Before');
        assert.strictEqual(descriptionUpdate.new_value, 'After');
    });

    it('does not record history when no fields change', async () => {
        const tokenRes = await agent.get('/api/csrf-token').expect(200);
        const csrfToken = tokenRes.body.csrfToken;

        const before = await agent.get(`/api/history/${assetId}`).expect(200);
        const countBefore = before.body.history.length;

        await agent
            .put(`/api/assets/${assetId}`)
            .set('csrf-token', csrfToken)
            .send({})
            .expect(200);

        const after = await agent.get(`/api/history/${assetId}`).expect(200);
        assert.strictEqual(after.body.history.length, countBefore);
    });

    after(() => {
        cleanupDb(dbPath);
    });
});
