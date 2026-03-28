"""NICE Actimize KYC module - rich, ambiguous responses for LLM reasoning."""

from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def check_kyc_status(order_id: str) -> dict:
    """Actimize: Checking KYC status

    Retrieves the current KYC verification state for an order from NICE Actimize.
    Returns liveness check result, document retry count, face-match score, and overall kyc_state.
    Use to determine if a KYC retry is appropriate after a failed activation.
    """
    s = scenario_for_order_id(order_id)
    scenarios = [
        {"liveness_passed": True, "kyc_state": "pending_document", "last_attempt": now_iso(),
         "document_retry_count": 2, "face_match_score": 0.89, "expiry_verified": False,
         "notes": "Liveness OK; DOB doc blurry on upload"},
        {"liveness_passed": False, "kyc_state": "failed_liveness", "last_attempt": now_iso(),
         "document_retry_count": 0, "face_match_score": 0.34, "expiry_verified": None,
         "notes": "Liveness timeout; lighting conditions flagged"},
        {"liveness_passed": True, "kyc_state": "verified", "last_attempt": now_iso(),
         "document_retry_count": 0, "face_match_score": 0.95, "expiry_verified": True,
         "notes": "Full verification complete"},
        {"liveness_passed": True, "kyc_state": "under_review", "last_attempt": now_iso(),
         "document_retry_count": 1, "face_match_score": 0.72, "expiry_verified": True,
         "notes": "Manual review queue; AML check in progress"},
        {"liveness_passed": None, "kyc_state": "not_started", "last_attempt": "",
         "document_retry_count": 0, "face_match_score": None, "expiry_verified": None,
         "notes": "KYC not yet initiated for this order"},
    ]
    data = {**scenarios[s % len(scenarios)], "order_id": order_id, "system": "NICE Actimize"}
    return AdapterResponse(meta=ToolMeta(**tool_meta("fraud_engine", "check_kyc_status")), data=data).model_dump()
