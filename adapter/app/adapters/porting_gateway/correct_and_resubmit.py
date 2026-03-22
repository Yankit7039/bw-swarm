"""Syniverse - correct port data and resubmit."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def correct_and_resubmit(order_id: str) -> dict:
    data = {
        "success": True,
        "new_request_id": f"PORT-{order_id}-{now_iso()}",
        "order_id": order_id,
        "system": "Syniverse",
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("porting_gateway", "correct_and_resubmit")), data=data).model_dump()
