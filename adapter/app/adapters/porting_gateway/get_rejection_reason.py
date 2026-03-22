"""Syniverse - donor rejection reason (rich data for LLM)."""

from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_rejection_reason(order_id: str) -> dict:
    s = scenario_for_order_id(order_id)
    scenarios = [
        {"reason": "Account number mismatch", "mismatched_field": "account_number", "rejection_code": "DR-404",
         "donor_account_hint": "Last 4: ****5678", "submitted_account_hint": "Last 4: ****1234", "recoverable": True},
        {"reason": "Date of birth does not match", "mismatched_field": "dob", "rejection_code": "DR-422",
         "donor_account_hint": None, "submitted_account_hint": None, "recoverable": True},
        {"reason": "Letter of authorization invalid", "mismatched_field": "loa_reference", "rejection_code": "DR-401",
         "donor_account_hint": None, "submitted_account_hint": None, "recoverable": False},
        {"reason": "Gateway timeout", "mismatched_field": None, "rejection_code": "DR-504",
         "donor_account_hint": None, "submitted_account_hint": None, "recoverable": True},
        {"reason": "Number not portable", "mismatched_field": "msisdn", "rejection_code": "DR-403",
         "donor_account_hint": None, "submitted_account_hint": None, "recoverable": False},
    ]
    data = {**scenarios[s % len(scenarios)], "order_id": order_id, "system": "Syniverse"}
    return AdapterResponse(meta=ToolMeta(**tool_meta("porting_gateway", "get_rejection_reason")), data=data).model_dump()
