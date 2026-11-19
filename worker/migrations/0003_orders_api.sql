-- Migração para Checkout Pro via Orders API (aditiva: não apaga nem altera dados existentes).
-- mp_order_id = id da Order no Mercado Pago (a coluna mp_preference_id continua existindo, só para histórico).
ALTER TABLE orders ADD COLUMN mp_order_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_mp_order ON orders(mp_order_id);
