"""Run ticket email routing pipeline and write result/events to shared Postgres."""

import json
import logging
import uuid
from pathlib import Path

import yaml
from google.adk.apps.app import App
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from run_db import (
    clear_followup_columns,
    followup_due_after_seconds,
    insert_communication_thread,
    insert_run_event,
    mark_pending_processed_by_id,
    mark_pending_processed_for_thread,
    update_run_status,
)
from ticket_email_routing.agent import build_root_agent

_LOG = logging.getLogger(__name__)
_ERROR_MESSAGE_MAX_LEN = 16000

FOLLOW_UP_LIMIT = 3
FOLLOW_UP_INTERVAL_SEC = 120

APP_NAME = "ticket_email_routing"
WORKFLOW_PATH = Path(__file__).resolve().parent / "ticket-email-routing.yaml"
TEMPLATE_ID = "ticket-email-routing"


def _llm_agent_tool_allowlists(workflow_path: Path) -> dict[str, frozenset[str]]:
    """Map llm_agent step name -> allowed ADK tool names (empty frozenset => never log tool events)."""
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


TOOL_EVENT_LABELS = {
    "jira__get_ticket": "Jira: Getting ticket",
    "jira__transition_ticket": "Jira: Transitioning ticket",
    "escalation_matrix__lookup": "Escalation matrix: Looking up contact",
    "agentmail__send_email": "AgentMail: Sending email",
    "agentmail__send_followup": "AgentMail: Sending follow-up in thread",
}


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
    """If text is or ends with a JSON object/array, return compact JSON for run_events display."""
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
    """Store a short, UI-friendly model message in run_events (full reasoning stays in the model)."""
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


def _tool_data_blob(raw: object) -> dict:
    if not isinstance(raw, dict):
        return {}
    if raw.get("data") is not None and isinstance(raw["data"], dict):
        return raw["data"]
    return raw


def _message_id_from_email_result(email_result: object) -> str | None:
    d = _tool_data_blob(email_result)
    mid = d.get("message_id")
    if mid is not None and str(mid).strip():
        return str(mid).strip()
    return None


def _email_send_succeeded(email_result: object) -> bool:
    d = _tool_data_blob(email_result)
    if d.get("ok") is False:
        return False
    return bool(d.get("sent"))


def _reply_succeeded(reply_result: object) -> bool:
    d = _tool_data_blob(reply_result)
    if d.get("ok") is False:
        return False
    return bool(d.get("sent"))


def _coerce_bool(v: object) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in ("true", "1", "yes")
    return bool(v)


_run_session_service = InMemorySessionService()


