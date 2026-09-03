const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dbPath = path.join(dataDir, 'data.db');

const db = new Database(dbPath);

// Users: id, email, password, paid (0/1), logoKey
db.prepare(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  paid INTEGER DEFAULT 0,
  logoKey TEXT
)`).run();

function getUserById(id) {
  return db.prepare('SELECT id, email, password, paid, logoKey FROM users WHERE id = ?').get(id);
}

function getUserByEmail(email) {
  return db.prepare('SELECT id, email, password, paid, logoKey FROM users WHERE email = ?').get(email);
}

function createUser(email, password) {
  const info = db.prepare('INSERT INTO users (email, password) VALUES (?,?)').run(email, password);
  return getUserById(info.lastInsertRowid);
}

function setUserPaid(id, paid) {
  db.prepare('UPDATE users SET paid = ? WHERE id = ?').run(paid ? 1 : 0, id);
}

function setUserLogoKey(id, key) {
  db.prepare('UPDATE users SET logoKey = ? WHERE id = ?').run(key, id);
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
  createUser,
  setUserPaid,
  setUserLogoKey,
  ensureDemoUser
};
