"""Simulates NetCracker change management queries for planned and emergency changes."""

from __future__ import annotations

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def _scenario_key(category: str) -> str:
    c = (category or "").strip().lower()
    if c == "transport":
        return "transport"
    if c == "core":
        return "core"
    return "ran"


def get_recent_changes(site_id: str, hours: int = 24, category: str = "RAN") -> dict:
    """
    Fetches recent planned and emergency changes from NetCracker change management for a given site.

    In production this would call NetCracker OSS/BSS APIs; this implementation returns fixed scenarios.
    """
    sid = site_id if isinstance(site_id, str) else ""
    h = hours if isinstance(hours, int) else 24
    branch = _scenario_key(category)

    if branch == "transport":
        payload = {
            "source": "NetCracker",
            "site_id": sid,
            "changes": [
                {
                    "change_id": "CHG-1887",
                    "type": "Routing Configuration Update",
                    "description": "OSPF route redistribution policy updated on core router CR-TR22",
                    "status": "Completed",
                    "engineer": "Mehmet Yilmaz",
                    "timestamp": "2024-03-14T22:15:00Z",
                    "risk_level": "High",
                }
            ],
            "change_count": 1,
        }
    elif branch == "core":
        payload = {
            "source": "NetCracker",
            "site_id": sid,
            "changes": [
                {
                    "change_id": "CHG-3301",
                    "type": "MME Configuration Patch",
                    "description": "Diameter routing agent config patched for load balancing across HSS pool",
                    "status": "Completed",
                    "engineer": "Priya Nair",
                    "timestamp": "2024-03-14T23:45:00Z",
                    "risk_level": "High",
                }
            ],
            "change_count": 1,
        }
    else:
        payload = {
            "source": "NetCracker",
            "site_id": sid,
            "hours_searched": h,
            "changes": [
                {
                    "change_id": "CHG-2241",
                    "type": "Firmware Upgrade",
                    "description": "Baseband unit firmware upgraded from v4.1.8 to v4.2.1 on cluster A4",
                    "status": "Completed",
                    "engineer": "Ravi Shankar",
                    "timestamp": "2024-03-14T20:30:00Z",
                    "risk_level": "Medium",
                }
            ],
            "change_count": 1,
        }

    return AdapterResponse(
        meta=ToolMeta(**tool_meta("netcracker", "get_recent_changes")),
        data=payload,
    ).model_dump()