async def run_workflow(run_id: uuid.UUID, payload: dict) -> None:
    fc_in = payload.get("followup_context") or {}
    rc_in = payload.get("reply_context") or {}
    ts_in = payload.get("thread_state") or {}
    if isinstance(fc_in, dict) and isinstance(rc_in, dict) and fc_in and rc_in:
        await insert_run_event(
            run_id,
            "workflow_error",
            (
                "The workflow received both follow-up context and reply context in the same request, "
                "which is invalid. This run is being marked as failed."
            ),
            None,
        )
        await update_run_status(
            run_id,
            "failed",
            error_message="Invalid payload: both followup_context and reply_context were set.",
            follow_up_in_progress=False,
        )
        return

    is_reply = bool(rc_in)
    is_followup = bool(fc_in) and not is_reply
    fc_for_session = (ts_in if isinstance(ts_in, dict) else {}) if is_reply else (fc_in if isinstance(fc_in, dict) else {})
    order_id = (
        (payload.get("order_id") or fc_for_session.get("order_id") or fc_in.get("order_id") or "")
        .strip()
    )
    if not order_id:
        await update_run_status(run_id, "failed", error_message="payload.order_id required")
        return

    await update_run_status(run_id, "running", follow_up_in_progress=False)
    session_id = uuid.uuid4().hex

    if is_reply:
        user_text = (
            f"Order {order_id}: an engineer replied in the escalation email thread. "
            f"Draft and send a concise, helpful reply in the same AgentMail thread."
        )
    elif is_followup:
        user_text = (
            f"Follow up on order {order_id}: check Jira, reply in the existing AgentMail thread if still open."
        )
    else:
        user_text = f"Route ticket email escalation. Order ID: {order_id}."

    try:
        session_state: dict = {
            "order_id": order_id,
            "run_id": str(run_id),
            "is_followup": is_followup,
            "is_reply": is_reply,
        }
        if is_followup or is_reply:
            session_state["followup_context"] = fc_for_session
        if is_reply:
            session_state["reply_context"] = rc_in

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
        keys = (
            "ticket_details",
            "contact",
            "email_draft",
            "email_result",
            "current_ticket",
            "resolved",
            "followup_draft",
            "reply_result",
            "engineer_reply_draft",
            "engineer_reply_result",
        )
        final_state: dict = {}
        for key in keys:
            if key in final_state_source:
                final_state[key] = final_state_source[key]

        if final_response_text is None and final_state.get("email_draft"):
            final_response_text = str(final_state["email_draft"])
        if final_response_text is None:
            final_response_text = "Workflow completed."

        try:
            if is_reply:
                reply_prior = str(payload.get("reply_prior_status") or "waiting_for_followup").strip()
                pending_raw = payload.get("pending_inbound_id")
                if isinstance(pending_raw, (int, float)):
                    pending_id_val = int(pending_raw)
                elif isinstance(pending_raw, str) and pending_raw.strip().isdigit():
                    pending_id_val = int(pending_raw.strip())
                else:
                    pending_id_val = None
                terminal = await _persist_after_reply_pod(
                    run_id,
                    fc_for_session,
                    rc_in,
                    final_state,
                    reply_prior_status=reply_prior,
                    pending_inbound_id=pending_id_val,
                )
            elif is_followup:
                terminal = await _persist_after_followup_pod(run_id, fc_in, final_state)
            else:
                terminal = await _persist_after_initial_pod(run_id, order_id, final_state)
        except Exception as persist_exc:
            _LOG.exception("post-agent persist failed run_id=%s", run_id)
            await insert_run_event(
                run_id,
                "workflow_error",
                "Saving run outcome to the database failed after the workflow finished.",
                {"error": str(persist_exc)},
            )
            await update_run_status(
                run_id,
                "failed",
                error_message=_run_error_message(persist_exc),
                follow_up_in_progress=False,
            )
            return

        if terminal in ("completed", "exhausted"):
            await insert_run_event(run_id, "workflow_completed", "Workflow completed", None)
    except Exception as e:
        _LOG.exception("run_workflow failed run_id=%s", run_id)
        await update_run_status(run_id, "failed", error_message=_run_error_message(e), follow_up_in_progress=False)


async def _persist_after_initial_pod(
    run_id: uuid.UUID, order_id: str, final_state: dict
) -> str | None:
    contact = final_state.get("contact") or {}
    email_draft = final_state.get("email_draft") or {}
    email_result = final_state.get("email_result")

    if not _email_send_succeeded(email_result):
        await update_run_status(
            run_id,
            "failed",
            error_message="Initial escalation email did not send successfully.",
            follow_up_in_progress=False,
        )
        return None

    message_id = _message_id_from_email_result(email_result)
    if not message_id:
        await update_run_status(
            run_id,
            "failed",
            error_message="AgentMail send did not return message_id; cannot schedule follow-ups.",
            follow_up_in_progress=False,
        )
        return None

    er = _tool_data_blob(email_result)
    thread_id = er.get("thread_id")
    contact_name = contact.get("name") if isinstance(contact, dict) else None
    contact_email = contact.get("email") if isinstance(contact, dict) else None

    state_obj: dict = {
        "order_id": order_id,
        "contact_name": contact_name,
        "contact_email": contact_email,
        "message_id": message_id,
        "thread_id": thread_id,
        "follow_up_count": 0,
        "followup_attempt_number": 1,
        "follow_up_limit": FOLLOW_UP_LIMIT,
        "follow_up_interval_seconds": FOLLOW_UP_INTERVAL_SEC,
        "last_email_subject": email_draft.get("subject") if isinstance(email_draft, dict) else None,
        "last_email_body": email_draft.get("body") if isinstance(email_draft, dict) else None,
    }

    due = followup_due_after_seconds(FOLLOW_UP_INTERVAL_SEC)
    await update_run_status(
        run_id,
        "waiting_for_followup",
        state=state_obj,
        followup_due_at=due,
        follow_up_in_progress=False,
    )
    await insert_run_event(
        run_id,
        "followup_scheduled",
        (
            f"A follow-up is scheduled for {due.isoformat()} (attempt 1 of up to {FOLLOW_UP_LIMIT}, "
            f"interval {FOLLOW_UP_INTERVAL_SEC} seconds)."
        ),
        {
            "next_followup_at": due.isoformat(),
            "follow_up_count": 0,
            "followup_attempt_number": 1,
            "message_id": message_id,
            "thread_id": thread_id,
        },
    )
    if thread_id:
        await insert_communication_thread(str(thread_id), run_id, TEMPLATE_ID)
    return None


