-- Splits two RMS controls that were previously merged into one check each, back into the
-- two distinct controls the GUI spec (Section 8) actually names:
--   Control 1 (Price Check) vs Control 4 (Trade Price Protection) - previously one combined
--   band check using price_band_pct for both. Trade Price Protection is meant to be a
--   tighter "bad trade price" guard closer to LTP than the wider exchange price band, so it
--   gets its own, smaller default percentage.
--   Control 9 (Trading Limit, per-user) vs Control 11 (Turnover Limit) - previously one
--   combined check against max_turnover_value. Turnover Limit becomes a genuine platform-wide
--   cap (sum across all users), the same user-vs-global split oms_config already has for
--   Control 10 (max_exposure_value / global_exposure_value).

ALTER TABLE oms_config ADD COLUMN IF NOT EXISTS bad_trade_price_pct NUMERIC(10,2) NOT NULL DEFAULT 5.00;
ALTER TABLE oms_config ADD COLUMN IF NOT EXISTS global_turnover_value NUMERIC(20,4) NOT NULL DEFAULT 500000000;
