"""Follow-up: send via standard send API with explicit recipient and RFC threading headers (not reply endpoint)."""

from __future__ import annotations

import html
import os

from app.adapters._mock_scenarios import now_iso, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def _rfc_message_id_header(raw: str) -> str:
    """Normalize to angle-bracket form for In-Reply-To / References."""
    mid = (raw or "").strip()
    if not mid:
        return ""
    if mid.startswith("<") and mid.endswith(">"):
        return mid
    return f"<{mid}>"


def send_followup(
    to: str,
    body: str,
    subject: str,
    thread_id: str,
    message_id: str,
) -> dict:
    """
    Send a follow-up in the same conversation: explicit `to` (engineer), plus In-Reply-To/References
    from the prior message so clients thread correctly. Do not use the reply endpoint for outbound anchors.
    """
    api_key = (os.environ.get("AGENTMAIL_API_KEY") or "").strip()
    inbox_id = (os.environ.get("AGENTMAIL_INBOX_ID") or "").strip()
    to_addr = (to or "").strip()
    text_body = body or ""
    subj = (subject or "").strip() or "(no subject)"
    if not subj.lower().startswith("re:"):
        subj = f"Re: {subj}"
    thr = (thread_id or "").strip()
    anchor = _rfc_message_id_header(message_id or "")

    if not to_addr:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("agentmail", "send_followup")),
            ok=False,
            error="to is required (engineer email address)",
            data={},
        ).model_dump()

    if not anchor:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("agentmail", "send_followup")),
            ok=False,
            error="message_id is required (anchor message for threading)",
            data={},
        ).model_dump()

    if not api_key or not inbox_id:
        mid = f"AGENTMAIL-MOCK-FU-{now_iso()}-{hash(anchor) % 100000}"
        data = {
            "sent": True,
            "mock": True,
            "message_id": mid,
            "thread_id": thr or f"AGENTMAIL-MOCK-THR-{hash(anchor + 't') % 100000}",
            "to": to_addr,
            "in_reply_to": anchor,
            "system": "AgentMail (mock)",
        }
        return AdapterResponse(meta=ToolMeta(**tool_meta("agentmail", "send_followup")), data=data).model_dump()

    try:
        from agentmail import AgentMail  # type: ignore[import-untyped]

        client = AgentMail(api_key=api_key)
        safe_html = "<p>" + html.escape(text_body).replace("\n", "</p><p>") + "</p>"
        headers = {
            "In-Reply-To": anchor,
            "References": anchor,
        }
        result = client.inboxes.messages.send(
            inbox_id=inbox_id,
            to=to_addr,
            subject=subj,
            text=text_body,
            html=safe_html,
            headers=headers,
        )
        out_mid = str(getattr(result, "message_id", "") or "")
        out_thr = str(getattr(result, "thread_id", "") or "")
        data = {
            "sent": True,
            "mock": False,
            "message_id": out_mid,
            "thread_id": out_thr or thr,
            "to": to_addr,
            "in_reply_to": anchor,
            "system": "AgentMail",
        }
        return AdapterResponse(meta=ToolMeta(**tool_meta("agentmail", "send_followup")), data=data).model_dump()
    except Exception as e:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("agentmail", "send_followup")),
            ok=False,
            error=str(e),
            data={"sent": False, "to": to_addr, "in_reply_to": anchor},
        ).model_dump()
