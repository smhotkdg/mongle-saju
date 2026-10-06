import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';

export const token = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('hex');
export function createStore(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, provider TEXT NOT NULL, subject TEXT NOT NULL, name TEXT NOT NULL, UNIQUE(provider,subject));
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth (hash TEXT PRIMARY KEY, provider TEXT NOT NULL, state TEXT NOT NULL, verifier TEXT NOT NULL, nonce TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS vaults (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), provider TEXT NOT NULL,
      amount INTEGER NOT NULL, status TEXT NOT NULL, result TEXT NOT NULL, report_key TEXT NOT NULL,
      state_hash TEXT NOT NULL, payment_id TEXT, created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS payment_active_report ON payment_orders(user_id,report_key)
      WHERE status IN ('creating','ready','approving','review','paid');`);
  const empty = () => ({ results: [], collection: { owned: [], favorite: null } });
  return {
    close: () => db.close(),
    addPayment(o) { db.prepare('INSERT INTO payment_orders(id,user_id,provider,amount,status,result,report_key,state_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(o.id,o.user_id,o.provider,o.amount,o.status,o.result,o.report_key,o.state_hash,o.created_at); },
    payment(id) { return db.prepare('SELECT * FROM payment_orders WHERE id=?').get(id); },
    paymentOrders(userId) { return db.prepare('SELECT * FROM payment_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(userId); },
    activePayment(userId,key) { return db.prepare("SELECT * FROM payment_orders WHERE user_id=? AND report_key=? AND status IN ('creating','ready','approving','review','paid')").get(userId,key); },
    paidReport(userId,key) { return !!db.prepare("SELECT id FROM payment_orders WHERE user_id=? AND report_key=? AND status='paid'").get(userId,key); },
    updatePayment(id,from,to,paymentId=null) { return db.prepare('UPDATE payment_orders SET status=?,payment_id=COALESCE(?,payment_id) WHERE id=? AND status=?').run(to,paymentId,id,from).changes>0; },
    hasPayments(userId) { return !!db.prepare('SELECT id FROM payment_orders WHERE user_id=? LIMIT 1').get(userId); },
    cleanup() { const now = Date.now(); db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now); db.prepare('DELETE FROM oauth WHERE expires <= ?').run(now); },
    user(provider, subject, name) {
      db.prepare('INSERT INTO users VALUES(?,?,?,?) ON CONFLICT(provider,subject) DO UPDATE SET name=excluded.name').run(randomUUID(), provider, subject, name);
      return db.prepare('SELECT id, provider, name FROM users WHERE provider=? AND subject=?').get(provider, subject);
    },
    startOAuth(provider, state, verifier, nonce) {
      const id = token();
      db.prepare('INSERT INTO oauth VALUES(?,?,?,?,?,?)').run(hash(id), provider, state, verifier, nonce, Date.now()+600000);
      return id;
    },
    consumeOAuth(id) { return db.prepare('DELETE FROM oauth WHERE hash=? RETURNING *').get(hash(id || '')); },
    createSession(userId) {
      const id = token(), csrf = token();
      db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(id), userId, csrf, Date.now()+7*86400000);
      return { id, csrf };
    },
    session(id) { return db.prepare('SELECT u.id,u.provider,u.name,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?').get(hash(id || ''), Date.now()); },
    logout(id) { db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(id || '')); },
    vault(id) { const row = db.prepare('SELECT data,revision FROM vaults WHERE user_id=?').get(id); return { data: row ? JSON.parse(row.data) : empty(), revision: row?.revision || 0 }; },
    save(id, data, revision) {
      db.prepare('INSERT OR IGNORE INTO vaults VALUES(?,?,0)').run(id, JSON.stringify(empty()));
      const result = db.prepare('UPDATE vaults SET data=?,revision=revision+1 WHERE user_id=? AND revision=?').run(JSON.stringify(data), id, revision);
      return result.changes ? revision+1 : null;
    },
    deleteUser(id) { db.prepare('DELETE FROM users WHERE id=?').run(id); },
  };
}
