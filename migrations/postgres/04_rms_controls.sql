-- Order entry is LIMIT-only per spec; table is currently empty so this is safe.
ALTER TABLE orders DROP CONSTRAINT orders_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_type_check CHECK (type = 'LIMIT');
ALTER TABLE orders DROP CONSTRAINT orders_check;
ALTER TABLE orders ADD CONSTRAINT orders_check CHECK (price IS NOT NULL);

ALTER TABLE oms_config
  ADD COLUMN price_band_pct NUMERIC(6, 2) NOT NULL DEFAULT 20,
  ADD COLUMN max_open_order_value NUMERIC(20, 4) NOT NULL DEFAULT 5000000,
  ADD COLUMN max_position_qty NUMERIC(20, 4) NOT NULL DEFAULT 100000,
  ADD COLUMN max_exposure_value NUMERIC(20, 4) NOT NULL DEFAULT 10000000,
  ADD COLUMN global_exposure_value NUMERIC(20, 4) NOT NULL DEFAULT 500000000,
  ADD COLUMN max_turnover_value NUMERIC(20, 4) NOT NULL DEFAULT 50000000,
  ADD COLUMN max_open_orders_count INT NOT NULL DEFAULT 50,
  ADD COLUMN max_orders_per_second INT NOT NULL DEFAULT 120;

ALTER TABLE users ADD COLUMN available_margin NUMERIC(20, 4) NOT NULL DEFAULT 10000000;

CREATE TABLE IF NOT EXISTS security_limits (
    symbol VARCHAR(50) PRIMARY KEY CHECK (symbol = UPPER(symbol)),
    max_qty NUMERIC(20, 4) NOT NULL CHECK (max_qty > 0),
    max_value NUMERIC(20, 4) NOT NULL CHECK (max_value > 0),
    set_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
