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


def get_correlated_alarms(site_id: str, time_window_hours: int = 6, category: str = "RAN") -> dict:
    """Ericsson OSS: Correlated alarms

    MCP: site_id, time_window_hours, category (RAN / Transport / Core). Mock scenarios keyed by category;
    production would query the OSS FM/correlation engine.
    """
    sid = site_id if isinstance(site_id, str) else ""
    hours = time_window_hours if isinstance(time_window_hours, int) else 6
    branch = _scenario_key(category)

    if branch == "transport":
        payload = {
            "source": "Ericsson OSS",
            "site_id": sid,
            "correlated_alarms": [
                {
                    "alarm_id": "ALM-7741",
                    "element": "MW-Link-TR22-A",
                    "type": "Signal Level Degradation",
                    "severity": "Critical",
                    "timestamp": "2024-03-15T03:05:00Z",
                },
                {
                    "alarm_id": "ALM-7758",
                    "element": "MW-Link-TR22-B",
                    "type": "Packet Loss Threshold Exceeded",
                    "severity": "Major",
                    "timestamp": "2024-03-15T03:09:00Z",
                },
            ],
            "alarm_count": 2,
            "pattern": "Microwave backhaul degradation on redundant links",
        }
    elif branch == "core":
        payload = {
            "source": "Ericsson OSS",
            "site_id": sid,
            "correlated_alarms": [
                {
                    "alarm_id": "ALM-5512",
                    "element": "MME-Pool-3",
                    "type": "Attach Request Failure Spike",
                    "severity": "Critical",
                    "timestamp": "2024-03-15T01:44:00Z",
                },
                {
                    "alarm_id": "ALM-5527",
                    "element": "HSS-Node-2",
                    "type": "Diameter Timeout",
                    "severity": "Major",
                    "timestamp": "2024-03-15T01:51:00Z",
                },
                {
                    "alarm_id": "ALM-5533",
                    "element": "SGW-Cluster-1",
                    "type": "Bearer Establishment Failure",
                    "severity": "Major",
                    "timestamp": "2024-03-15T01:58:00Z",
                },
            ],
            "alarm_count": 3,
            "pattern": "Core signaling chain failure — MME to HSS authentication path",
        }
    else:
        payload = {
            "source": "Ericsson OSS",
            "site_id": sid,
            "time_window_hours": hours,
            "correlated_alarms": [
                {
                    "alarm_id": "ALM-9921",
                    "element": "Cell Sector A4-NE",
                    "type": "RRC Setup Failure",
                    "severity": "Critical",
                    "timestamp": "2024-03-15T02:14:00Z",
                },
                {
                    "alarm_id": "ALM-9934",
                    "element": "Cell Sector A4-NW",
                    "type": "Handover Failure Rate High",
                    "severity": "Major",
                    "timestamp": "2024-03-15T02:18:00Z",
                },
                {
                    "alarm_id": "ALM-9941",
                    "element": "Cell Sector A4-SE",
                    "type": "Uplink Interference Detected",
                    "severity": "Major",
                    "timestamp": "2024-03-15T02:31:00Z",
                },
            ],
            "alarm_count": 3,
            "pattern": "Multi-sector degradation on single site",
        }

    return AdapterResponse(
        meta=ToolMeta(**tool_meta("ericsson_oss", "get_correlated_alarms")),
        data=payload,
    ).model_dump()
