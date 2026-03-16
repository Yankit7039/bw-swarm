-- Seed stuck-order template so runtime can submit runs.
-- Idempotent: insert only if not exists.
INSERT INTO templates (template_id, name, image, warm_pool_ref, config, created_at, updated_at)
VALUES (
    'stuck-order-resolution',
    'Stuck Order Resolution',
    'stuck-order-adk:latest',
    'stuck-order-adk-pool',
    '{}',
    (NOW() AT TIME ZONE 'utc'),
    (NOW() AT TIME ZONE 'utc')
)
ON CONFLICT (template_id) DO NOTHING;
