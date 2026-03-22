from __future__ import annotations

from app.adapters._mock_scenarios import (
    resolution_bucket_for_order_id,
    scenario_for_order_id,
    tool_meta,
)
from app.models.responses import AdapterResponse, OrderStatus, ToolMeta


def get_order_status(order_id: str, use_resolution_buckets: bool = False) -> dict:
    order_id = (order_id or "").strip() or "ORD-UNK"

    if use_resolution_buckets:
        bucket = resolution_bucket_for_order_id(order_id)
        if bucket == 0:
            status = "COMPLETED"
            stage = "completed"
            code = None
        else:
            status = "stuck_in_provisioning"
            stage = "hlr_provisioning"
            code = "PENDING_REMEDIATION"
    else:
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
    data = {**payload.model_dump(), "system": "Amdocs OMS"}
    return AdapterResponse(meta=ToolMeta(**tool_meta("amdocs_oms", "get_order_status")), data=data).model_dump()
