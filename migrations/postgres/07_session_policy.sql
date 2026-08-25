-- Single active session per user: login stamps a fresh session id here; authenticate()
-- rejects any request whose JWT carries a stale sid, so an older session dies the moment
-- a newer login (forced or otherwise) overwrites this column.
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_id UUID;
