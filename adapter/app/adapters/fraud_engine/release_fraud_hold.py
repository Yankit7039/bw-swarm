"""NICE Actimize - release fraud hold."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def release_fraud_hold(order_id: str) -> dict:
    """Actimize: Releasing fraud hold

    Releases an active fraud hold on an order in NICE Actimize.
    Only call if check_fraud_hold confirms auto_release_eligible is True.
    """
    data = {
        "success": True,
        "released_at": now_iso(),
        "order_id": order_id,
        "system": "NICE Actimize",
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("fraud_engine", "release_fraud_hold")), data=data).model_dump()
