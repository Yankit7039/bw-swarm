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


def _normalize_label_list(raw: list[str] | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        s = item.strip()
        if s:
            out.append(s)
    return out


def update_labels(
    ticket_id: str,
    labels_to_add: list[str] | None = None,
    labels_to_remove: list[str] | None = None,
) -> dict:
    """Jira: Update labels

    MCP: ticket_id is the issue key. GET current labels, remove labels_to_remove, add labels_to_add, then PUT.
    """
    issue_key = (ticket_id or "").strip()
    if not issue_key:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_labels")),
            ok=False,
            error="ticket_id (issue key) is required",
            data={"success": False},
        ).model_dump()

    add_list = _normalize_label_list(labels_to_add)
    remove_list = _normalize_label_list(labels_to_remove)
    remove_lower = {x.lower() for x in remove_list}

    creds = _auth()
    if not creds:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_labels")),
            ok=False,
            error="JIRA_EMAIL and JIRA_API_TOKEN must be set",
            data={"success": False},
        ).model_dump()

    base = _jira_base()
    get_url = f"{base}/rest/api/3/issue/{issue_key}?fields=labels"
    headers = {"Accept": "application/json", "Content-Type": "application/json"}

    try:
        r = requests.get(
            get_url,
            auth=HTTPBasicAuth(creds[0], creds[1]),
            headers={"Accept": "application/json"},
            timeout=30,
        )
    except requests.RequestException as e:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_labels")),
            ok=False,
            error=str(e),
            data={"success": False},
        ).model_dump()

    if not r.ok:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_labels")),
            ok=False,
            error=f"HTTP {r.status_code}: {r.text[:500]}",
            data={"success": False},
        ).model_dump()

    try:
        issue = r.json()
    except ValueError:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_labels")),
            ok=False,
            error="Invalid JSON from Jira",
            data={"success": False},
        ).model_dump()

    fields = issue.get("fields") or {}
    current = fields.get("labels") or []
    if not isinstance(current, list):
        current = []
    current_strs = [x for x in current if isinstance(x, str)]

    merged = [lab for lab in current_strs if lab.lower() not in remove_lower]
    merged_lower = {lab.lower() for lab in merged}
    for lab in add_list:
        if lab.lower() not in merged_lower:
            merged.append(lab)
            merged_lower.add(lab.lower())

    put_url = f"{base}/rest/api/3/issue/{issue_key}"
    try:
        put = requests.put(
            put_url,
            auth=HTTPBasicAuth(creds[0], creds[1]),
            headers=headers,
            json={"fields": {"labels": merged}},
            timeout=30,
        )
    except requests.RequestException as e:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_labels")),
            ok=False,
            error=str(e),
            data={"success": False},
        ).model_dump()

    if not put.ok:
        return AdapterResponse(
            meta=ToolMeta(**tool_meta("jira", "update_labels")),
            ok=False,
            error=f"HTTP {put.status_code}: {put.text[:500]}",
            data={"success": False},
        ).model_dump()

    return AdapterResponse(
        meta=ToolMeta(**tool_meta("jira", "update_labels")),
        data={"labels": merged, "success": True},
    ).model_dump()
