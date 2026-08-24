CREATE TABLE IF NOT EXISTS companies (
    code VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_by VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the code already in use by the existing test user so the FK below doesn't orphan it.
INSERT INTO companies (code, name) VALUES ('IWMQT', 'IWM Quant (Default)') ON CONFLICT (code) DO NOTHING;

ALTER TABLE users ADD CONSTRAINT users_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(code) ON DELETE SET NULL;
