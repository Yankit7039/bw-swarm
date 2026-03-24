-- Follow-up scheduling: template state, next fire time, in-progress guard.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS state JSONB;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS followup_due_at TIMESTAMPTZ;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS follow_up_in_progress BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ix_runs_waiting_followup_due
    ON runs (followup_due_at)
    WHERE status = 'waiting_for_followup';
