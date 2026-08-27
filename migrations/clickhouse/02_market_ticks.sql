-- Raw tick history. Partitioned by day and ordered by (symbol, tick_time) - the standard
-- shape for a time-series scan pattern (per-symbol range queries, e.g. "give me RELIANCE
-- FUT's ticks for the last hour"), matching the reasoning in the status/roadmap doc for
-- why this lives in ClickHouse and not Postgres.
CREATE TABLE IF NOT EXISTS market_ticks (
    symbol String,
    ltp Float64,
    bid Float64,
    ask Float64,
    volume UInt64,
    change Float64,
    p_change Float64,
    high Float64,
    low Float64,
    seq UInt64,
    tick_time DateTime64(3, 'UTC') DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(tick_time)
ORDER BY (symbol, tick_time);
