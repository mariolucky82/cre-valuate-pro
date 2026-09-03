const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dbPath = path.join(dataDir, 'data.db');

const db = new Database(dbPath);

// Users: id, email, password, paid (0/1), logoKey, stripeCustomerId, subscriptionId, subscriptionStatus
db.prepare(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  paid INTEGER DEFAULT 0,
  logoKey TEXT,
  stripeCustomerId TEXT,
  subscriptionId TEXT,
  subscriptionStatus TEXT
)`).run();

// Migration helper: add columns if missing (for older DBs)
function ensureColumn(table, column, definition) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!info.find(i => i.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

ensureColumn('users', 'logoKey', 'TEXT');
ensureColumn('users', 'stripeCustomerId', 'TEXT');
ensureColumn('users', 'subscriptionId', 'TEXT');
ensureColumn('users', 'subscriptionStatus', 'TEXT');

function getUserById(id) {
  return db.prepare('SELECT id, email, password, paid, logoKey, stripeCustomerId, subscriptionId, subscriptionStatus FROM users WHERE id = ?').get(id);
}

function getUserByEmail(email) {
  return db.prepare('SELECT id, email, password, paid, logoKey, stripeCustomerId, subscriptionId, subscriptionStatus FROM users WHERE email = ?').get(email);
}

function getUserByStripeCustomerId(stripeCustomerId) {
  return db.prepare('SELECT id, email, password, paid, logoKey, stripeCustomerId, subscriptionId, subscriptionStatus FROM users WHERE stripeCustomerId = ?').get(stripeCustomerId);
}

function createUser(email, password, stripeCustomerId = null) {
  const info = db.prepare('INSERT INTO users (email, password, stripeCustomerId) VALUES (?,?,?)').run(email, password, stripeCustomerId);
  return getUserById(info.lastInsertRowid);
}

function setUserPaid(id, paid) {
  db.prepare('UPDATE users SET paid = ? WHERE id = ?').run(paid ? 1 : 0, id);
}

function setUserLogoKey(id, key) {
  db.prepare('UPDATE users SET logoKey = ? WHERE id = ?').run(key, id);
}

function setUserStripeCustomerId(id, stripeCustomerId) {
  db.prepare('UPDATE users SET stripeCustomerId = ? WHERE id = ?').run(stripeCustomerId, id);
}

function setUserSubscription(id, subscriptionId, subscriptionStatus) {
  db.prepare('UPDATE users SET subscriptionId = ?, subscriptionStatus = ? WHERE id = ?').run(subscriptionId, subscriptionStatus, id);
}

function ensureDemoUser() {
  // Ensure demo user with id=1 exists
  const u = getUserById(1);
  if (!u) {
    createUser('test@example.com', 'password');
  }
}

module.exports = {
  db,
  getUserById,
  getUserByEmail,
  getUserByStripeCustomerId,
  createUser,
  setUserPaid,
  setUserLogoKey,
  setUserStripeCustomerId,
  setUserSubscription,
  ensureDemoUser
};
