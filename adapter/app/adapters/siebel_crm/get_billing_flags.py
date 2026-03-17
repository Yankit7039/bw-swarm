from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_billing_flags(order_id: str) -> dict:
    s = scenario_for_order_id(order_id)
    if s == 1:
        data = {
            "order_id": order_id,
            "holds": [{"type": "BILLING", "reason": "Ledger mismatch", "status": "active"}],
            "ledger": [{"timestamp": "2024-01-15T00:00:00Z", "type": "proration", "amount": 12.50, "currency": "EUR", "status": "mismatch", "code": "LEDGER_MISMATCH"}],
        }
    elif s == 4:
        data = {
            "order_id": order_id,
            "holds": [{"type": "BILLING", "reason": "Pending activation charge", "status": "active"}],
            "ledger": [{"timestamp": "2024-01-15T10:05:00Z", "type": "one_time", "amount": 5.00, "currency": "EUR", "status": "pending"}],
        }
    else:
        data = {"order_id": order_id, "holds": [], "ledger": []}
    return AdapterResponse(meta=ToolMeta(**tool_meta("siebel_crm", "get_billing_flags")), data=data).model_dump()

