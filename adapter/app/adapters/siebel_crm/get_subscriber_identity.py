"""Oracle Siebel CRM - subscriber identity for porting (rich data for LLM)."""

from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_subscriber_identity(order_id: str) -> dict:
    s = scenario_for_order_id(order_id)
    scenarios = [
        {"account_number": "ACC-****5678", "dob": "1985-03-15", "name": "Jane Doe",
         "address_verified": True, "id_document_ref": "ID-001", "last_updated": "2024-01-10",
         "notes": "Account from pre-port lookup; DOB may differ from donor records"},
        {"account_number": "ACC-****1234", "dob": "1990-07-22", "name": "John Smith",
         "address_verified": False, "id_document_ref": "ID-002", "last_updated": "2024-01-12",
         "notes": "Address changed 2 weeks ago; not yet propagated to NP database"},
        {"account_number": None, "dob": "1978-11-30", "name": "Alice Brown",
         "address_verified": True, "id_document_ref": None, "last_updated": "2023-12-01",
         "notes": "Legacy account; account_number field empty in Siebel"},
        {"account_number": "ACC-****9999", "dob": "1985-03-14", "name": "Jane Doe",
         "address_verified": True, "id_document_ref": "ID-001", "last_updated": "2024-01-10",
         "notes": "DOB off by one day vs donor; common data entry error"},
        {"account_number": "ACC-****5678", "dob": "1985-03-15", "name": "Jane Doe",
         "address_verified": True, "id_document_ref": "ID-001", "last_updated": "2024-01-10",
         "notes": "LOA signed; awaiting donor validation"},
    ]
    data = {**scenarios[s % len(scenarios)], "order_id": order_id, "system": "Oracle Siebel CRM"}
    return AdapterResponse(meta=ToolMeta(**tool_meta("siebel_crm", "get_subscriber_identity")), data=data).model_dump()
