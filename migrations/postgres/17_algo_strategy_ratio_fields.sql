-- Extends the multi-leg algo strategy builder to match the options-strategy-template
-- workflow (Instrument+Expiry picked once, named leg roles like "Long Leg1"/"Put Leg2",
-- a leg quantity ratio, and a couple more execution-mode fields). Same pattern as the
-- existing execution params in 16_algo_strategies.sql: stored and shown, not yet enforced
-- by a real depth/matching engine.
ALTER TABLE algo_strategies ADD COLUMN IF NOT EXISTS template VARCHAR(30) NOT NULL DEFAULT 'CUSTOM';
ALTER TABLE algo_strategies ADD COLUMN IF NOT EXISTS leg_ratio VARCHAR(20) NOT NULL DEFAULT '1:1';
ALTER TABLE algo_strategies ADD COLUMN IF NOT EXISTS locked_at_percent NUMERIC(6,2) NOT NULL DEFAULT 0;
ALTER TABLE algo_strategies ADD COLUMN IF NOT EXISTS retry_interval_sec NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (retry_interval_sec > 0);

-- leg_role labels the leg for display (e.g. LONG_LEG1, SHORT_LEG1, PUT_LEG1, PUT_LEG2) when
-- built from a template; CUSTOM for a free-form leg the trader added themselves.
ALTER TABLE algo_strategy_legs ADD COLUMN IF NOT EXISTS leg_role VARCHAR(20) NOT NULL DEFAULT 'CUSTOM';

-- Recorded for reference only - validateOrder() (server/src/utils/validators.js) hard-rejects
-- anything but LIMIT platform-wide, so startStrategy() always places LIMIT regardless of what
-- a leg has stored here. Kept so the UI can show what the trader picked without silently
-- pretending MARKET is actually being routed that way.
ALTER TABLE algo_strategy_legs ADD COLUMN IF NOT EXISTS order_type VARCHAR(10) NOT NULL DEFAULT 'LIMIT' CHECK (order_type IN ('LIMIT', 'MARKET'));