async def _persist_after_reply_pod(
    run_id: uuid.UUID,
    thread_state: dict,
    reply_ctx: dict,
    final_state: dict,
    *,
    reply_prior_status: str,
    pending_inbound_id: int | None,
) -> str | None:
    send_res = final_state.get("engineer_reply_result")
    if not _reply_succeeded(send_res):
        await update_run_status(
            run_id,
            "failed",
            error_message="Reply to the engineer did not send successfully.",
            follow_up_in_progress=False,
        )
        return None

    rr = _tool_data_blob(send_res)
    tid = str(
        thread_state.get("thread_id") or (reply_ctx.get("thread_id") if isinstance(reply_ctx, dict) else "") or ""
    ).strip()
    if not tid:
        await update_run_status(
            run_id,
            "failed",
            error_message="Missing thread_id after engineer reply send.",
            follow_up_in_progress=False,
        )
        return None

    state_obj = dict(thread_state) if isinstance(thread_state, dict) else {}
    if rr.get("message_id"):
        state_obj["message_id"] = str(rr["message_id"]).strip()
    # Keep canonical thread_id in state; register outbound thread_ids so inbound replies route.
    if rr.get("thread_id"):
        rr_tid = str(rr["thread_id"]).strip()
        if rr_tid and rr_tid != state_obj.get("thread_id"):
            await insert_communication_thread(rr_tid, run_id, TEMPLATE_ID)

    attempt_num = int(state_obj.get("followup_attempt_number") or 1)
    prior = (reply_prior_status or "waiting_for_followup").strip()
    due = None

    if prior == "exhausted":
        await update_run_status(
            run_id,
            "exhausted",
            state=state_obj,
            result={
                "text": "Engineer reply handled; run remains exhausted (no further proactive follow-ups).",
                "follow_up_count": state_obj.get("follow_up_count"),
            },
            follow_up_in_progress=False,
            followup_due_at_clear=True,
        )
    else:
        due = followup_due_after_seconds(FOLLOW_UP_INTERVAL_SEC)
        await update_run_status(
            run_id,
            "waiting_for_followup",
            state=state_obj,
            followup_due_at=due,
            follow_up_in_progress=False,
        )

    if pending_inbound_id is not None:
        marked = await mark_pending_processed_by_id(pending_inbound_id)
        n_pending = 1 if marked else 0
    else:
        n_pending = await mark_pending_processed_for_thread(tid)
    if n_pending > 0:
        await insert_run_event(
            run_id,
            "pending_inbound_drained",
            (
                f"{n_pending} queued inbound message(s) were marked as processed while the reply "
                f"to the engineer was handled."
            ),
            {"count": n_pending, "thread_id": tid},
        )

    if prior == "exhausted":
        await insert_run_event(
            run_id,
            "engineer_reply_after_exhausted",
            (
                "An engineer reply was handled while the run was exhausted; "
                "no follow-up timer was reset."
            ),
            {"thread_id": tid, "run_id": str(run_id)},
        )
        return "exhausted"

    assert due is not None
    await insert_run_event(
        run_id,
        "followup_scheduled",
        (
            f"The next follow-up is scheduled for {due.isoformat()} "
            f"(attempt {attempt_num} of up to {FOLLOW_UP_LIMIT}) after handling the engineer's reply."
        ),
        {
            "next_followup_at": due.isoformat(),
            "follow_up_count": state_obj.get("follow_up_count"),
            "followup_attempt_number": attempt_num,
            "message_id": state_obj.get("message_id"),
            "thread_id": state_obj.get("thread_id"),
        },
    )
    return None


