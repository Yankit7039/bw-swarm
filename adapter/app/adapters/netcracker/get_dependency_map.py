from __future__ import annotations

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_dependency_map(order_id: str) -> dict:
    """Provisioning: Getting dependency map

    Lists system dependencies affecting the order (OMS, network, billing).
    Use to decide which upstream system likely owns the next fix.
    """
    return AdapterResponse(
        meta=ToolMeta(**tool_meta("netcracker", "get_dependency_map")),
        data={
            "order_id": order_id,
            "dependencies": [
                {"system": "amdocs_oms", "dependency": "order_state"},
                {"system": "ericsson", "dependency": "network_activation"},
                {"system": "siebel_crm", "dependency": "billing_clearance"},
            ],
        },
    ).model_dump()

