-- Retention for raw ticks: 30 days, then ClickHouse expires them automatically in the
-- background - no cron job, no manual DELETE, no separate retention script needed. Raw
-- ticks are exactly the kind of data that's fine to age out once they're no longer useful
-- for short-term analysis; auth_events (compliance-relevant) deliberately has no TTL here.
ALTER TABLE market_ticks MODIFY TTL tick_time + INTERVAL 30 DAY;
