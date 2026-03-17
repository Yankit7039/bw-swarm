from __future__ import annotations

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_inventory_snapshot(order_id: str) -> dict:
    return AdapterResponse(
        meta=ToolMeta(**tool_meta("netcracker", "get_inventory_snapshot")),
        data={
            "order_id": order_id,
            "snapshot": {
                "sim": {"allocated": True, "iccid": "89340765001234567890"},
                "imsi": {"value": "214070000000001"},
                "msisdn": {"value": "+34600000001"},
            },
        },
    ).model_dump()

