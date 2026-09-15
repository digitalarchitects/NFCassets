const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { tempDbPath, cleanupDb } = require('./helpers');

function seed(dbPath) {
    process.env.DATABASE_PATH = dbPath;
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-password';
    delete require.cache[require.resolve('../db/db')];
    delete require.cache[require.resolve('../db/seed')];
    require('../db/seed');
}

/**
 * Stub ldapjs so importFromLDAP can run without a real directory server.
 */
function mockLdap(users) {
    const entries = users.map((u) => ({
        objectName: u.dn,
        attributes: Object.entries(u.attrs).map(([type, values]) => ({
            type,
            values: Array.isArray(values) ? values : [values],
        })),
    }));

    const EventEmitter = require('events');
    const res = new EventEmitter();

    const ldap = require('ldapjs');
    ldap.createClient = () => ({
        bind: (_dn, _pw, cb) => cb(),
        search: (_base, _opts, cb) => {
            process.nextTick(() => cb(null, res));
            process.nextTick(() => {
                for (const entry of entries) {
                    res.emit('searchEntry', entry);
                }
                res.emit('end');
            });
        },
        destroy: () => {},
    });
}

async function importUsers(dbPath, users) {
    process.env.DATABASE_PATH = dbPath;
    process.env.LDAP_URL = 'ldap://localhost';
    process.env.LDAP_BASE_DN = 'dc=example,dc=com';
    process.env.LDAP_BIND_DN = 'cn=admin,dc=example,dc=com';
    process.env.LDAP_BIND_PASSWORD = 'secret';
    process.env.LDAP_ATTR_USERNAME = 'cn';
    process.env.LDAP_ATTR_GUID = 'entryUUID';
    delete require.cache[require.resolve('../db/db')];
    delete require.cache[require.resolve('ldapjs')];
    delete require.cache[require.resolve('../lib/ldap')];
    mockLdap(users);
    const { importFromLDAP } = require('../lib/ldap');
    return importFromLDAP();
}

describe('LDAP import async hashing', () => {
    let dbPath;

    before(() => {
        dbPath = tempDbPath();
        seed(dbPath);
    });

    after(() => {
        cleanupDb(dbPath);
    });

    it('creates users without blocking the event loop', async () => {
        const users = [
            {
                dn: 'cn=user1,dc=example,dc=com',
                attrs: { cn: 'user1', entryUUID: 'uuid-1', mail: 'u1@example.com' },
            },
            {
                dn: 'cn=user2,dc=example,dc=com',
                attrs: { cn: 'user2', entryUUID: 'uuid-2', mail: 'u2@example.com' },
            },
        ];

        const result = await importUsers(dbPath, users);
        assert.strictEqual(result.usersCreated, 2);

        const db = require('../db/db');
        const created = db.prepare('SELECT * FROM users WHERE ad_guid IS NOT NULL ORDER BY username').all();
        assert.strictEqual(created.length, 2);
        assert.strictEqual(created[0].username, 'user1');
        assert.ok(created[0].password_hash.startsWith('$2'));
    });
});
