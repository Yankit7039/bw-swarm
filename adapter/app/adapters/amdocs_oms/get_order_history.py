from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_order_history(order_id: str, limit: int = 20, offset: int = 0) -> dict:
    """OMS: Getting order history

    Returns paginated timeline entries (events, codes, sources) for an order.
    Use when you need evidence of what happened over time; paginate when has_more is true.
    """
    s = scenario_for_order_id(order_id)

    if s == 0:
        all_entries = [
            {"timestamp": "2024-01-15T09:54:58Z", "level": "INFO", "event": "PROV_START", "detail": "Order submitted to BSS", "source": "BSS-PROV"},
            {"timestamp": "2024-01-15T09:56:30Z", "level": "WARN", "event": "HLR_TIMEOUT", "detail": "No response within 30s", "source": "OSS-HLR", "code": "ERR_HLR_7734"},
            {"timestamp": "2024-01-15T10:03:00Z", "level": "ERROR", "event": "PROV_ABANDONED", "detail": "Gateway timeout", "source": "BSS-PROV", "code": "TIMEOUT_504"},
        ]
    elif s == 1:
        all_entries = [
            {"timestamp": "2024-01-15T08:50:00Z", "level": "INFO", "event": "PROV_START", "detail": "Order submitted", "source": "BSS-PROV"},
            {"timestamp": "2024-01-15T08:51:02Z", "level": "WARN", "event": "LEDGER_DELTA", "detail": "Proration mismatch", "source": "CRM", "code": "LEDGER_MISMATCH"},
            {"timestamp": "2024-01-15T08:52:00Z", "level": "INFO", "event": "HOLD_APPLIED", "detail": "Order on hold pending reconcile", "source": "BSS-PROV"},
        ]
    elif s == 2:
        all_entries = [
            {"timestamp": "2024-01-15T08:00:00Z", "level": "INFO", "event": "PROV_START", "detail": "Order submitted", "source": "BSS-PROV"},
            {"timestamp": "2024-01-15T08:01:00Z", "level": "WARN", "event": "NETWORK_HOLD", "detail": "FRAUD hold on MSISDN", "source": "OSS-HLR", "hold_id": "HOLD-8821"},
        ]
    elif s == 3:
        all_entries = [
            {"timestamp": "2024-01-15T11:00:00Z", "level": "INFO", "event": "PROV_START", "detail": "Order submitted", "source": "BSS-PROV"},
            {"timestamp": "2024-01-15T11:00:35Z", "level": "WARN", "event": "UPSTREAM_CALL_FAILED", "detail": "External API 503", "source": "BSS-PROV", "code": "ERR_UPSTREAM_503"},
        ]
    else:
        all_entries = [
            {"timestamp": "2024-01-15T10:05:00Z", "level": "INFO", "event": "PROV_COMPLETE", "detail": "Provisioning completed successfully", "source": "BSS-PROV"},
            {"timestamp": "2024-01-15T10:05:01Z", "level": "INFO", "event": "STATUS_UPDATE", "detail": "Order marked completed in BSS", "source": "BSS-PROV"},
        ]

    total = len(all_entries)
    page = all_entries[offset : offset + limit]
    return AdapterResponse(
        meta=ToolMeta(**tool_meta("amdocs_oms", "get_order_history")),
        data={"order_id": order_id, "entries": page, "count": len(page), "total_count": total, "offset": offset, "has_more": offset + len(page) < total},
    ).model_dump()

