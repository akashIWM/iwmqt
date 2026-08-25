-- Append-only order lifecycle log (Order Logs grid, spec 6.2) - PLACED/EXECUTED/CANCELLED,
-- one row per transition, never mutated. Rolling-buffer reads cap via LIMIT, not retention
-- deletes - this table is small enough for a demo that pruning isn't needed yet.
CREATE TABLE IF NOT EXISTS order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    order_type VARCHAR(10) NOT NULL,
    quantity NUMERIC(20, 4) NOT NULL,
    price NUMERIC(20, 4),
    event VARCHAR(20) NOT NULL CHECK (event IN ('PLACED', 'EXECUTED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_events_user_created ON order_events(user_id, created_at DESC);
