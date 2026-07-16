// Test LDAP connection and attribute mapping for spec 004
const ldap = require('ldapjs');

const config = {
    url: 'ldap://127.0.0.1:3890',
    bindDn: 'cn=admin,dc=example,dc=com',
    bindPassword: 'admin123',
    baseDn: 'dc=example,dc=com',
};

async function main() {
    const client = ldap.createClient({ url: config.url });

    // Bind
    await new Promise((resolve, reject) => {
        client.bind(config.bindDn, config.bindPassword, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    console.log('Connected and bound to LDAP\n');

    // Search active users (ou=Users only — not Disabled)
    const activeUsers = await new Promise((resolve, reject) => {
        const results = [];
        client.search('ou=Users,dc=example,dc=com', {
            scope: 'sub',
            filter: '(objectClass=inetOrgPerson)',
            attributes: ['cn', 'mail', 'roomNumber', 'entryUUID', 'dn'],
        }, (err, res) => {
            if (err) return reject(err);
            res.on('searchEntry', (entry) => {
                results.push({
                    dn: entry.objectName,
                    cn: entry.attributes[0]?.values?.[0] || '',
                    mail: entry.attributes[1]?.values?.[0] || '',
                    roomNumber: entry.attributes[2]?.values?.[0] || '',
                    entryUUID: entry.attributes[3]?.values?.[0] || '',
                });
            });
            res.on('end', () => resolve(results));
            res.on('error', reject);
        });
    });

    console.log(`Active users (ou=Users): ${activeUsers.length}`);
    for (const u of activeUsers) {
        console.log(`  ${u.cn.padEnd(20)} ${u.mail.padEnd(25)} ${(u.roomNumber || '-').padEnd(20)} entryUUID: ${u.entryUUID}`);
    }

    // Extract unique office locations
    const locations = [...new Set(activeUsers.map(u => u.roomNumber).filter(Boolean))];
    console.log(`\nUnique office locations: ${locations.join(', ')}`);

    // Search disabled users
    const disabledUsers = await new Promise((resolve, reject) => {
        const results = [];
        client.search('ou=Disabled,dc=example,dc=com', {
            scope: 'sub',
            filter: '(objectClass=inetOrgPerson)',
            attributes: ['cn'],
        }, (err, res) => {
            if (err) return reject(err);
            res.on('searchEntry', (entry) => {
                results.push({ cn: entry.attributes[0]?.values?.[0] || '' });
            });
            res.on('end', () => resolve(results));
            res.on('error', reject);
        });
    });
    console.log(`\nDisabled users: ${disabledUsers.length}`);
    for (const u of disabledUsers) {
        console.log(`  ${u.cn}`);
    }

    // Attribute mapping summary
    console.log('\n--- Spec 004 attribute mapping ---');
    console.log(`  cn              → username + displayName`);
    console.log(`  mail            → email`);
    console.log(`  roomNumber      → physicalDeliveryOfficeName → locations table`);
    console.log(`  entryUUID       → objectGUID (immutable link)`);
    console.log(`  Search base:     ou=Users for active, ou=Disabled for inactive`);
    console.log(`  Location import: ${locations.length} unique locations will be created`);

    client.unbind();
}

main().catch(err => {
    console.error('LDAP test failed:', err.message);
    process.exit(1);
});
