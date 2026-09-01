-- PM -> RMS Admin approval workflow (GUI spec 2.1: PM "request limit changes to RMS Admin
-- (approval workflow)"). Targets the same global oms_config fields RMS Admin already edits
-- directly (server/src/routes/oms-config.routes.js) - there is no per-trader limit tier in
-- this system, so a request proposes a new platform-wide value, with the requesting PM's
-- reason as context (e.g. "trader X is repeatedly hitting this cap").
CREATE TABLE IF NOT EXISTS limit_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  field_key VARCHAR(50) NOT NULL,
  current_value NUMERIC(20,4) NOT NULL,
  requested_value NUMERIC(20,4) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
  review_note VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_limit_requests_status ON limit_change_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_limit_requests_requested_by ON limit_change_requests (requested_by, created_at DESC);
