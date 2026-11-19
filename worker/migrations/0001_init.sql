-- TiaBete · banco COMERCIAL (Cloudflare D1). Nunca guarda glicemias, insulina ou outros dados de saúde.
CREATE TABLE IF NOT EXISTS accounts (
  sub TEXT PRIMARY KEY,               -- identificador estável do Google (já validado no servidor)
  email TEXT, name TEXT,
  created_at INTEGER NOT NULL,
  trial_started_at INTEGER            -- NULL até o primeiro acesso autenticado; nunca é reescrito
);
CREATE TABLE IF NOT EXISTS licenses (
  sub TEXT PRIMARY KEY,
  status TEXT NOT NULL,               -- active | refunded | revoked
  price_cents INTEGER NOT NULL,       -- preço PAGO (fica congelado; mudar o preço não altera licenças existentes)
  currency TEXT NOT NULL DEFAULT 'BRL',
  order_id TEXT, payment_id TEXT,
  activated_at INTEGER, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, sub TEXT NOT NULL,
  price_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL,               -- pending | paid | failed | refunded
  mp_preference_id TEXT, mp_payment_id TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_sub ON orders(sub);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY, sub TEXT NOT NULL, name TEXT,
  secret_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS devices_sub ON devices(sub);
CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO config(key, value) VALUES ('price_cents', '2990'), ('currency', 'BRL');
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sub TEXT, type TEXT NOT NULL, at INTEGER NOT NULL, data TEXT
);
