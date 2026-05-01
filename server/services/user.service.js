/* JSON-file user store. Indexed by email.
 *   data/users.json shape:
 *   { "alice@gmail.com": { email, name, picture, plan, expiresAt, createdAt } }
 *
 * Swap-out path: replace this file with a Mongo / Postgres adapter that
 * exports the same five functions and the rest of the app keeps working.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'users.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '{}');
}
function readAll() {
  ensure();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function writeAll(obj) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

function findByEmail(email) {
  if (!email) return null;
  const all = readAll();
  return all[email] || null;
}

function upsert({ email, name, picture }) {
  if (!email) throw new Error('email required');
  const all = readAll();
  const existing = all[email];
  const now = Date.now();
  const user = {
    email,
    name: name || (existing && existing.name) || email,
    picture: picture || (existing && existing.picture) || null,
    plan: (existing && existing.plan) || 'free',
    expiresAt: (existing && existing.expiresAt) || null,
    createdAt: (existing && existing.createdAt) || now,
    updatedAt: now
  };
  // Auto-downgrade if subscription expired.
  if (user.expiresAt && now > user.expiresAt && user.plan !== 'free') {
    user.plan = 'free';
    user.expiresAt = null;
  }
  all[email] = user;
  writeAll(all);
  return user;
}

function setPlan(email, plan, expiresAt) {
  const all = readAll();
  if (!all[email]) throw new Error('user not found');
  all[email].plan = plan;
  all[email].expiresAt = expiresAt || null;
  all[email].updatedAt = Date.now();
  writeAll(all);
  return all[email];
}

module.exports = { findByEmail, upsert, setPlan };
