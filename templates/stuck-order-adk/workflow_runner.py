"""Run stuck-order pipeline and write result/events to shared Postgres (runs, run_events)."""

import uuid

from google.adk.apps.app import App
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from run_db import insert_run_event, update_run_status
from stuck_order_agent.agent import root_agent

APP_NAME = "stuck_order"

TOOL_EVENT_LABELS = {
    "amdocs_oms__get_order_status": "OMS: Getting order status",
    "amdocs_oms__get_order_history": "OMS: Getting order history",
    "amdocs_oms__get_workflow_state": "OMS: Getting workflow state",
    "amdocs_oms__get_error_codes": "OMS: Looking up error code",
    "amdocs_oms__retry_order": "OMS: Retrying order",
    "siebel_crm__lookup_customer": "CRM: Looking up customer",
    "siebel_crm__get_account_status": "CRM: Getting account status",
    "siebel_crm__get_billing_flags": "CRM: Getting billing flags",
    "siebel_crm__get_service_requests": "CRM: Getting service requests",
    "siebel_crm__get_contact_details": "CRM: Getting contact details",
    "ericsson__get_port_status": "Network: Getting port status",
    "ericsson__get_activation_logs": "Network: Getting activation logs",
    "ericsson__get_network_inventory": "Network: Getting inventory",
    "ericsson__retry_activation": "Network: Retrying activation",
    "ericsson__get_device_serial": "Network: Getting device serial",
    "netcracker__get_provisioning_status": "Provisioning: Getting status",
    "netcracker__get_dependency_map": "Provisioning: Getting dependency map",
    "netcracker__get_inventory_snapshot": "Provisioning: Getting inventory snapshot",
    "netcracker__get_resource_allocation": "Provisioning: Getting resource allocation",
    "netcracker__get_serial_lookup": "Provisioning: Serial lookup",
    "lookup_escalation_owner": "Looking up escalation owner",
    "send_email": "Sending email",
}


def _get_function_calls(event):
    """Extract function calls from event (get_function_calls() or content.parts)."""
    getter = getattr(event, "get_function_calls", None)
    if getter is not None:
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
    """Extract function responses from event (get_function_responses() or content.parts)."""
    getter = getattr(event, "get_function_responses", None)
    if getter is not None:
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
    """Extract full text from event.content.parts (for LLM message logging)."""
    parts = getattr(event, "content", None) and getattr(event.content, "parts", None)
    if not parts:
        return ""
    return "".join(
        getattr(p, "text", "") or "" for p in parts
    ).strip()


_run_session_service = InMemorySessionService()
_adk_app = App(name=APP_NAME, root_agent=root_agent)
_run_runner = Runner(app=_adk_app, session_service=_run_session_service)


async def run_workflow(run_id: uuid.UUID, payload: dict) -> None:
    """Run the stuck-order pipeline; write status and events to shared runs/run_events."""
    order_id = (payload.get("order_id") or "").strip()
    if not order_id:
        await update_run_status(run_id, "failed", error_message="payload.order_id required")
        return

    await update_run_status(run_id, "running")
    session_id = uuid.uuid4().hex
    try:
        session = await _run_session_service.create_session(
            app_name=APP_NAME,
            user_id="api",
            session_id=session_id,
        )
        session.state["order_id"] = order_id

        await insert_run_event(run_id, "workflow_started", "Workflow started", None)

        content = types.Content(role="user", parts=[types.Part.from_text(text=f"Process the stuck order. Order ID: {order_id}.")])
        final_response_text = None
        final_state = {}
        current_agent = None

        async for event in _run_runner.run_async(
            user_id="api",
            session_id=session.id,
            new_message=content,
        ):
            # Log tool calls and responses from event stream (no plugin)
            for fc in _get_function_calls(event):
                label = TOOL_EVENT_LABELS.get(fc.name, f"Calling {fc.name}")
                await insert_run_event(
                    run_id, "tool_started", label, {"tool": fc.name, "label": label}
                )
            for fr in _get_function_responses(event):
                label = TOOL_EVENT_LABELS.get(fr.name, fr.name)
                await insert_run_event(
                    run_id,
                    "tool_completed",
                    f"Completed {label}",
                    {"tool": fr.name, "label": label},
                )

            # Agent boundaries: log "Starting X" / "Completed X" when author changes
            author = getattr(event, "author", None)
            if author is not None and author != current_agent:
                if current_agent is not None:
                    await insert_run_event(
                        run_id,
                        "agent_completed",
                        f"Completed {current_agent}",
                        {"agent": current_agent},
                    )
                await insert_run_event(
                    run_id, "agent_started", f"Starting {author}", {"agent": author}
                )
                current_agent = author

            # LLM message: log full model text when event has text and no tool call/response
            event_text = _get_event_text(event)
            has_tool = _get_function_calls(event) or _get_function_responses(event)
            is_partial = getattr(event, "partial", False)  # missing => assume complete
            if event_text and not has_tool and not is_partial:
                await insert_run_event(
                    run_id,
                    "llm_message",
                    "Model responded",
                    {"text": event_text, "agent": current_agent},
                )

            if event.is_final_response():
                if event.content and event.content.parts:
                    part = event.content.parts[0]
                    final_response_text = getattr(part, "text", None) or str(part)
                elif getattr(event, "actions", None) and getattr(event.actions, "escalate", False):
                    final_response_text = f"Agent escalated: {getattr(event, 'error_message', None) or 'No specific message.'}"

        for key in ("enrich_output", "investigate_output", "resolve_output", "notify_output"):
            if key in session.state:
                final_state[key] = session.state[key]

        if final_response_text is None and final_state.get("notify_output"):
            final_response_text = str(final_state["notify_output"])
        if final_response_text is None:
            final_response_text = "Agent did not produce a final response."

        await insert_run_event(run_id, "workflow_completed", "Workflow completed", None)
        await update_run_status(run_id, "completed", result={"text": final_response_text, "state": final_state})
    except Exception as e:
        await update_run_status(run_id, "failed", error_message=str(e))
