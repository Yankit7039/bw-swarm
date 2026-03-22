"""Syniverse - retry port request."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def retry_port_request(order_id: str) -> dict:
    data = {
        "success": True,
        "retry_id": f"RETRY-{order_id}-{now_iso()}",
        "order_id": order_id,
        "system": "Syniverse",
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("porting_gateway", "retry_port_request")), data=data).model_dump()
