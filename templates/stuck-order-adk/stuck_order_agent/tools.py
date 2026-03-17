"""In-process tools still used by the template.

All telecom backend tooling (OMS/CRM/Network/Provisioning) is now provided via the adapter MCP
service. The stuck-order template keeps only lightweight notification/escalation tools in-process
for Phase 1.
"""

from google.adk.tools import ToolContext


def lookup_escalation_owner(department: str, severity: str, tool_context: ToolContext) -> dict:
    deps = {
        "provisioning": {"slack_channel": "#provisioning-oncall", "phone": "+34-900-111-001"},
        "billing": {"slack_channel": "#billing-ops", "phone": "+34-900-111-002"},
        "network_ops": {"slack_channel": "#network-ops", "phone": "+34-900-111-003"},
        "customer_care": {"slack_channel": "#care-escalations", "phone": "+34-900-111-004"},
    }
    slas = {"low": 120, "medium": 60, "high": 30, "critical": 15}
    info = deps.get(department, {"slack_channel": "#ops-general", "phone": "+34-900-111-000"})
    return {
        "owner_name": f"On-call {department}",
        "owner_email": f"{department}-oncall@example.com",
        "department": department,
        "severity": severity,
        "slack_channel": info["slack_channel"],
        "phone": info["phone"],
        "sla_response_minutes": slas.get(severity, 60),
    }


def send_email(to: str, subject: str, body: str, tool_context: ToolContext) -> dict:
    return {"sent": True, "to": to, "subject": subject}
