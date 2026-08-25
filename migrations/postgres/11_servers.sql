-- Server/OMS Configuration screen (GUI spec 6.2 + 7.4): one OMS instance per trader, per
-- the source doc - enforced with a UNIQUE constraint on assigned_trader (multiple NULLs
-- are fine in Postgres, only non-null values must be distinct).
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id VARCHAR(50) UNIQUE NOT NULL,
    exchange VARCHAR(20) NOT NULL,
    segment VARCHAR(20) NOT NULL,
    assigned_trader VARCHAR(50) UNIQUE REFERENCES users(user_id) ON DELETE SET NULL,
    ip_port VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
