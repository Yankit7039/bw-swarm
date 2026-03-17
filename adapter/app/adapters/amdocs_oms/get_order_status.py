from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, OrderStatus, ToolMeta


def get_order_status(order_id: str) -> dict:
    s = scenario_for_order_id(order_id)
    if s == 0:
        status = "stuck_in_provisioning"
        stage = "hlr_provisioning"
        code = "TIMEOUT_504"
    elif s == 1:
        status = "billing_hold"
        stage = "billing_validation"
        code = "LEDGER_MISMATCH"
    elif s == 2:
        status = "network_hold"
        stage = "port_verification"
        code = "HOLD_FRAUD"
    elif s == 3:
        status = "pending_upstream"
        stage = "upstream_sync"
        code = "UPSTREAM_UNAVAILABLE"
    else:
        status = "stuck_in_provisioning"
        stage = "completed"
        code = "UNKNOWN"

    payload = OrderStatus(order_id=order_id, status=status, fulfillment_stage=stage, error_code=code)
    return AdapterResponse(meta=ToolMeta(**tool_meta("amdocs_oms", "get_order_status")), data=payload.model_dump()).model_dump()

