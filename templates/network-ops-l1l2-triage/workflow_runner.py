"""Run network-ops L1/L2 triage pipeline and write result/events to shared Postgres."""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path

import yaml
from google.adk.apps.app import App
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from network_ops_l1l2_triage.agent import build_root_agent
from run_db import insert_run_event, update_run_status

_LOG = logging.getLogger(__name__)
_ERROR_MESSAGE_MAX_LEN = 16000

APP_NAME = "network_ops_l1l2_triage"
WORKFLOW_PATH = Path(__file__).resolve().parent / "network-ops-l1l2-triage.yaml"
TEMPLATE_ID = "network-ops-l1l2-triage"

TOOL_EVENT_LABELS = {
    "jira__get_ticket": "Jira: Fetching ticket",
    "jira__transition_ticket": "Jira: Transitioning ticket",
    "jira__update_labels": "Jira: Updating labels",
    "jira__add_comment": "Jira: Posting SWARM comment",
    "jira__update_priority": "Jira: Updating priority",
    "ericsson_oss__get_correlated_alarms": "Ericsson OSS: Getting correlated alarms",
    "netcracker__get_recent_changes": "NetCracker: Getting recent changes",
    "servicenow_kb__get_similar_incidents": "ServiceNow KB: Getting similar incidents",
}

_FINAL_STATE_KEYS = (
    "ticket_details",
    "transition_result",
    "classification",
    "label_result",
    "alarm_data",
    "change_data",
    "kb_data",
    "analysis",
    "priority_result",
    "comment_result",
    "final_transition",
)


def _llm_agent_tool_allowlists(workflow_path: Path) -> dict[str, frozenset[str]]:
    with open(workflow_path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    out: dict[str, frozenset[str]] = {}
    for stage in data.get("stages", []):
        for step in stage.get("steps", []):
            if step.get("type") != "llm_agent":
                continue
            name = step.get("name") or "llm"
            tf = step.get("tool_filter") or []
            out[name] = frozenset(tf)
    return out


def _should_log_adk_tool(
    agent_name: str | None, tool_name: str, allowlists: dict[str, frozenset[str]]
) -> bool:
    if not agent_name or agent_name not in allowlists:
        return False
    allowed = allowlists[agent_name]
    return bool(allowed) and tool_name in allowed


def _get_function_calls(event):
    getter = getattr(event, "get_function_calls", None)
    if getter:
        result = getter()
        if result is not None:
            return result
    out = []
    if getattr(event, "content", None) and getattr(event.content, "parts", None):
        for part in event.content.parts:
            fc = getattr(part, "function_call", None)
            if fc is not None and getattr(fc, "name", None):
                out.append(type("FC", (), {"name": fc.name})())
    return out


def _get_function_responses(event):
    getter = getattr(event, "get_function_responses", None)
    if getter:
        result = getter()
        if result is not None:
            return result
    out = []
    if getattr(event, "content", None) and getattr(event.content, "parts", None):
        for part in event.content.parts:
            fr = getattr(part, "function_response", None)
            if fr is not None and getattr(fr, "name", None):
                out.append(type("FR", (), {"name": fr.name})())
    return out


def _get_event_text(event):
    parts = getattr(event, "content", None) and getattr(event.content, "parts", None)
    if not parts:
        return ""
    return "".join(getattr(p, "text", "") or "" for p in parts).strip()


def _format_run_error(exc: BaseException, depth: int = 0, max_depth: int = 10) -> str:
    prefix = "  " * depth
    if depth >= max_depth:
        return f"{prefix}{type(exc).__name__}: {exc}"
    if isinstance(exc, BaseExceptionGroup):
        lines = [f"{prefix}{type(exc).__name__}: {exc}"]
        for i, sub in enumerate(exc.exceptions):
            lines.append(f"{prefix}  [{i}]")
            lines.extend(_format_run_error(sub, depth + 2, max_depth).splitlines())
        return "\n".join(lines)
    parts = [f"{prefix}{type(exc).__name__}: {exc}"]
    chain = exc.__cause__ if exc.__cause__ is not None else (
        None if getattr(exc, "__suppress_context__", False) else exc.__context__
    )
    if chain is not None and depth + 1 < max_depth:
        label = "cause" if exc.__cause__ is not None else "context"
        parts.append(f"{prefix}  ({label})")
        parts.extend(_format_run_error(chain, depth + 2, max_depth).splitlines())
    return "\n".join(parts)


def _run_error_message(exc: BaseException) -> str:
    text = _format_run_error(exc)
    if len(text) > _ERROR_MESSAGE_MAX_LEN:
        return text[: _ERROR_MESSAGE_MAX_LEN - 24] + "\n... [truncated]"
    return text


_LLM_LOG_MAX_LEN = 4000


def _strip_json_fences(text: str) -> str:
    if not text:
        return ""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:].strip()
    elif text.startswith("```"):
        text = text[3:].strip()
    if text.endswith("```"):
        text = text[:-3].strip()
    return text


