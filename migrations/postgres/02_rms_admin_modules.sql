CREATE TABLE IF NOT EXISTS kill_switches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope VARCHAR(10) NOT NULL CHECK (scope IN ('GLOBAL', 'USER')),
    target_user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
    reason VARCHAR(255),
    activated_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((scope = 'GLOBAL' AND target_user_id IS NULL) OR (scope = 'USER' AND target_user_id IS NOT NULL))
);

-- Presence-based, same idea as banned_scripts: at most one active GLOBAL row,
-- at most one active row per user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_kill_switch_global ON kill_switches(scope) WHERE scope = 'GLOBAL';
CREATE UNIQUE INDEX IF NOT EXISTS idx_kill_switch_user ON kill_switches(target_user_id) WHERE scope = 'USER';

CREATE TABLE IF NOT EXISTS oms_config (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    max_order_quantity NUMERIC(20, 4) NOT NULL DEFAULT 10000,
    max_order_value NUMERIC(20, 4) NOT NULL DEFAULT 5000000,
    updated_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO oms_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    target VARCHAR(100),
    details VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
