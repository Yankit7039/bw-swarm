from __future__ import annotations

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_resource_allocation(order_id: str) -> dict:
    return AdapterResponse(
        meta=ToolMeta(**tool_meta("netcracker", "get_resource_allocation")),
        data={
            "order_id": order_id,
            "resources": [
                {"type": "sim", "status": "reserved", "id": f"SIM-{order_id[-6:] if order_id else '000000'}"},
                {"type": "msisdn", "status": "assigned", "id": f"+346{(order_id or '000')[-3:]}000001"},
            ],
        },
    ).model_dump()

