-- Add workflow_yaml column for hybrid templates (nullable; no backfill for existing rows).
ALTER TABLE templates ADD COLUMN IF NOT EXISTS workflow_yaml TEXT;
