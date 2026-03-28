"""SM-DP+ (GSMA eSIM profile server) - rich responses for LLM reasoning."""

from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def check_activation_status(order_id: str) -> dict:
    """SM-DP+: Checking activation status

    Queries the SM-DP+ profile server for the current eSIM activation state.
    Returns profile download attempts, SM-DP+ error codes, LPA readiness, and profile ID.
    Use to determine why an activation is stuck or whether a retry is safe.
    """
    s = scenario_for_order_id(order_id)
    scenarios = [
        {"status": "pending_profile", "profile_id": "PRF-001", "last_event": now_iso(),
         "download_attempts": 3, "smdp_error_code": "E104", "lpa_ready": True,
         "notes": "Profile downloaded to LPA; activation callback not received"},
        {"status": "profile_download_failed", "profile_id": "PRF-002", "last_event": now_iso(),
         "download_attempts": 5, "smdp_error_code": "E105", "lpa_ready": False,
         "notes": "HTTPS timeout during profile download; donor network congestion"},
        {"status": "activated", "profile_id": "PRF-003", "last_event": now_iso(),
         "download_attempts": 1, "smdp_error_code": None, "lpa_ready": True,
         "notes": "Activation complete"},
        {"status": "pending_profile", "profile_id": "PRF-004", "last_event": now_iso(),
         "download_attempts": 0, "smdp_error_code": None, "lpa_ready": None,
         "notes": "Profile prepared; awaiting LPA trigger from device"},
        {"status": "invalid_iccid", "profile_id": None, "last_event": now_iso(),
         "download_attempts": 0, "smdp_error_code": "E201", "lpa_ready": False,
         "notes": "ICCID not found in SM-DP+ inventory; possible provisioning gap"},
    ]
    data = {**scenarios[s % len(scenarios)], "order_id": order_id, "system": "SM-DP+"}
    return AdapterResponse(meta=ToolMeta(**tool_meta("esim_manager", "check_activation_status")), data=data).model_dump()
