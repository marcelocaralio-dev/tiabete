-- Proteções: notificações já processadas (anti-repetição) e controle de frequência (anti-abuso).
CREATE TABLE IF NOT EXISTS webhook_log (key TEXT PRIMARY KEY, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (k TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_limits_k ON rate_limits(k, at);
