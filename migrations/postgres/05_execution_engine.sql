ALTER TABLE orders ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP WITH TIME ZONE;

-- Matching engine scans PENDING orders per symbol on every market tick.
CREATE INDEX IF NOT EXISTS idx_orders_symbol_pending ON orders(symbol) WHERE status = 'PENDING';
