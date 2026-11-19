-- Contestações (chargebacks) na Orders API. Aditiva: não apaga nem altera dados existentes.
-- chargeback_state: NULL | open | lost | won  ·  mp_updated_at: last_updated_date da Order já aplicada (ms), contra notificações antigas.
ALTER TABLE orders ADD COLUMN chargeback_state TEXT;
ALTER TABLE orders ADD COLUMN mp_updated_at INTEGER;
