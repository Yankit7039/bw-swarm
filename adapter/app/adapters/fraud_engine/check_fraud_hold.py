"""NICE Actimize fraud platform - rich, ambiguous responses for LLM reasoning."""

from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def check_fraud_hold(order_id: str) -> dict:
    """Actimize: Checking fraud hold

    Checks whether an active fraud hold is blocking an eSIM activation order in NICE Actimize.
    Returns hold status, auto_release_eligible flag, risk score, and hold reason.
    Call this first to determine if fraud clearance is needed before attempting activation.
    """
    s = scenario_for_order_id(order_id)
    # Rich, contradictory signals - hold_active but auto_release_eligible; risk_score varies
    scenarios = [
        {"hold_active": True, "hold_reason": "Velocity check tripped", "hold_since": now_iso(),
         "auto_release_eligible": True, "risk_score": 42, "manual_review_pending": False,
         "notes": "L3 review waived; system flagged 3 activations in 24h"},
        {"hold_active": True, "hold_reason": "KYC document mismatch", "hold_since": now_iso(),
         "auto_release_eligible": False, "risk_score": 78, "manual_review_pending": True,
         "notes": "ID country code does not match SIM country"},
        {"hold_active": False, "hold_reason": "", "hold_since": "",
         "auto_release_eligible": True, "risk_score": 15, "manual_review_pending": False,
         "notes": "Clear; previous hold was released 2h ago"},
        {"hold_active": True, "hold_reason": "Unknown device fingerprint", "hold_since": now_iso(),
         "auto_release_eligible": True, "risk_score": 67, "manual_review_pending": False,
         "notes": "Device first seen; low confidence fingerprint"},
        {"hold_active": True, "hold_reason": "Duplicate ICCID across accounts", "hold_since": now_iso(),
         "auto_release_eligible": False, "risk_score": 91, "manual_review_pending": True,
         "notes": "Possible SIM swap fraud indicator"},
    ]
    data = {**scenarios[s % len(scenarios)], "order_id": order_id, "system": "NICE Actimize"}
    return AdapterResponse(meta=ToolMeta(**tool_meta("fraud_engine", "check_fraud_hold")), data=data).model_dump()
