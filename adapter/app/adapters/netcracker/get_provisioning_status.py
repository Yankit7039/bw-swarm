from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_provisioning_status(order_id: str) -> dict:
    """Provisioning: Getting status

    Returns downstream provisioning state and blocking reason/code from Netcracker.
    Use to see if the order is failed, blocked, or inconsistent across systems.
    """
    s = scenario_for_order_id(order_id)
    if s == 0:
        status = {"status": "failed", "reason": "timeout", "code": "TIMEOUT_504"}
    elif s == 1:
        status = {"status": "blocked", "reason": "billing_hold", "code": "LEDGER_MISMATCH"}
    elif s == 2:
        status = {"status": "blocked", "reason": "network_hold", "code": "HOLD_FRAUD"}
    elif s == 3:
        status = {"status": "retryable_error", "reason": "upstream_503", "code": "ERR_UPSTREAM_503"}
    else:
        status = {"status": "inconsistent", "reason": "downstream_completed_upstream_pending", "code": "UNKNOWN"}

    return AdapterResponse(meta=ToolMeta(**tool_meta("netcracker", "get_provisioning_status")), data={"order_id": order_id, **status}).model_dump()

