-- GLUXO · teste de 14 dias para VISITANTES (uso sem conta Google). Guarda só um identificador ALEATÓRIO de instalação (gerado no app,
-- sem IMEI/serial/MAC), o hash do segredo da instalação e a data de início do teste. Nenhum dado de saúde, nenhum dado pessoal.
-- O início do teste nunca é reescrito para uma data mais nova; ao entrar com Google vale o início MAIS ANTIGO entre instalação e conta.
CREATE TABLE IF NOT EXISTS installs (
  id TEXT PRIMARY KEY,                -- identificador aleatório da instalação (mesmo valor do id do aparelho no app)
  secret_hash TEXT NOT NULL,          -- SHA-256 do segredo aleatório da instalação (o segredo fica só no cofre do app)
  trial_started_at INTEGER NOT NULL,  -- hora do SERVIDOR do primeiro acesso efetivo
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  linked_sub TEXT,                    -- conta Google à qual a instalação foi vinculada (primeiro login), se houver
  linked_at INTEGER
);
CREATE INDEX IF NOT EXISTS installs_sub ON installs(linked_sub);
