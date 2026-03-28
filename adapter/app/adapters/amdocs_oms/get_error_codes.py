from __future__ import annotations

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta

ERROR_CODES: dict[str, dict] = {
    "ERR_HLR_7734": {"code": "ERR_HLR_7734", "meaning": "HLR timeout", "action": "Retry HLR query or check HLR availability", "severity": "high"},
    "TIMEOUT_504": {"code": "TIMEOUT_504", "meaning": "BSS gateway timeout", "action": "Trigger provisioning retry", "severity": "high"},
    "ERR_UPSTREAM_503": {"code": "ERR_UPSTREAM_503", "meaning": "Upstream API unavailable", "action": "Wait and retry or escalate", "severity": "medium"},
    "LEDGER_MISMATCH": {"code": "LEDGER_MISMATCH", "meaning": "Billing ledger mismatch", "action": "Run billing reconcile", "severity": "high"},
    "HOLD_FRAUD": {"code": "HOLD_FRAUD", "meaning": "Fraud/port hold on MSISDN", "action": "Release hold after verification", "severity": "medium"},
    "UPSTREAM_UNAVAILABLE": {"code": "UPSTREAM_UNAVAILABLE", "meaning": "External dependency unavailable", "action": "Retry later or escalate", "severity": "medium"},
    "UNKNOWN": {"code": "UNKNOWN", "meaning": "Unknown code", "action": "Check documentation or escalate", "severity": "unknown"},
}


def get_error_codes(code: str) -> dict:
    """OMS: Looking up error code

    Resolves an OMS or gateway error code to meaning, suggested action, and severity.
    Call when logs or status reference an opaque code you need to interpret.
    """
    info = ERROR_CODES.get(code, {"code": code, "meaning": "Unknown code", "action": "Check documentation or escalate", "severity": "unknown"})
    return AdapterResponse(meta=ToolMeta(**tool_meta("amdocs_oms", "get_error_codes")), data=info).model_dump()

