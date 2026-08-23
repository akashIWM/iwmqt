CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    previous_password_hash VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'COMPANY_ACCOUNT', 'RMS_ADMIN', 'PM', 'TRADER')),
    company_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'SUSPENDED', 'PENDING')),
    failed_login_attempts INT DEFAULT 0,
    locked_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    password_expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '15 days',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS otp_verifications (
    email VARCHAR(255) PRIMARY KEY,
    otp_code VARCHAR(6) NOT NULL,
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL CHECK (symbol = UPPER(symbol)),
    side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    type VARCHAR(10) NOT NULL CHECK (type IN ('MARKET', 'LIMIT')),
    quantity NUMERIC(20, 4) NOT NULL CHECK (quantity > 0),
    price NUMERIC(20, 4) CHECK (price IS NULL OR price > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((type = 'LIMIT' AND price IS NOT NULL) OR (type = 'MARKET' AND price IS NULL))
);

CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS banned_scripts (
    symbol VARCHAR(50) PRIMARY KEY CHECK (symbol = UPPER(symbol)),
    reason VARCHAR(255) NOT NULL,
    banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    banned_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL
);