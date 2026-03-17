from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_activation_logs(order_id: str, hours: int = 24, msisdn: str = "") -> dict:
    s = scenario_for_order_id(order_id)
    m = msisdn.strip() or f"MSISDN-{order_id}"
    if s == 0:
        events = [
            {"timestamp": "2024-01-15T09:56:00Z", "event": "HLR_QUERY_START", "detail": "Querying HLR for MSISDN"},
            {"timestamp": "2024-01-15T09:56:30Z", "event": "HLR_TIMEOUT", "code": "ERR_HLR_7734", "detail": "No response within 30s"},
        ]
    elif s == 2:
        events = [
            {"timestamp": "2024-01-15T08:01:00Z", "event": "NETWORK_HOLD", "hold_id": "HOLD-8821", "detail": "Hold applied"},
            {"timestamp": "2024-01-15T08:01:05Z", "event": "HOLD_ACTIVE", "hold_id": "HOLD-8821", "detail": "Port-in verification"},
        ]
    else:
        events = [{"timestamp": "2024-01-15T11:00:35Z", "event": "UPSTREAM_CALL_FAILED", "code": "ERR_UPSTREAM_503", "detail": "External API 503"}] if s == 3 else []
    return AdapterResponse(meta=ToolMeta(**tool_meta("ericsson", "get_activation_logs")), data={"order_id": order_id, "msisdn": m, "hours": hours, "events": events, "count": len(events)}).model_dump()

