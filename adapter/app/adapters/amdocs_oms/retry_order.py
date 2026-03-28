from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, RetryResult, ToolMeta


def retry_order(order_id: str) -> dict:
    """OMS: Retrying order

    Submits a retry request for a failed or stuck order in Amdocs OMS.
    Only call after confirming the order is in a retryable error state via
    get_order_status. Do not retry orders that are pending or processing normally.
    """
    s = scenario_for_order_id(order_id)
    if s in (0, 3):
        payload = RetryResult(order_id=order_id, queued=True, message="Retry queued")
    elif s == 4:
        payload = RetryResult(order_id=order_id, queued=True, message="Retry queued (order appears completed)")
    else:
        payload = RetryResult(order_id=order_id, queued=False, message="Retry not applicable for current hold")

    return AdapterResponse(meta=ToolMeta(**tool_meta("amdocs_oms", "retry_order")), data=payload.model_dump()).model_dump()

