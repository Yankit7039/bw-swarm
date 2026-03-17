"""Stuck Order Resolution — SequentialAgent with enrich, investigate, resolve, notify."""

import os

from google.adk.agents import Agent, SequentialAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams

from stuck_order_agent import tools

# OpenRouter model via LiteLLM. Pass api_key/api_base explicitly so the key is sent with every request.
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openrouter/qwen/qwen3.5-flash-02-23")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_API_BASE = os.environ.get("OPENROUTER_API_BASE", "https://openrouter.ai/api/v1")

ADAPTER_URL = os.environ.get("ADAPTER_URL", "http://adapter:8080").rstrip("/")
MCP_URL = f"{ADAPTER_URL}/mcp"


def _mcp_tools(tool_filter: list[str], timeout_s: int = 30) -> McpToolset:
    return McpToolset(
        connection_params=StreamableHTTPConnectionParams(url=MCP_URL, timeout=timeout_s),
        tool_filter=tool_filter,
    )


def _inject_order_id(callback_context: CallbackContext) -> None:
    """Set order_id in state from ORDER_ID env or first user message so tools can use it."""
    ctx = callback_context
    if "order_id" not in ctx.state or not ctx.state.get("order_id"):
        ctx.state["order_id"] = os.environ.get("ORDER_ID", "ORD-001")


def _create_enrich_agent() -> Agent:
    enrich_tools = _mcp_tools(
        [
            "amdocs_oms__get_order_status",
            "amdocs_oms__get_order_history",
            "siebel_crm__lookup_customer",
            "siebel_crm__get_account_status",
        ],
        timeout_s=30,
    )
    return Agent(
        name="enrich",
        model=LiteLlm(model=OPENROUTER_MODEL, api_key=OPENROUTER_API_KEY, api_base=OPENROUTER_API_BASE),
        instruction="""You are given order_id: {order_id}. Fetch the full order details and the
customer profile associated with it. Return a structured summary of everything you find.
If the order does not exist, stop and report that clearly.

Use these tools:
- amdocs_oms__get_order_status(order_id)
- amdocs_oms__get_order_history(order_id, limit, offset)
- siebel_crm__lookup_customer(order_id, customer_id="")
- siebel_crm__get_account_status(customer_id)

Call amdocs_oms__get_order_status and amdocs_oms__get_order_history for the order.
Call siebel_crm__lookup_customer to fetch the CRM profile; then optionally call siebel_crm__get_account_status.""",
        description="Context enrichment: fetches order and customer data from BSS/CRM.",
        tools=[enrich_tools],
        output_key="enrich_output",
        before_agent_callback=_inject_order_id,
    )


def _create_investigate_agent() -> Agent:
    investigate_tools = _mcp_tools(
        [
            "amdocs_oms__get_order_status",
            "amdocs_oms__get_error_codes",
            "amdocs_oms__get_order_history",
            "siebel_crm__get_billing_flags",
            "ericsson__get_port_status",
            "ericsson__get_activation_logs",
            "ericsson__get_network_inventory",
            "netcracker__get_provisioning_status",
            "netcracker__get_dependency_map",
        ],
        timeout_s=30,
    )
    return Agent(
        name="investigate",
        model=LiteLlm(model=OPENROUTER_MODEL, api_key=OPENROUTER_API_KEY, api_base=OPENROUTER_API_BASE),
        instruction="""You are a telecom order forensics agent. You have been given a stuck order with order_id: {order_id}.
Use your tools to investigate why it is stuck.

Work through this checklist:
1. Fetch OMS status + history:
   - amdocs_oms__get_order_status(order_id={order_id})
   - amdocs_oms__get_order_history(order_id={order_id}, limit=20, offset=0) and paginate if has_more is true
2. Check billing flags/holds:
   - siebel_crm__get_billing_flags(order_id={order_id})
3. Check network/port status and activation logs:
   - ericsson__get_port_status(order_id={order_id}, msisdn="") (or use msisdn from enrich_output if available)
   - ericsson__get_activation_logs(order_id={order_id}, hours=24, msisdn="")
   - ericsson__get_network_inventory(msisdn)
4. Check downstream provisioning view and dependency map:
   - netcracker__get_provisioning_status(order_id={order_id})
   - netcracker__get_dependency_map(order_id={order_id})
5. For any opaque codes from OMS/logs, call:
   - amdocs_oms__get_error_codes(code)
6. Determine which department owns the fix.

Each conclusion must cite specific evidence from tool results. If two systems contradict each other, note it and reason about which is authoritative.

Before producing your final output, your confidence must reach 0.85 or above. After each tool call, assess confidence; if below 0.85, get more evidence.

When confident, produce: root_cause, root_cause_category, department_owner, severity, confidence, resolution_hint, auto_resolvable.""",
        description="Investigate and classify root cause of stuck order.",
        tools=[investigate_tools],
        output_key="investigate_output",
    )


def _create_resolve_agent() -> Agent:
    resolve_tools = _mcp_tools(
        [
            "amdocs_oms__retry_order",
            "amdocs_oms__get_order_status",
            "ericsson__retry_activation",
        ],
        timeout_s=30,
    )
    return Agent(
        name="resolve",
        model=LiteLlm(model=OPENROUTER_MODEL, api_key=OPENROUTER_API_KEY, api_base=OPENROUTER_API_BASE),
        instruction="""You are a telecom remediation agent. The stuck order has order_id: {order_id}. Based on the investigation findings in {investigate_output},
attempt to resolve the stuck order using your tools.

Follow the resolution_hint from the investigation and what worked in similar cases (from get_case_details).

Do not assume the first remediation works. Always check amdocs_oms__get_order_status after each action. If status has not moved to completed,
try the next action. Only declare failure after exhausting all available actions. Poll at least once between each action.

For contradictory evidence (logs say done, status stuck): provisioning retry will not help; check billing and run force_billing_reconcile.

Available remediation tools:
- amdocs_oms__retry_order(order_id)
- ericsson__retry_activation(order_id, msisdn="")

After each tool result, write 2-3 sentences of reasoning before deciding the next action.""",
        description="Attempt automatic resolution of the stuck order.",
        tools=[resolve_tools],
        output_key="resolve_output",
    )


def _create_notify_agent() -> Agent:
    notify_tools = _mcp_tools(
        [
            "siebel_crm__get_contact_details",
            "siebel_crm__get_service_requests",
        ],
        timeout_s=30,
    )
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

If you need customer contact info, call siebel_crm__get_contact_details(customer_id) (customer_id should be available in enrich_output).

Then send the email using send_email. Use only data from the inputs provided.""",
        description="Notify escalation owner by email.",
        tools=[notify_tools, tools.lookup_escalation_owner, tools.send_email],
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
