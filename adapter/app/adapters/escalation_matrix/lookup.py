"""Hardcoded department → escalation contact (mock)."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta

_MATRIX: dict[str, dict[str, str]] = {
    "billing": {
        "name": "Billing Operations Lead",
        "email": "ashish@boringworkflows.ai",
    },
    "porting": {
        "name": "Porting & LNP Lead",
        "email": "ashishdogradir@gmail.com",
    },
    "network_provisioning": {
        "name": "Network Provisioning Manager",
        "email": "deepam02goyal@gmail.com",
    },
    "field_ops": {
        "name": "Field Operations Coordinator",
        "email": "deepam02deepam@gmail.com",
    },
    "_default": {
        "name": "Service Desk",
        "email": "ashish@boringworkflows.ai",
    },
}


def lookup(department: str) -> dict:
    """Escalation matrix: Looking up contact

    Maps a department key (e.g. billing, porting, network_provisioning, field_ops)
    to the named owner and email for escalations. Normalize department_owner from
    investigation to the closest key before calling.
    """
    key = (department or "").strip().lower().replace(" ", "_")
    row = _MATRIX.get(key) or _MATRIX["_default"]
    data = {
        "department": key or "unknown",
        "name": row["name"],
        "email": row["email"],
        "resolved_at": now_iso(),
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("escalation_matrix", "lookup")), data=data).model_dump()
