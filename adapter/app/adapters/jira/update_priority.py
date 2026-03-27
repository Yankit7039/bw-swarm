"""Update Jira issue priority — PUT /rest/api/3/issue/{issueKey}."""

from __future__ import annotations

import os

import requests
from requests.auth import HTTPBasicAuth

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta

_DEFAULT_JIRA_BASE = "https://swarm-bw.atlassian.net"

_ALLOWED_PRIORITIES = frozenset({"Highest", "High", "Medium", "Low", "Lowest"})


def _jira_base() -> str:
    return (os.environ.get("JIRA_BASE") or _DEFAULT_JIRA_BASE).rstrip("/")


def _auth() -> tuple[str, str] | None:
    email = (os.environ.get("JIRA_EMAIL") or "").strip()
    token = (os.environ.get("JIRA_API_TOKEN") or "").strip()
    if not email or not token:
        return None
    return email, token


def update_priority(ticket_id: str, priority: str) -> dict:
    """Set the issue priority to one of: Highest, High, Medium, Low, Lowest."""
    issue_key = (ticket_id or "").strip()
    name = (priority or "").strip()
    if not issue_key:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_priority")),
            ok=False,
            error="ticket_id (issue key) is required",
            data={"success": False},
        ).model_dump()

    if name not in _ALLOWED_PRIORITIES:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_priority")),
            ok=False,
            error=f'priority must be one of: {", ".join(sorted(_ALLOWED_PRIORITIES))}',
            data={"success": False},
        ).model_dump()

    creds = _auth()
    if not creds:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_priority")),
            ok=False,
            error="JIRA_EMAIL and JIRA_API_TOKEN must be set",
            data={"success": False},
        ).model_dump()

    url = f"{_jira_base()}/rest/api/3/issue/{issue_key}"
    headers = {"Accept": "application/json", "Content-Type": "application/json"}

    try:
        r = requests.put(
            url,
            auth=HTTPBasicAuth(creds[0], creds[1]),
            headers=headers,
            json={"fields": {"priority": {"name": name}}},
            timeout=30,
        )
    except requests.RequestException as e:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_priority")),
            ok=False,
            error=str(e),
            data={"success": False},
        ).model_dump()

    if not r.ok:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_priority")),
            ok=False,
            error=f"HTTP {r.status_code}: {r.text[:500]}",
            data={"success": False},
        ).model_dump()

    return AdapterResponse(
        meta=ToolMeta(**tool_meta("jira", "update_priority")),
        data={"priority": name, "success": True},
    ).model_dump()
