"""SM-DP+ (GSMA eSIM profile server) - retry activation."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def retry_activation(order_id: str) -> dict:
    data = {
        "success": True,
        "retry_initiated": True,
        "profile_id": f"PRF-RETRY-{order_id}",
        "order_id": order_id,
        "system": "SM-DP+",
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("esim_manager", "retry_activation")), data=data).model_dump()