def _try_compact_json_from_text(text: str) -> str | None:
    s = _strip_json_fences(text)
    try:
        parsed = json.loads(s)
        return json.dumps(parsed, ensure_ascii=False)
    except json.JSONDecodeError:
        pass
    decoder = json.JSONDecoder()
    for opener in ("{", "["):
        last = len(s)
        while True:
            idx = s.rfind(opener, 0, last)
            if idx == -1:
                break
            try:
                parsed, _ = decoder.raw_decode(s, idx)
                return json.dumps(parsed, ensure_ascii=False)
            except json.JSONDecodeError:
                last = idx
    return None


def _compact_llm_log_text(text: str) -> str:
    if not text:
        return ""
    compact = _try_compact_json_from_text(text)
    if compact is not None:
        return compact
    t = text.strip()
    if len(t) > _LLM_LOG_MAX_LEN:
        return t[: _LLM_LOG_MAX_LEN - 24] + "\n... [truncated]"
    return t


def _adk_tool_payload(tool_name: str, label: str, parent_agent: str | None) -> dict:
    p: dict = {"tool": tool_name, "label": label}
    if parent_agent:
        p["parent_agent"] = parent_agent
    return p


_run_session_service = InMemorySessionService()


async def run_workflow(run_id: uuid.UUID, payload: dict) -> None:
    ticket_id = str(payload.get("ticket_id") or "").strip()
    if not ticket_id:
        await update_run_status(run_id, "failed", error_message="payload.ticket_id required")
        return

    await update_run_status(run_id, "running", follow_up_in_progress=False)
    session_id = uuid.uuid4().hex
    user_text = f"Network ops L1/L2 triage for Jira ticket {ticket_id}."

    try:
        session_state: dict = {
            "ticket_id": ticket_id,
            "run_id": str(run_id),
        }
        session = await _run_session_service.create_session(
            app_name=APP_NAME,
            user_id="api",
            session_id=session_id,
            state=session_state,
        )

        await insert_run_event(run_id, "workflow_started", "Workflow started", None)

        root_agent = build_root_agent(
            WORKFLOW_PATH,
            run_id=run_id,
            insert_run_event=insert_run_event,
            tool_labels=TOOL_EVENT_LABELS,
        )
        app = App(name=APP_NAME, root_agent=root_agent)
        runner = Runner(app=app, session_service=_run_session_service)

        content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_text)],
        )
        final_response_text = None
        adk_tool_allowlists = _llm_agent_tool_allowlists(WORKFLOW_PATH)

        async for event in runner.run_async(
            user_id="api",
            session_id=session.id,
            new_message=content,
        ):
            event_author = getattr(event, "author", None)
            tool_context_agent = event_author

            fcs = _get_function_calls(event)
            frs = _get_function_responses(event)
            for fc in fcs:
                if _should_log_adk_tool(tool_context_agent, fc.name, adk_tool_allowlists):
                    label = TOOL_EVENT_LABELS.get(fc.name, f"Calling {fc.name}")
                    await insert_run_event(
                        run_id,
                        "tool_started",
                        label,
                        _adk_tool_payload(fc.name, label, tool_context_agent),
                    )
            for fr in frs:
                if _should_log_adk_tool(tool_context_agent, fr.name, adk_tool_allowlists):
                    label = TOOL_EVENT_LABELS.get(fr.name, fr.name)
                    await insert_run_event(
                        run_id,
                        "tool_completed",
                        f"Completed {label}",
                        _adk_tool_payload(fr.name, label, tool_context_agent),
                    )

            event_text = _get_event_text(event)
            has_visible_tool = any(
                _should_log_adk_tool(tool_context_agent, fc.name, adk_tool_allowlists) for fc in fcs
            ) or any(_should_log_adk_tool(tool_context_agent, fr.name, adk_tool_allowlists) for fr in frs)
            is_partial = getattr(event, "partial", False)
            if event_text and not has_visible_tool and not is_partial:
                llm_payload: dict = {
                    "text": _compact_llm_log_text(event_text),
                    "agent": event_author,
                }
                if event_author:
                    llm_payload["parent_agent"] = event_author
                await insert_run_event(run_id, "llm_message", "Model responded", llm_payload)

            if event.is_final_response():
                if event.content and event.content.parts:
                    part = event.content.parts[0]
                    final_response_text = getattr(part, "text", None) or str(part)

        final_state_source = root_agent._final_session_state or {}
        final_state: dict = {}
        for key in _FINAL_STATE_KEYS:
            if key in final_state_source:
                final_state[key] = final_state_source[key]

        if final_response_text is None and final_state.get("analysis"):
            final_response_text = str(final_state["analysis"])
        if final_response_text is None:
            final_response_text = "Workflow completed."

        await insert_run_event(run_id, "workflow_completed", "Workflow completed", None)
        await update_run_status(
            run_id,
            "completed",
            result={
                "text": final_response_text,
                "ticket_id": ticket_id,
                "template_id": TEMPLATE_ID,
            },
            follow_up_in_progress=False,
        )
    except Exception as e:
        _LOG.exception("run_workflow failed run_id=%s", run_id)
        await update_run_status(run_id, "failed", error_message=_run_error_message(e), follow_up_in_progress=False)
