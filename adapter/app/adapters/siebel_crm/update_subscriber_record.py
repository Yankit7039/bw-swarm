"""Oracle Siebel CRM - update subscriber record for port correction."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def update_subscriber_record(order_id: str, account_number: str = "", dob: str = "") -> dict:
    data = {
        "success": True,
        "order_id": order_id,
        "updated_fields": [f for f in ["account_number", "dob"] if (account_number or dob)],
        "updated_at": now_iso(),
        "system": "Oracle Siebel CRM",
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("siebel_crm", "update_subscriber_record")), data=data).model_dump()
