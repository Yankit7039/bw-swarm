"""Hardcoded department → escalation contact (mock)."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta

_MATRIX: dict[str, dict[str, str]] = {
    "billing": {
        "name": "Billing Operations Lead",
        "email": "deepam.goyal@boringworkflows.ai",
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
        "email": "deepamgoyal77@gmail.com",
    },
}


def lookup(department: str) -> dict:
    key = (department or "").strip().lower().replace(" ", "_")
    row = _MATRIX.get(key) or _MATRIX["_default"]
    data = {
        "department": key or "unknown",
        "name": row["name"],
        "email": row["email"],
        "resolved_at": now_iso(),
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("escalation_matrix", "lookup")), data=data).model_dump()
