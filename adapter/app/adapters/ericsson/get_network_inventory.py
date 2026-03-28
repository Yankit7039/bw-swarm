from __future__ import annotations

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_network_inventory(msisdn: str) -> dict:
    """Network: Getting inventory

    Returns HLR/IMS profile snapshot for an MSISDN. Use when you need device
    or network capability context during investigation.
    """
    return AdapterResponse(
        meta=ToolMeta(**tool_meta("ericsson", "get_network_inventory")),
        data={
            "msisdn": msisdn,
            "inventory": {
                "hlr_profile": "default",
                "ims_enabled": True,
                "volte_enabled": True,
                "last_sync": "2024-01-15T09:55:00Z",
            },
        },
    ).model_dump()

