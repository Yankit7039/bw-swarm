"""SM-DP+ (GSMA eSIM profile server) - retry activation."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def retry_activation(order_id: str) -> dict:
    """SM-DP+: Retrying activation

    Triggers a new eSIM profile activation attempt on the SM-DP+ server.
    Use when the profile is downloaded (lpa_ready=True) but the activation callback was not received.
    """
    data = {
        "success": True,
        "retry_initiated": True,
        "profile_id": f"PRF-RETRY-{order_id}",
        "order_id": order_id,
        "system": "SM-DP+",
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("esim_manager", "retry_activation")), data=data).model_dump()
