from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_workflow_state(order_id: str) -> dict:
    s = scenario_for_order_id(order_id)
    if s == 0:
        state = {"workflow": "fulfillment", "state": "RUNNING", "step": "HLR_PROVISION", "last_update": now_iso()}
    elif s == 1:
        state = {"workflow": "fulfillment", "state": "BLOCKED", "step": "BILLING_VALIDATION", "last_update": now_iso()}
    elif s == 2:
        state = {"workflow": "fulfillment", "state": "BLOCKED", "step": "PORT_VERIFICATION", "last_update": now_iso()}
    elif s == 3:
        state = {"workflow": "fulfillment", "state": "RETRYABLE_ERROR", "step": "UPSTREAM_SYNC", "last_update": now_iso()}
    else:
        state = {"workflow": "fulfillment", "state": "INCONSISTENT", "step": "COMPLETED", "last_update": now_iso()}

    return AdapterResponse(meta=ToolMeta(**tool_meta("amdocs_oms", "get_workflow_state")), data={"order_id": order_id, **state}).model_dump()

