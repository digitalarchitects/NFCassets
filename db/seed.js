// Creates the initial admin user from env vars (or safe defaults) if no users exist yet.
// Run with: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD;

if (!password) {
    console.error('ADMIN_PASSWORD is not set. Add it to your .env file before seeding.');
    process.exit(1);
}

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (existing) {
    console.log(`User "${username}" already exists. Skipping seed.`);
    process.exit(0);
}

const hash = bcrypt.hashSync(password, 12);
db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
).run(username, hash, 'admin');

console.log(`Admin user "${username}" created.`);
