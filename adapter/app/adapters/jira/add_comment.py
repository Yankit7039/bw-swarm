"""Post a comment on a Jira issue — POST /rest/api/3/issue/{issueKey}/comment."""

from __future__ import annotations

import os

import requests
from requests.auth import HTTPBasicAuth

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta

_DEFAULT_JIRA_BASE = "https://swarm-bw.atlassian.net"


def _jira_base() -> str:
    return (os.environ.get("JIRA_BASE") or _DEFAULT_JIRA_BASE).rstrip("/")


def _auth() -> tuple[str, str] | None:
    email = (os.environ.get("JIRA_EMAIL") or "").strip()
    token = (os.environ.get("JIRA_API_TOKEN") or "").strip()
    if not email or not token:
        return None
    return email, token


def _plain_text_adf(text: str) -> dict:
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text}],
            }
        ],
    }


def add_comment(ticket_id: str, body: str) -> dict:
    """Add a comment to the issue; body is sent as Atlassian Document Format (plain text paragraph)."""
    issue_key = (ticket_id or "").strip()
    comment_body = body if isinstance(body, str) else ""
    if not issue_key:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "add_comment")),
            ok=False,
            error="ticket_id (issue key) is required",
            data={"success": False},
        ).model_dump()

    if not comment_body.strip():
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "add_comment")),
            ok=False,
            error="body is required",
            data={"success": False},
        ).model_dump()

    creds = _auth()
    if not creds:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "add_comment")),
            ok=False,
            error="JIRA_EMAIL and JIRA_API_TOKEN must be set",
            data={"success": False},
        ).model_dump()

    url = f"{_jira_base()}/rest/api/3/issue/{issue_key}/comment"
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    payload = {"body": _plain_text_adf(comment_body)}

    try:
        r = requests.post(
            url,
            auth=HTTPBasicAuth(creds[0], creds[1]),
            headers=headers,
            json=payload,
            timeout=30,
        )
    except requests.RequestException as e:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "add_comment")),
            ok=False,
            error=str(e),
            data={"success": False},
        ).model_dump()

    if not r.ok:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "add_comment")),
            ok=False,
            error=f"HTTP {r.status_code}: {r.text[:500]}",
            data={"success": False},
        ).model_dump()

    try:
        data = r.json()
    except ValueError:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "add_comment")),
            ok=False,
            error="Invalid JSON from Jira",
            data={"success": False},
        ).model_dump()

    comment_id = data.get("id")
    created_at = data.get("created")
    return AdapterResponse(
        meta=ToolMeta(**tool_meta("jira", "add_comment")),
        data={
            "comment_id": str(comment_id) if comment_id is not None else "",
            "created_at": created_at if isinstance(created_at, str) else "",
            "success": True,
        },
    ).model_dump()
