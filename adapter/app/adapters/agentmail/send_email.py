"""Send email via AgentMail SDK, or mock when credentials are absent."""

from __future__ import annotations

import html
import os

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def send_email(to: str, subject: str, body: str) -> dict:
    """AgentMail: Send outbound email from inbox

    Sends HTML/text via the AgentMail SDK from the configured inbox. When
    AGENTMAIL_API_KEY or AGENTMAIL_INBOX_ID is unset, returns a successful mock
    with synthetic message_id and thread_id for local testing.
    """
    api_key = (os.environ.get("AGENTMAIL_API_KEY") or "").strip()
    inbox_id = (os.environ.get("AGENTMAIL_INBOX_ID") or "").strip()
    to_addr = (to or "").strip()

    if not api_key or not inbox_id:
        mid = f"AGENTMAIL-MOCK-MSG-{now_iso()}-{hash(to_addr) % 100000}"
        tid = f"AGENTMAIL-MOCK-THR-{hash(to_addr + 'thread') % 100000}"
        data = {
            "sent": True,
            "mock": True,
            "message_id": mid,
            "thread_id": tid,
            "to": to_addr,
            "subject": subject,
            "system": "AgentMail (mock)",
        }
        return AdapterResponse(meta=ToolMeta(**tool_meta("agentmail", "send_email")), data=data).model_dump()

    try:
        from agentmail import AgentMail  # type: ignore[import-untyped]

        client = AgentMail(api_key=api_key)
        safe_html = "<p>" + html.escape(body or "").replace("\n", "</p><p>") + "</p>"
        result = client.inboxes.messages.send(
            inbox_id=inbox_id,
            to=to_addr,
            subject=subject or "(no subject)",
            text=body or "",
            html=safe_html,
        )
        # SendMessageResponse: message_id, thread_id (see agentmail.messages.types.send_message_response)
        msg_id = str(getattr(result, "message_id", "") or "")
        thr_id = str(getattr(result, "thread_id", "") or "")
        data = {
            "sent": True,
            "mock": False,
            "message_id": msg_id,
            "thread_id": thr_id,
            "to": to_addr,
            "system": "AgentMail",
        }
        return AdapterResponse(meta=ToolMeta(**tool_meta("agentmail", "send_email")), data=data).model_dump()
    except Exception as e:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("agentmail", "send_email")),
            ok=False,
            error=str(e),
            data={"sent": False, "to": to_addr},
        ).model_dump()
