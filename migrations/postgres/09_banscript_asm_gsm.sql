-- NSE surveillance stage fields the GUI spec's BanScript screen requires. Optional -
-- an RMS ban doesn't always correspond to an exchange surveillance stage, but often does.
ALTER TABLE banned_scripts ADD COLUMN IF NOT EXISTS asm_stage VARCHAR(20);
ALTER TABLE banned_scripts ADD COLUMN IF NOT EXISTS gsm_stage VARCHAR(20);
