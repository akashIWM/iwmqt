-- Multi-leg algo strategy builder (e.g. a 2-leg ratio spread) - a trader defines N legs
-- (each a real, RMS-checked LIMIT order) plus execution parameters, then starts/stops the
-- strategy as one unit. This is genuinely functional, not a mockup: starting a strategy
-- places every leg through the exact same placeOrderForUser() path a manual order uses
-- (server/src/services/orderPlacement.service.js), so every leg gets the full 14-control
-- gauntlet. The one piece that stays simulated is real order-book depth (Price/Order/Bid
-- Depth below are stored and shown, but there's no real depth ladder to sweep yet - only
-- LTP vs a single bid/ask, same as the rest of this build).
CREATE TABLE IF NOT EXISTS algo_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'STOPPED' CHECK (status IN ('STOPPED', 'RUNNING', 'FAILED')),

  -- Multi-leg coordination
  unhedged_qty_mode VARCHAR(10) NOT NULL DEFAULT 'RATIO' CHECK (unhedged_qty_mode IN ('RATIO', 'NONE')),
  price_execution VARCHAR(20) NOT NULL DEFAULT 'REVERT_ALL_LEGS' CHECK (price_execution IN ('LEAVE_AS_IS', 'REVERT_ALL_LEGS')),
  bid_mode VARCHAR(10) NOT NULL DEFAULT 'NORMAL' CHECK (bid_mode IN ('NORMAL', 'BEST')),
  allow_duplicates BOOLEAN NOT NULL DEFAULT false,
  time_ms INTEGER NOT NULL DEFAULT 500 CHECK (time_ms > 0),

  -- Execution algorithm parameters (stored and surfaced in the UI now; genuinely act on
  -- simulated depth until a real broker depth feed exists - see migration comment above)
  execution_mode VARCHAR(30) NOT NULL DEFAULT 'AGGRESSIVE_SWEEP',
  price_depth INTEGER NOT NULL DEFAULT 1,
  order_depth INTEGER NOT NULL DEFAULT 1,
  allowed_bid_depth INTEGER NOT NULL DEFAULT 0,
  allowed_slippage NUMERIC(10,2) NOT NULL DEFAULT 0,
  market_retries INTEGER NOT NULL DEFAULT 0,
  tick_size NUMERIC(10,4) NOT NULL DEFAULT 0.05,
  threshold_qty NUMERIC(20,4) NOT NULL DEFAULT 0,

  last_run_message VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS algo_strategy_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES algo_strategies(id) ON DELETE CASCADE,
  leg_number INTEGER NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
  lots NUMERIC(20,4) NOT NULL CHECK (lots > 0),
  price NUMERIC(20,4) NOT NULL CHECK (price > 0),
  -- Set only once the strategy is started and this leg's order has actually been placed -
  -- lets the strategy list / detail view show real order status per leg, not just config.
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  UNIQUE (strategy_id, leg_number)
);

CREATE INDEX IF NOT EXISTS idx_algo_strategies_user ON algo_strategies (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_algo_strategy_legs_strategy ON algo_strategy_legs (strategy_id, leg_number);
