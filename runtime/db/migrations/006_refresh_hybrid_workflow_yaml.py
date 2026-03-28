"""Re-sync hybrid templates' workflow_yaml from repo files (idempotent upsert).

005 uses ON CONFLICT DO NOTHING, so existing rows never pick up YAML edits. This migration
updates workflow_yaml (and updated_at) every time migrations run, keeping DB in line with disk.
"""
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

TEMPLATES = [
    {
        "template_id": "stuck-order-resolution",
        "name": "Stuck Order Resolution",
        "image": "stuck-order-adk:latest",
        "warm_pool_ref": "stuck-order-adk-pool",
        "yaml_path": "templates/stuck-order-adk/stuck-order-adk.yaml",
    },
    {
        "template_id": "esim-activation-resolution",
        "name": "eSIM Activation Resolution",
        "image": "esim-activation-adk:latest",
        "warm_pool_ref": "esim-activation-adk-pool",
        "yaml_path": "templates/esim-activation-resolution/esim-activation-resolution.yaml",
    },
    {
        "template_id": "number-porting-resolution",
        "name": "Number Porting Resolution",
        "image": "number-porting-adk:latest",
        "warm_pool_ref": "number-porting-adk-pool",
        "yaml_path": "templates/number-porting-resolution/number-porting-resolution.yaml",
    },
    {
        "template_id": "ticket-email-routing",
        "name": "Ticket Email Routing",
        "image": "ticket-email-routing-adk:latest",
        "warm_pool_ref": "ticket-email-routing-adk-pool",
        "yaml_path": "templates/ticket-email-routing/ticket-email-routing.yaml",
    },
    {
        "template_id": "network-ops-l1l2-triage",
        "name": "Network Ops L1/L2 Triage",
        "image": "network-ops-l1l2-triage-adk:latest",
        "warm_pool_ref": "network-ops-l1l2-triage-adk-pool",
        "yaml_path": "templates/network-ops-l1l2-triage/network-ops-l1l2-triage.yaml",
    },
]


async def run(conn: AsyncConnection) -> None:
    migrations_dir = Path(__file__).resolve().parent
    repo_root = migrations_dir.parents[2]

    upsert_sql = text(
        """
        INSERT INTO templates
            (template_id, name, image, warm_pool_ref, config, workflow_yaml, created_at, updated_at)
        VALUES (
            :template_id,
            :name,
            :image,
            :warm_pool_ref,
            '{}'::jsonb,
            :workflow_yaml,
            (NOW() AT TIME ZONE 'utc'),
            (NOW() AT TIME ZONE 'utc')
        )
        ON CONFLICT (template_id) DO UPDATE SET
            workflow_yaml = EXCLUDED.workflow_yaml,
            updated_at = (NOW() AT TIME ZONE 'utc')
        """
    )

    for template in TEMPLATES:
        yaml_path = repo_root / template["yaml_path"]
        yaml_content = yaml_path.read_text(encoding="utf-8")
        await conn.execute(
            upsert_sql,
            {
                "template_id": template["template_id"],
                "name": template["name"],
                "image": template["image"],
                "warm_pool_ref": template["warm_pool_ref"],
                "workflow_yaml": yaml_content,
            },
        )
