"""NICE Actimize - trigger KYC retry."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def trigger_kyc_retry(order_id: str) -> dict:
    """Actimize: Triggering KYC retry

    Initiates a new KYC verification attempt for an order in NICE Actimize.
    Use after confirming the previous attempt failed (check_kyc_status) and a retry is warranted.
    """
    data = {
        "retry_initiated": True,
        "retry_id": f"KYC-RETRY-{order_id}-{now_iso()}",
        "order_id": order_id,
        "system": "NICE Actimize",
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("fraud_engine", "trigger_kyc_retry")), data=data).model_dump()
