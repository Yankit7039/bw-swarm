from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_service_requests(customer_id: str, limit: int = 10) -> dict:
    """CRM: Getting service requests

    Lists recent service requests/tickets for a customer. Use for context on open
    incidents or recurring issues related to the order.
    """
    s = scenario_for_order_id(customer_id)
    requests = [
        {"sr_id": "SR-10001", "type": "billing_question", "status": "closed", "created_at": "2024-01-10T12:00:00Z"},
        {"sr_id": "SR-10002", "type": "activation_delay", "status": "open" if s in (0, 3) else "closed", "created_at": "2024-01-15T09:10:00Z"},
        {"sr_id": "SR-10003", "type": "port_in_status", "status": "open" if s == 2 else "closed", "created_at": "2024-01-15T08:05:00Z"},
    ][: max(1, min(limit, 10))]
    return AdapterResponse(meta=ToolMeta(**tool_meta("siebel_crm", "get_service_requests")), data={"customer_id": customer_id, "requests": requests, "count": len(requests)}).model_dump()

