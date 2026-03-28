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


def get_similar_incidents(alarm_signature: str, category: str = "RAN") -> dict:
    """ServiceNow KB: Similar incidents

    MCP: alarm_signature, category (RAN / Transport / Core). Mock historical matches;
    production would query CMDB/incident APIs.
    """
    _ = alarm_signature  # accepted for API parity; not echoed in mock payload
    branch = _scenario_key(category)

    if branch == "transport":
        payload = {
            "source": "ServiceNow KB",
            "similar_incidents": [
                {
                    "incident_id": "INC-6634",
                    "title": "Microwave backhaul degradation following OSPF policy change — Region South",
                    "date": "2023-09-18",
                    "root_cause": "OSPF metric reconfiguration caused traffic to prefer a higher-latency path, leading to packet loss on primary MW links",
                    "resolution": "Reverted OSPF route redistribution policy to previous version. Traffic rerouted within 15 minutes.",
                    "resolution_time_minutes": 15,
                    "match_confidence": "High",
                }
            ],
            "incident_count": 1,
        }
    elif branch == "core":
        payload = {
            "source": "ServiceNow KB",
            "similar_incidents": [
                {
                    "incident_id": "INC-7712",
                    "title": "MME attach failure spike following Diameter routing patch — Core Zone 2",
                    "date": "2024-01-09",
                    "root_cause": "Load balancing patch misconfigured HSS pool weights, causing Diameter timeouts on primary authentication path",
                    "resolution": "Corrected HSS pool weights in Diameter routing agent. Full service restoration in 25 minutes.",
                    "resolution_time_minutes": 25,
                    "match_confidence": "High",
                }
            ],
            "incident_count": 1,
        }
    else:
        payload = {
            "source": "ServiceNow KB",
            "similar_incidents": [
                {
                    "incident_id": "INC-8821",
                    "title": "Multi-sector RRC failure following BBU firmware upgrade — Site B7",
                    "date": "2023-11-02",
                    "root_cause": "Firmware v4.2.1 introduced a timing misconfiguration in the scheduler causing sector-level RRC failures under load",
                    "resolution": "Rolled back firmware to v4.1.8 on all affected BBUs. Issue resolved within 40 minutes of rollback.",
                    "resolution_time_minutes": 40,
                    "match_confidence": "High",
                }
            ],
            "incident_count": 1,
        }

    return AdapterResponse(
        meta=ToolMeta(**tool_meta("servicenow_kb", "get_similar_incidents")),
        data=payload,
    ).model_dump()
