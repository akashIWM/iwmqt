-- Exchange-assigned order id (mock - no real exchange connectivity yet), stamped at
-- placement so Order Book can show both the internal id and the exchange-facing one.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_order_id VARCHAR(20);

-- CTCL/NEAT terminal identifiers the GUI spec's Order Book requires per trader. Demo
-- placeholders until real KYC/terminal-mapping data exists - nullable, admin-settable.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pan VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nnf_id VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS neat_id VARCHAR(20);
