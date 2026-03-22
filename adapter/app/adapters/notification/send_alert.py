"""Microsoft Teams webhook - send escalation alert. Delivery via Teams incoming webhook."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def send_alert(to: str, subject: str, body: str) -> dict:
    data = {
        "sent": True,
        "message_id": f"TEAMS-{now_iso()}-{hash(to) % 10000}",
        "to": to,
        "channel": "teams-webhook",
        "system": "Microsoft Teams",
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("notification", "send_alert")), data=data).model_dump()
