-- Runtime schema: templates, runs, run_events (single Postgres for all templates).
-- Run this against the shared DB (e.g. Docker postgres). No Redis.

-- 1. templates: one row per template; Admin Console will add rows later.
CREATE TABLE IF NOT EXISTS templates (
    template_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    warm_pool_ref TEXT,
    config JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

-- 2. runs: one row per workflow run; all templates use this table.
CREATE TABLE IF NOT EXISTS runs (
    run_id UUID PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES templates(template_id),
    status TEXT NOT NULL,
    payload JSONB NOT NULL,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    completed_at TIMESTAMPTZ,
    assigned_pod TEXT,
    sandbox_claim_name TEXT
);

CREATE INDEX IF NOT EXISTS ix_runs_template_id ON runs(template_id);
CREATE INDEX IF NOT EXISTS ix_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS ix_runs_created_at ON runs(created_at);

-- 3. run_events: live step-by-step UI; same for all templates.
CREATE TABLE IF NOT EXISTS run_events (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_run_events_run_id ON run_events(run_id);
