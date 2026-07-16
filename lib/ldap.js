// LDAP client for AD/OpenLDAP user import (spec 004)
const ldap = require('ldapjs');
const crypto = require('crypto');
const db = require('../db/db');

function getConfig() {
    return {
        url: process.env.LDAP_URL,
        baseDn: process.env.LDAP_BASE_DN,
        bindDn: process.env.LDAP_BIND_DN,
        bindPassword: process.env.LDAP_BIND_PASSWORD,
        attrUsername: process.env.LDAP_ATTR_USERNAME || 'cn',
        attrDisplayName: process.env.LDAP_ATTR_DISPLAY_NAME || 'cn',
        attrEmail: process.env.LDAP_ATTR_EMAIL || 'mail',
        attrOffice: process.env.LDAP_ATTR_OFFICE || 'roomNumber',
        attrGuid: process.env.LDAP_ATTR_GUID || 'entryUUID',
        attrActiveCheck: process.env.LDAP_ATTR_ACTIVE_CHECK || 'description',
    };
}

function ldapConnect(config) {
    return new Promise((resolve, reject) => {
        const client = ldap.createClient({ url: config.url, connectTimeout: 10000 });
        client.bind(config.bindDn, config.bindPassword, (err) => {
            if (err) {
                client.destroy();
                return reject(new Error(`LDAP bind failed: ${err.message}`));
            }
            resolve(client);
        });
    });
}

function ldapSearch(client, baseDn, opts) {
    return new Promise((resolve, reject) => {
        const results = [];
        client.search(baseDn, opts, (err, res) => {
            if (err) return reject(err);
            res.on('searchEntry', (entry) => {
                const obj = { dn: entry.objectName };
                for (const attr of entry.attributes) {
                    const vals = attr.values || [];
                    obj[attr.type] = vals.length === 1 ? vals[0] : vals;
                }
                results.push(obj);
            });
            res.on('end', () => resolve(results));
            res.on('error', reject);
        });
    });
}

async function testConnection(config) {
    const client = await ldapConnect(config);
    try {
        const results = await ldapSearch(client, config.baseDn, {
            scope: 'sub',
            filter: '(objectClass=inetOrgPerson)',
            sizeLimit: 1,
            attributes: ['cn'],
        });
        return { connected: true, userCount: results.length > 0 ? 'users found' : 'no users in base DN' };
    } catch (err) {
        return { connected: false, error: err.message };
    } finally {
        client.destroy();
    }
}

function generateTempPassword() {
    return crypto.randomBytes(8).toString('base64').replace(/[/+=]/g, '').substring(0, 12);
}

function resolveLocation(name) {
    if (!name) return null;
    const trimmed = name.trim();
    let loc = db.prepare('SELECT id FROM locations WHERE LOWER(name) = LOWER(?)').get(trimmed);
    if (!loc) {
        try {
            const result = db.prepare('INSERT INTO locations (name) VALUES (?)').run(trimmed);
            loc = { id: result.lastInsertRowid };
        } catch (e) {
            // Race condition — another import already created it
            loc = db.prepare('SELECT id FROM locations WHERE LOWER(name) = LOWER(?)').get(trimmed);
        }
    }
    return loc ? loc.id : null;
}

