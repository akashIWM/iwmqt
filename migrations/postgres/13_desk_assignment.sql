-- Desk model: which PM oversees which traders. Deliberately just one column on users
-- rather than a separate desks table - a desk here is nothing more than "the traders
-- assigned to this PM," and that's a fact about the trader, not an entity with its own
-- identity worth modeling separately.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pm_user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_pm_user_id ON users(pm_user_id) WHERE pm_user_id IS NOT NULL;
