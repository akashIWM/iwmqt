-- Forces a password change on next login: set true for admin-created accounts (temp
-- password) and admin-initiated credential resets, cleared once the user sets their own.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
