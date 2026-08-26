-- Partial fills: an order now tracks how much of it has actually executed, separate
-- from its original requested quantity. PARTIALLY_FILLED means some but not all of the
-- order has filled and the remainder is still live in the book.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS filled_quantity NUMERIC(20, 4) NOT NULL DEFAULT 0;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('PENDING', 'PARTIALLY_FILLED', 'EXECUTED', 'CANCELLED', 'REJECTED'));

-- Fills: one immutable row per actual execution, independent of the parent order's
-- current status. Positions/turnover/P&L should be computed from this table, not from
-- orders.status = 'EXECUTED' - an order cancelled after a partial fill still has a real,
-- permanent fill on record here.
CREATE TABLE IF NOT EXISTS fills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity NUMERIC(20, 4) NOT NULL CHECK (quantity > 0),
    price NUMERIC(20, 4) NOT NULL CHECK (price > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fills_user_symbol ON fills(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_fills_order ON fills(order_id);

ALTER TABLE order_events DROP CONSTRAINT IF EXISTS order_events_event_check;
ALTER TABLE order_events ADD CONSTRAINT order_events_event_check
  CHECK (event IN ('PLACED', 'PARTIALLY_FILLED', 'EXECUTED', 'CANCELLED'));
