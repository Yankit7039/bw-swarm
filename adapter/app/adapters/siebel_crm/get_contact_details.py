from __future__ import annotations

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_contact_details(customer_id: str) -> dict:
    """CRM: Getting contact details

    Returns primary and billing contacts for escalation emails or callbacks.
    Use when you need verified contact channels for a customer_id.
    """
    return AdapterResponse(
        meta=ToolMeta(**tool_meta("siebel_crm", "get_contact_details")),
        data={
            "customer_id": customer_id,
            "primary_contact": {"name": "Ops Oncall", "email": "ops-oncall@example.com", "phone": "+34-900-111-000"},
            "billing_contact": {"name": "Billing Team", "email": "billing@example.com", "phone": "+34-900-111-002"},
        },
    ).model_dump()

