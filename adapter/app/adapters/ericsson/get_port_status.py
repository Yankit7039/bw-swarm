from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_port_status(order_id: str, msisdn: str = "") -> dict:
    """Network: Getting port status

    Returns network/port holds and verification state for an order or MSISDN.
    Use when investigating port-in, fraud holds, or upstream sync issues.
    """
    s = scenario_for_order_id(order_id)
    m = msisdn.strip() or f"MSISDN-{order_id}"
    if s == 2:
        data = {"order_id": order_id, "msisdn": m, "hold": True, "hold_id": "HOLD-8821", "hold_type": "PORTING", "detail": "Port-in verification hold"}
    elif s == 0:
        data = {"order_id": order_id, "msisdn": m, "hold": False, "detail": "No network hold; HLR slow responses detected"}
    else:
        data = {"order_id": order_id, "msisdn": m, "hold": s == 3, "hold_type": "UPSTREAM" if s == 3 else None, "detail": "Pending upstream sync" if s == 3 else "No network hold"}
    return AdapterResponse(meta=ToolMeta(**tool_meta("ericsson", "get_port_status")), data=data).model_dump()

