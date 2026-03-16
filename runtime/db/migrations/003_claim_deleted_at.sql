-- Add claim_deleted_at so reconciler knows which SandboxClaims are already cleaned.
ALTER TABLE runs ADD COLUMN IF NOT EXISTS claim_deleted_at TIMESTAMPTZ;
