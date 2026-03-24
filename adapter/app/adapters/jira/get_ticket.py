"""Fetch Jira issue by key — GET /rest/api/3/issue/{issueKey}."""

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


def _adf_collect_text(node: Any) -> list[str]:
    """Extract text leaves from an Atlassian Document Format tree."""
    if node is None:
        return []
    if isinstance(node, str):
        return [node] if node else []
    if isinstance(node, dict):
        out: list[str] = []
        if node.get("type") == "text" and "text" in node:
            t = node.get("text")
            if isinstance(t, str) and t:
                out.append(t)
        for child in node.get("content") or []:
            out.extend(_adf_collect_text(child))
        return out
    if isinstance(node, list):
        acc: list[str] = []
        for item in node:
            acc.extend(_adf_collect_text(item))
        return acc
    return []


def _description_plain(description: Any) -> str:
    if not isinstance(description, dict):
        return ""
    parts = _adf_collect_text(description.get("content"))
    return "\n".join(p for p in parts if p).strip()


def get_ticket(order_id: str) -> dict:
    issue_key = (order_id or "").strip()
    if not issue_key:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "get_ticket")),
            ok=False,
            error="order_id (issue key) is required",
            data={},
        ).model_dump()

    creds = _auth()
    if not creds:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "get_ticket")),
            ok=False,
            error="JIRA_EMAIL and JIRA_API_TOKEN must be set",
            data={},
        ).model_dump()

    url = f"{_jira_base()}/rest/api/3/issue/{issue_key}"
    try:
        r = requests.get(
            url,
            auth=HTTPBasicAuth(creds[0], creds[1]),
            headers={"Accept": "application/json"},
            timeout=30,
        )
    except requests.RequestException as e:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "get_ticket")),
            ok=False,
            error=str(e),
            data={"key": issue_key},
        ).model_dump()

    if not r.ok:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "get_ticket")),
            ok=False,
            error=f"HTTP {r.status_code}: {r.text[:500]}",
            data={"key": issue_key},
        ).model_dump()

    try:
        data = r.json()
    except ValueError:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "get_ticket")),
            ok=False,
            error="Invalid JSON from Jira",
            data={"key": issue_key},
        ).model_dump()

    fields = data.get("fields") or {}
    status_obj = fields.get("status") or {}
    status_name = status_obj.get("name") if isinstance(status_obj, dict) else None
    if isinstance(status_name, str):
        status_out = status_name
    else:
        status_out = ""

    status_lower = status_out.strip().lower() if isinstance(status_out, str) else ""

    raw_desc = fields.get("description")
    payload = {
        "key": data.get("key") or issue_key,
        "title": fields.get("summary"),
        "status": status_out,
        "status_lower": status_lower,
        "description": raw_desc,
        "description_plain": _description_plain(raw_desc),
    }

    return AdapterResponse(meta=ToolMeta(**tool_meta("jira", "get_ticket")), data=payload).model_dump()
