"""Transition Jira issue — GET/POST /rest/api/3/issue/{issueKey}/transitions."""

from __future__ import annotations

import os
from typing import Any

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


def transition_ticket(order_id: str, target_status: str) -> dict:
    issue_key = (order_id or "").strip()
    want = (target_status or "").strip().lower()
    if not issue_key:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "transition_ticket")),
            ok=False,
            error="order_id (issue key) is required",
            data={"success": False, "reason": "missing issue key"},
        ).model_dump()

    if not want:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "transition_ticket")),
            ok=False,
            error="target_status is required",
            data={"success": False, "reason": "missing target_status"},
        ).model_dump()

    creds = _auth()
    if not creds:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "transition_ticket")),
            ok=False,
            error="JIRA_EMAIL and JIRA_API_TOKEN must be set",
            data={"success": False, "reason": "missing Jira credentials"},
        ).model_dump()

    url = f"{_jira_base()}/rest/api/3/issue/{issue_key}/transitions"
    headers = {"Accept": "application/json", "Content-Type": "application/json"}

    try:
        r = requests.get(
            url,
            auth=HTTPBasicAuth(creds[0], creds[1]),
            headers={"Accept": "application/json"},
            timeout=30,
        )
    except requests.RequestException as e:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "transition_ticket")),
            ok=False,
            error=str(e),
            data={"success": False, "reason": str(e)},
        ).model_dump()

    if not r.ok:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "transition_ticket")),
            ok=False,
            error=f"HTTP {r.status_code}: {r.text[:500]}",
            data={"success": False, "reason": f"list transitions failed: HTTP {r.status_code}"},
        ).model_dump()

    try:
        body: dict[str, Any] = r.json()
    except ValueError:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "transition_ticket")),
            ok=False,
            error="Invalid JSON from Jira",
            data={"success": False, "reason": "invalid transitions response"},
        ).model_dump()

    transitions = body.get("transitions") or []
    names: list[str] = []
    transition_id: str | None = None
    for t in transitions:
        if not isinstance(t, dict):
            continue
        name = t.get("name")
        tid = t.get("id")
        if isinstance(name, str):
            names.append(name)
            if name.strip().lower() == want:
                transition_id = str(tid) if tid is not None else None

    if not transition_id:
        avail = ", ".join(names) if names else "(none)"
        reason = f'no transition named "{target_status}"; available: {avail}'
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "transition_ticket")),
            data={"success": False, "reason": reason},
        ).model_dump()

    try:
        post = requests.post(
            url,
            auth=HTTPBasicAuth(creds[0], creds[1]),
            headers=headers,
            json={"transition": {"id": transition_id}},
            timeout=30,
        )
    except requests.RequestException as e:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "transition_ticket")),
            ok=False,
            error=str(e),
            data={"success": False, "reason": str(e)},
        ).model_dump()

    if not post.ok:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "transition_ticket")),
            ok=False,
            error=f"HTTP {post.status_code}: {post.text[:500]}",
            data={"success": False, "reason": f"transition POST failed: HTTP {post.status_code}"},
        ).model_dump()

    return AdapterResponse(
        meta=ToolMeta(**tool_meta("jira", "transition_ticket")),
        data={"success": True, "transitioned_to": target_status},
    ).model_dump()
