"""Stuck Order Resolution — SequentialAgent with enrich, investigate, resolve, notify."""

import os

from google.adk.agents import Agent, SequentialAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.lite_llm import LiteLlm

from stuck_order_agent import tools

# OpenRouter model via LiteLLM. Pass api_key/api_base explicitly so the key is sent with every request.
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openrouter/anthropic/claude-sonnet-4")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_API_BASE = os.environ.get("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")


def _inject_order_id(callback_context: CallbackContext) -> None:
    """Set order_id in state from ORDER_ID env or first user message so tools can use it."""
    ctx = callback_context
    if "order_id" not in ctx.state or not ctx.state.get("order_id"):
        ctx.state["order_id"] = os.environ.get("ORDER_ID", "ORD-001")


def _create_enrich_agent() -> Agent:
    return Agent(
        name="enrich",
        model=LiteLlm(model=OPENROUTER_MODEL, api_key=OPENROUTER_API_KEY, api_base=OPENROUTER_API_BASE),
        instruction="""You are given order_id: {order_id}. Fetch the full order details and the
customer profile associated with it. Return a structured summary of everything you find.
If the order does not exist, stop and report that clearly.

When calling fetch_order_details, pass order_id={order_id}.
When calling fetch_customer_profile, pass the order_id and customer_id (or empty string for customer_id to look up by order only).""",
        description="Context enrichment: fetches order and customer data from BSS/CRM.",
        tools=[tools.fetch_order_details, tools.fetch_customer_profile],
        output_key="enrich_output",
        before_agent_callback=_inject_order_id,
    )


def _create_investigate_agent() -> Agent:
    return Agent(
        name="investigate",
        model=LiteLlm(model=OPENROUTER_MODEL, api_key=OPENROUTER_API_KEY, api_base=OPENROUTER_API_BASE),
        instruction="""You are a telecom order forensics agent. You have been given a stuck order with order_id: {order_id}.
Use your tools to investigate why it is stuck.

Work through this checklist:
1. Query provisioning logs for errors or timeouts (use limit=20, offset=0 then increase offset to get all pages if has_more is true). Pass order_id={order_id}.
2. Check the billing ledger for mismatches or holds (use order_id={order_id}).
3. Check network status for active holds on the MSISDN (use order_id from enrich_output or {order_id}).
4. Search similar resolved cases (use order_id={order_id} and a short query), then call get_case_details for promising case_ids.
5. Use lookup_error_code for any opaque codes in logs; use get_hold_details for any hold_id you find.
6. Determine which department owns the fix.

Each conclusion must cite specific evidence from tool results. If two systems contradict each other, note it and reason about which is authoritative.

Before producing your final output, your confidence must reach 0.85 or above. After each tool call, assess confidence; if below 0.85, get more evidence.

When confident, produce: root_cause, root_cause_category, department_owner, severity, confidence, resolution_hint, auto_resolvable.""",
        description="Investigate and classify root cause of stuck order.",
        tools=[
            tools.query_provisioning_logs,
            tools.check_billing_ledger,
            tools.check_network_status,
            tools.get_network_events,
            tools.get_hold_details,
            tools.lookup_error_code,
            tools.search_similar_cases,
            tools.get_case_details,
        ],
        output_key="investigate_output",
    )


def _create_resolve_agent() -> Agent:
    return Agent(
        name="resolve",
        model=LiteLlm(model=OPENROUTER_MODEL, api_key=OPENROUTER_API_KEY, api_base=OPENROUTER_API_BASE),
        instruction="""You are a telecom remediation agent. The stuck order has order_id: {order_id}. Based on the investigation findings in {investigate_output},
attempt to resolve the stuck order using your tools. Pass order_id={order_id} to all tools (trigger_provisioning_retry, force_billing_reconcile, release_network_hold, poll_order_status).

Follow the resolution_hint from the investigation and what worked in similar cases (from get_case_details).

Do not assume the first remediation works. Always poll_order_status after each action. If status has not moved to completed,
try the next action. Only declare failure after exhausting all available actions. Poll at least once between each action.

For contradictory evidence (logs say done, status stuck): provisioning retry will not help; check billing and run force_billing_reconcile.

After each tool result, write 2-3 sentences of reasoning before deciding the next action.""",
        description="Attempt automatic resolution of the stuck order.",
        tools=[
            tools.trigger_provisioning_retry,
            tools.force_billing_reconcile,
            tools.release_network_hold,
            tools.poll_order_status,
        ],
        output_key="resolve_output",
    )


def _create_notify_agent() -> Agent:
    return Agent(
        name="notify",
        model=LiteLlm(model=OPENROUTER_MODEL, api_key=OPENROUTER_API_KEY, api_base=OPENROUTER_API_BASE),
        instruction="""You are composing an escalation email for a telecom operations engineer.

Use the context from {enrich_output}, {investigate_output}, and {resolve_output}.

First, look up the right owner for the department and severity using lookup_escalation_owner.
Then write a concise email (under 200 words) covering:
- What the order is and who the customer is
- Root cause and key evidence
- What was attempted and the outcome
- Numbered list of recommended next actions (max 3)

Then send the email using send_email. Use only data from the inputs provided.""",
        description="Notify escalation owner by email.",
        tools=[tools.lookup_escalation_owner, tools.send_email],
        output_key="notify_output",
    )


# Root agent: sequential pipeline (enrich → investigate → resolve → notify)
root_agent = SequentialAgent(
    name="stuck_order_resolution",
    sub_agents=[
        _create_enrich_agent(),
        _create_investigate_agent(),
        _create_resolve_agent(),
        _create_notify_agent(),
    ],
)