async function importFromLDAP() {
    const config = getConfig();
    if (!config.url || !config.bindPassword) {
        return { error: 'LDAP not configured. Set LDAP_URL and LDAP_BIND_PASSWORD.' };
    }

    const logId = db.prepare(
        "INSERT INTO sync_log (started) VALUES (datetime('now', 'localtime'))"
    ).run().lastInsertRowid;

    let created = 0, updated = 0, issuesCreated = 0;
    const errors = [];
    const adGuids = new Set();

    const client = await ldapConnect(config);

    try {
        // 1. Search active users
        const activeFilter = config.attrActiveCheck && config.attrActiveCheck !== 'description'
            ? `(&(objectClass=inetOrgPerson)(!(${config.attrActiveCheck}=disabled)))`
            : '(objectClass=inetOrgPerson)';

        const activeUsers = await ldapSearch(client, config.baseDn, {
            scope: 'sub',
            filter: activeFilter,
            attributes: [config.attrUsername, config.attrDisplayName, config.attrEmail,
                        config.attrOffice, config.attrGuid, config.attrActiveCheck],
            paged: true,
        });

        for (const adUser of activeUsers) {
            const username = String(adUser[config.attrUsername] || '').trim();
            if (!username) continue;

            const guid = String(adUser[config.attrGuid] || adUser.dn || '');
            const displayName = String(adUser[config.attrDisplayName] || username);
            const email = String(adUser[config.attrEmail] || '');
            const office = String(adUser[config.attrOffice] || '');

            adGuids.add(guid);

            const localUser = db.prepare('SELECT * FROM users WHERE ad_guid = ?').get(guid);

            if (localUser) {
                // Update if changed
                if (localUser.display_name !== displayName || localUser.email !== email) {
                    db.prepare('UPDATE users SET display_name = ?, email = ? WHERE id = ?')
                        .run(displayName, email, localUser.id);
                    updated++;
                }
            } else {
                // Check for username conflict with manual user
                const conflict = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND ad_guid IS NULL").get(username);
                if (conflict) {
                    db.prepare(
                        `INSERT INTO sync_issues (sync_log_id, username, issue_type, details)
                         VALUES (?, ?, 'conflict', ?)`
                    ).run(logId, username, JSON.stringify({ adGuid: guid, reason: 'Username matches existing manual user' }));
                    issuesCreated++;
                    continue;
                }

                // Create user
                const password = generateTempPassword();
                const bcrypt = require('bcryptjs');
                const hash = bcrypt.hashSync(password, 12);
                const locationId = resolveLocation(office);

                try {
                    db.prepare(
                        `INSERT INTO users (username, password_hash, role, active, ad_guid, display_name, email)
                         VALUES (?, ?, 'user', 1, ?, ?, ?)`
                    ).run(username, hash, guid, displayName, email);
                    created++;
                } catch (e) {
                    if (e.message && e.message.includes('UNIQUE')) {
                        db.prepare(
                            `INSERT INTO sync_issues (sync_log_id, username, issue_type, details)
                             VALUES (?, ?, 'conflict', ?)`
                        ).run(logId, username, JSON.stringify({ error: e.message }));
                        issuesCreated++;
                    } else {
                        errors.push(`${username}: ${e.message}`);
                    }
                }
            }
        }

        // 2. Detect missing users (local with ad_guid not in AD)
        const localLinked = db.prepare('SELECT id, username, ad_guid FROM users WHERE ad_guid IS NOT NULL').all();
        for (const local of localLinked) {
            if (!adGuids.has(local.ad_guid)) {
                db.prepare(
                    `INSERT INTO sync_issues (sync_log_id, username, issue_type, details)
                     VALUES (?, ?, 'missing_from_ad', ?)`
                ).run(logId, local.username, JSON.stringify({ adGuid: local.ad_guid }));
                issuesCreated++;
            }
        }

        // 3. Detect disabled AD users (if active check attribute is configured)
        if (config.attrActiveCheck && config.attrActiveCheck !== 'description') {
            const disabledFilter = `(&(objectClass=inetOrgPerson)(${config.attrActiveCheck}=disabled))`;
            try {
                const disabledUsers = await ldapSearch(client, config.baseDn, {
                    scope: 'sub',
                    filter: disabledFilter,
                    attributes: [config.attrGuid, config.attrUsername],
                    paged: true,
                });
                for (const du of disabledUsers) {
                    const guid = String(du[config.attrGuid] || du.dn || '');
                    const local = db.prepare('SELECT id, username, active FROM users WHERE ad_guid = ?').get(guid);
                    if (local && local.active === 1) {
                        db.prepare(
                            `INSERT INTO sync_issues (sync_log_id, username, issue_type, details)
                             VALUES (?, ?, 'ad_disabled', ?)`
                        ).run(logId, local.username, JSON.stringify({ adGuid: guid, action: 'AD account disabled' }));
                        issuesCreated++;
                    }
                }
            } catch (e) {
                errors.push(`Disabled user search failed: ${e.message}`);
            }
        }

    } catch (err) {
        errors.push(err.message);
    } finally {
        client.destroy();
    }

    // Update sync log
    db.prepare(
        `UPDATE sync_log SET finished = datetime('now', 'localtime'),
         users_created = ?, users_updated = ?, users_disabled = 0, users_missing = 0, errors = ?
         WHERE id = ?`
    ).run(created, updated, JSON.stringify(errors), logId);

    return {
        syncLogId: logId,
        usersCreated: created,
        usersUpdated: updated,
        issuesCreated,
        errors,
    };
}

module.exports = { testConnection, importFromLDAP, getConfig };
