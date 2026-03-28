from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_account_status(customer_id: str) -> dict:
    """CRM: Getting account status

    Returns high-level account state and risk flags for a customer_id.
    Use after lookup_customer when you need to confirm whether the account is active or flagged.
    """
    s = scenario_for_order_id(customer_id)
    status = "active" if s != 2 else "active_with_flags"
    flags = [] if s != 2 else ["fraud_watchlist_check_required"]
    return AdapterResponse(meta=ToolMeta(**tool_meta("siebel_crm", "get_account_status")), data={"customer_id": customer_id, "status": status, "flags": flags}).model_dump()

