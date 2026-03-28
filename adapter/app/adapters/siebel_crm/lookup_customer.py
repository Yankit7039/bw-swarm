from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def lookup_customer(order_id: str, customer_id: str = "") -> dict:
    """CRM: Looking up customer

    Resolves the customer profile for an order (or explicit customer_id) from Siebel CRM:
    name, plan, region, account status, contacts. Use early in enrichment to anchor identity.
    """
    oid = (order_id or "").strip() or "ORD-UNK"
    cid = (customer_id or "").strip() or f"CUST-{oid}"
    s = scenario_for_order_id(oid) % 4
    profiles = [
        {"customer_id": cid, "customer_name": "Acme Telecom", "customer_type": "enterprise", "plan_name": "Enterprise 500", "plan_tier": "premium", "region": "eu-west", "account_status": "active", "billing_cycle": "monthly", "payment_method": "invoice", "contact_email": "ops@acmetelecom.es", "primary_phone": "+34911234567"},
        {"customer_id": cid, "customer_name": "Beta Corp", "customer_type": "smb", "plan_name": "SMB 100", "plan_tier": "business", "region": "eu-west", "account_status": "active", "billing_cycle": "monthly", "payment_method": "direct_debit", "contact_email": "billing@betacorp.es", "primary_phone": "+34912345678"},
        {"customer_id": cid, "customer_name": "Gamma Inc", "customer_type": "smb", "plan_name": "Starter Unlimited", "plan_tier": "standard", "region": "eu-west", "account_status": "active", "billing_cycle": "monthly", "payment_method": "card", "contact_email": "admin@gammainc.pt", "primary_phone": "+351912345678"},
        {"customer_id": cid, "customer_name": "Delta Ltd", "customer_type": "enterprise", "plan_name": "Custom Flex", "plan_tier": "custom", "region": "eu-west", "account_status": "active", "billing_cycle": "monthly", "payment_method": "invoice", "contact_email": "telecom@deltaltd.co.uk", "primary_phone": "+442071234567"},
    ]
    return AdapterResponse(meta=ToolMeta(**tool_meta("siebel_crm", "lookup_customer")), data={"order_id": oid, **profiles[s]}).model_dump()

