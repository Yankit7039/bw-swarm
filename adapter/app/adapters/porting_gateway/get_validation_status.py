"""Syniverse porting clearinghouse - rich validation status for LLM reasoning."""

from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_validation_status(order_id: str) -> dict:
    s = scenario_for_order_id(order_id)
    scenarios = [
        {"state": "rejected_donor", "validation_id": f"VAL-{order_id}", "submitted_at": now_iso(),
         "donor_response_code": "DR-404", "port_window_end": "2024-02-01T00:00:00Z", "retry_count": 1,
         "notes": "Donor operator rejected; reason in separate call"},
        {"state": "pending_donor", "validation_id": f"VAL-{order_id}", "submitted_at": now_iso(),
         "donor_response_code": None, "port_window_end": "2024-02-01T00:00:00Z", "retry_count": 0,
         "notes": "Awaiting donor validation; SLA 48h"},
        {"state": "approved", "validation_id": f"VAL-{order_id}", "submitted_at": now_iso(),
         "donor_response_code": "DR-200", "port_window_end": "2024-02-01T00:00:00Z", "retry_count": 0,
         "notes": "Donor approved; port scheduled"},
        {"state": "timeout", "validation_id": f"VAL-{order_id}", "submitted_at": now_iso(),
         "donor_response_code": None, "port_window_end": "2024-01-20T00:00:00Z", "retry_count": 2,
         "notes": "Donor gateway timeout; last attempt 2h ago"},
        {"state": "data_mismatch", "validation_id": f"VAL-{order_id}", "submitted_at": now_iso(),
         "donor_response_code": "DR-422", "port_window_end": "2024-02-01T00:00:00Z", "retry_count": 1,
         "notes": "Account number or DOB mismatch per donor"},
    ]
    data = {**scenarios[s % len(scenarios)], "order_id": order_id, "system": "Syniverse"}
    return AdapterResponse(meta=ToolMeta(**tool_meta("porting_gateway", "get_validation_status")), data=data).model_dump()
