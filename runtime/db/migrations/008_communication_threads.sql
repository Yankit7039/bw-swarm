-- Channel-agnostic thread routing and queued inbound while a pod is busy.

CREATE TABLE IF NOT EXISTS communication_threads (
    channel_thread_id TEXT PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
    template_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_communication_threads_run_id ON communication_threads (run_id);

CREATE TABLE IF NOT EXISTS pending_inbound_interactions (
    id BIGSERIAL PRIMARY KEY,
    channel_thread_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_pending_inbound_thread_unprocessed
    ON pending_inbound_interactions (channel_thread_id)
    WHERE processed = false;
