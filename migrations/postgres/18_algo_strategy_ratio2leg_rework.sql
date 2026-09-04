-- Reworks the multi-leg builder's schema to match the actual reference dialog (a trading
-- desk's existing "Ratio 2 Leg" ticket) instead of the earlier guess in
-- 17_algo_strategy_ratio_fields.sql: legs are generic and numbered (no fixed Long/Short/Put
-- roles, no leg-level Order Type - that's a strategy-level choice), each leg picks its own
-- Instrument+Symbol+Strike+Opt, and there's a per-leg Bid flag + a manually-entered #STM
-- value instead of a leg ratio/locked-at-%/timer set that doesn't exist on the real ticket.
ALTER TABLE algo_strategy_legs DROP COLUMN IF EXISTS leg_role;
ALTER TABLE algo_strategy_legs DROP COLUMN IF EXISTS order_type;
ALTER TABLE algo_strategy_legs ADD COLUMN IF NOT EXISTS use_live_bid BOOLEAN NOT NULL DEFAULT false;
-- #STM: a manually-typed per-leg number (points/price offset or margin estimate on the
-- trader's prior platform) - stored as entered, no computation depends on it.
ALTER TABLE algo_strategy_legs ADD COLUMN IF NOT EXISTS stm_value NUMERIC(20,4) NOT NULL DEFAULT 0;

ALTER TABLE algo_strategies DROP COLUMN IF EXISTS leg_ratio;
ALTER TABLE algo_strategies DROP COLUMN IF EXISTS locked_at_percent;
ALTER TABLE algo_strategies DROP COLUMN IF EXISTS retry_interval_sec;

-- Master toggle for the per-leg Bid checkboxes (live-price auto-fill) - the reference
-- dialog's top-right "Is Bidding" checkbox.
ALTER TABLE algo_strategies ADD COLUMN IF NOT EXISTS is_bidding BOOLEAN NOT NULL DEFAULT true;
-- "Allow Delivery" from the reference dialog - recorded for reference only, this system has
-- no delivery/intraday product-type distinction yet (see orderPlacement.service.js).
ALTER TABLE algo_strategies ADD COLUMN IF NOT EXISTS allow_delivery BOOLEAN NOT NULL DEFAULT false;
-- Order Type moved here from being (wrongly) a per-leg field - it's one global choice on the
-- reference ticket. Same "recorded, not enforced" caveat as before: validateOrder() only
-- accepts LIMIT platform-wide, so startStrategy() always places LIMIT regardless.
ALTER TABLE algo_strategies ADD COLUMN IF NOT EXISTS order_type_preference VARCHAR(10) NOT NULL DEFAULT 'LIMIT' CHECK (order_type_preference IN ('LIMIT', 'MARKET'));
-- Trade Gear (execution aggressiveness tier) and Short Flag (marks a short-only strategy) -
-- both stored/shown only, same not-yet-enforced pattern as Price Depth/Slippage/etc above.
ALTER TABLE algo_strategies ADD COLUMN IF NOT EXISTS trade_gear INTEGER NOT NULL DEFAULT 0;
ALTER TABLE algo_strategies ADD COLUMN IF NOT EXISTS short_flag INTEGER NOT NULL DEFAULT 0;
-- The reference ticket's Long[Buy]/Short[Sell]/PN(Add)/PN(Mult) block: a manual
-- summary/override panel (SOQ/Qty/Price per row, "on" flag for the two PN rows) that does
-- not feed back into the legs - a free-form bag of UI state, not business logic, so it's one
-- JSONB column rather than a wall of single-purpose ones.
ALTER TABLE algo_strategies ADD COLUMN IF NOT EXISTS qty_price_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