async def _persist_after_followup_pod(
    run_id: uuid.UUID, fc_in: dict, final_state: dict
) -> str | None:
    resolved = _coerce_bool(final_state.get("resolved"))
    attempt_num = int(fc_in.get("followup_attempt_number") or 1)
    prev_count = int(fc_in.get("follow_up_count") or 0)

    if resolved:
        await insert_run_event(
            run_id,
            "ticket_resolved",
            (
                f"The Jira ticket was found in a resolved state during follow-up attempt {attempt_num}. "
                f"This run is being closed as completed."
            ),
            {"follow_up_number": attempt_num, "run_id": str(run_id)},
        )
        await clear_followup_columns(run_id)
        await update_run_status(
            run_id,
            "completed",
            result={"text": "Ticket resolved on follow-up.", "resolved": True},
            follow_up_in_progress=False,
        )
        return "completed"

    reply_result = final_state.get("reply_result")
    if not _reply_succeeded(reply_result):
        await update_run_status(
            run_id,
            "failed",
            error_message="Follow-up reply did not send successfully.",
            follow_up_in_progress=False,
        )
        return None

    rr = _tool_data_blob(reply_result)
    new_count = prev_count + 1
    next_attempt = new_count + 1
    state_obj = dict(fc_in)
    state_obj["follow_up_count"] = new_count
    state_obj["followup_attempt_number"] = next_attempt
    state_obj["last_email_body"] = (final_state.get("followup_draft") or {}).get("body") if isinstance(
        final_state.get("followup_draft"), dict
    ) else None
    # Next reply must anchor to the latest outbound message in the thread.
    if rr.get("message_id"):
        state_obj["message_id"] = str(rr["message_id"]).strip()
    # Keep canonical thread_id in state; register outbound thread_ids so inbound replies route.
    if rr.get("thread_id"):
        rr_tid = str(rr["thread_id"]).strip()
        if rr_tid and rr_tid != state_obj.get("thread_id"):
            await insert_communication_thread(rr_tid, run_id, TEMPLATE_ID)

    mid = state_obj.get("message_id") or fc_in.get("message_id")
    tid = state_obj.get("thread_id") or fc_in.get("thread_id")
    await insert_run_event(
        run_id,
        "followup_sent",
        (
            f"Follow-up {attempt_num} was sent in the existing email thread "
            f"(message id {mid}, thread id {tid})."
        ),
        {
            "follow_up_number": attempt_num,
            "message_id": mid,
            "thread_id": tid,
        },
    )

    if new_count >= FOLLOW_UP_LIMIT:
        minimal = {
            "order_id": state_obj.get("order_id"),
            "thread_id": state_obj.get("thread_id"),
            "contact_email": state_obj.get("contact_email"),
            "contact_name": state_obj.get("contact_name"),
            "message_id": state_obj.get("message_id"),
            "last_email_subject": state_obj.get("last_email_subject"),
            "last_email_body": state_obj.get("last_email_body"),
            "follow_up_count": new_count,
            "followup_attempt_number": next_attempt,
            "follow_up_limit": FOLLOW_UP_LIMIT,
            "follow_up_interval_seconds": FOLLOW_UP_INTERVAL_SEC,
        }
        await update_run_status(
            run_id,
            "exhausted",
            state=minimal,
            result={"text": "Follow-up limit reached; ticket still open.", "follow_up_count": new_count},
            follow_up_in_progress=False,
            followup_due_at_clear=True,
        )
        await insert_run_event(
            run_id,
            "followup_exhausted",
            (
                f"The maximum of {FOLLOW_UP_LIMIT} follow-up emails has been reached and the ticket "
                f"was still not resolved. This run is marked exhausted."
            ),
            {"follow_up_count": new_count, "follow_up_limit": FOLLOW_UP_LIMIT},
        )
        return "exhausted"

    due = followup_due_after_seconds(FOLLOW_UP_INTERVAL_SEC)
    await update_run_status(
        run_id,
        "waiting_for_followup",
        state=state_obj,
        followup_due_at=due,
        follow_up_in_progress=False,
    )
    await insert_run_event(
        run_id,
        "followup_scheduled",
        (
            f"The next follow-up is scheduled for {due.isoformat()} "
            f"(attempt {next_attempt} of up to {FOLLOW_UP_LIMIT})."
        ),
        {
            "next_followup_at": due.isoformat(),
            "follow_up_count": new_count,
            "followup_attempt_number": next_attempt,
            "message_id": state_obj.get("message_id"),
            "thread_id": state_obj.get("thread_id"),
        },
    )
    return None
