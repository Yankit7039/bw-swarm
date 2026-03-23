"""Mock ticket tied to an order — includes department for escalation routing."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta

# Must match escalation_matrix lookup keys
_DEPARTMENTS = ("billing", "network_provisioning", "field_ops")


def get_ticket_by_order(order_id: str) -> dict:
    oid = (order_id or "").strip() or "ORD-UNK"
    s = scenario_for_order_id(oid)
    department = _DEPARTMENTS[s % len(_DEPARTMENTS)]
    templates = {
        "billing": {
            "ticket_id": f"TKT-BILL-{oid[-8:]}",
            "subject": "Invoice discrepancy",
            "description": "Customer disputes proration on latest bill.",
            "status": "open",
        },
        "network_provisioning": {
            "ticket_id": f"TKT-NET-{oid[-8:]}",
            "subject": "Provisioning delay",
            "description": "SIM profile not provisioned within SLA window.",
            "status": "open",
        },
        "field_ops": {
            "ticket_id": f"TKT-FLD-{oid[-8:]}",
            "subject": "Field visit required",
            "description": "On-site equipment swap requested by NOC.",
            "status": "pending",
        },
    }
    base = templates.get(department, templates["billing"])
    data = {
        "order_id": oid,
        "department": department,
        "ticket_id": base["ticket_id"],
        "subject": base["subject"],
        "description": base["description"],
        "status": base["status"],
        "created_at": now_iso(),
        "system": "Oracle Siebel CRM",
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("siebel_crm", "get_ticket_by_order")), data=data).model_dump()
