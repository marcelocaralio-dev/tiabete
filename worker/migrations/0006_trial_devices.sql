-- GLUXO · registro PERMANENTE de que um aparelho já recebeu o teste gratuito (0.34.0).
-- Guarda só um identificador PSEUDONIMIZADO: HMAC-SHA256 do ANDROID_ID com um segredo que existe apenas no Worker (DEVICE_HMAC_KEY).
-- O ANDROID_ID bruto nunca é gravado, nem em log. Este registro não é apagado quando o usuário limpa dados, reinstala ou restaura backup:
-- ele vive no banco D1 do servidor, fora do aparelho. Sem a conta nem o id da instalação, é ele que reconhece a reinstalação.
CREATE TABLE IF NOT EXISTS trial_devices (
  dev_hash TEXT PRIMARY KEY,             -- HMAC-SHA256 (hex) do ANDROID_ID; nunca o valor bruto
  trial_started_at INTEGER NOT NULL,     -- UTC, hora do servidor; só pode ficar mais antigo, nunca mais novo
  trial_expires_at INTEGER NOT NULL,     -- UTC, = início + 336 h
  trial_granted INTEGER NOT NULL DEFAULT 1,   -- este aparelho já recebeu seu teste
  first_install_id TEXT,                 -- identidade anônima aleatória da primeira instalação
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
