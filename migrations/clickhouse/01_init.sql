CREATE TABLE IF NOT EXISTS auth_events (
    event_id UUID DEFAULT generateUUIDv4(),
    event_type String,
    user_id String,
    role String,
    company_id String,
    success UInt8,
    ip_address String,
    user_agent String,
    metadata String,
    created_at DateTime64(3, 'UTC') DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (created_at, event_type, user_id);