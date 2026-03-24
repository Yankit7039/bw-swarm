"""Mock ticket tied to an order — includes department for escalation routing."""

from __future__ import annotations

from app.adapters._mock_scenarios import now_iso, ticket_email_routing_indices, tool_meta
from app.models.responses import AdapterResponse, ToolMeta

# Must match escalation_matrix lookup keys (order matches dept_idx 0..3)
_DEPARTMENTS = ("billing", "porting", "network_provisioning", "field_ops")

# issue_idx 0..3 per department — blocked reason / next action for demos and LLM email context
_ISSUE_SCENARIOS: dict[str, tuple[dict[str, str], ...]] = {
    "billing": (
        {
            "issue_code": "BILL-01",
            "issue_label": "Proration dispute",
            "blocked_reason": "Latest invoice proration does not match the quoted plan change.",
            "next_action": "Re-run billing reconciliation for the plan-change window and confirm credits.",
            "customer_impact": "Customer is refusing payment until amounts align.",
        },
        {
            "issue_code": "BILL-02",
            "issue_label": "Payment hold",
            "blocked_reason": "Auto-pay failed twice; account is in soft collections.",
            "next_action": "Validate card on file and remove duplicate billing holds if cleared.",
            "customer_impact": "Service may suspend if not resolved within policy.",
        },
        {
            "issue_code": "BILL-03",
            "issue_label": "Tax / regulatory fee mismatch",
            "blocked_reason": "Regional surcharges on the order do not match jurisdiction tables.",
            "next_action": "Apply correct tax profile and regenerate the order charges.",
            "customer_impact": "Order cannot complete finance approval.",
        },
        {
            "issue_code": "BILL-04",
            "issue_label": "Deposit / credit block",
            "blocked_reason": "Security deposit not released after equipment return.",
            "next_action": "Confirm RMA receipt and release deposit per policy.",
            "customer_impact": "Customer escalated to executive desk.",
        },
    ),
    "porting": (
        {
            "issue_code": "PORT-01",
            "issue_label": "LNP reject — mismatch",
            "blocked_reason": "Losing carrier rejected the port due to account/address mismatch.",
            "next_action": "Collect corrected CSR and resubmit the port request.",
            "customer_impact": "Number still active on old carrier.",
        },
        {
            "issue_code": "PORT-02",
            "issue_label": "Drop / cancel in flight",
            "blocked_reason": "Customer requested drop; partial port already acknowledged upstream.",
            "next_action": "Coordinate cancel vs complete with NPAC window before cutoff.",
            "customer_impact": "Risk of dual billing or loss of number.",
        },
        {
            "issue_code": "PORT-03",
            "issue_label": "PIN / auth failure",
            "blocked_reason": "PIN validation failed at donor; three attempts used.",
            "next_action": "Re-initiate PIN flow with customer and donor-validated auth.",
            "customer_impact": "Port timer paused.",
        },
        {
            "issue_code": "PORT-04",
            "issue_label": "Resporg / routing delay",
            "blocked_reason": "Resporg change pending; trunk not updated for new range.",
            "next_action": "Push routing update and confirm with interconnect partner.",
            "customer_impact": "Inbound calls may fail intermittently.",
        },
    ),
    "network_provisioning": (
        {
            "issue_code": "NET-01",
            "issue_label": "SIM / profile delay",
            "blocked_reason": "HSS profile not built; activation stuck at provisioning queue.",
            "next_action": "Clear provisioning error and re-push profile to HSS.",
            "customer_impact": "No data/voice on new SIM.",
        },
        {
            "issue_code": "NET-02",
            "issue_label": "APN / data routing",
            "blocked_reason": "Incorrect APN attached to subscriber record for this plan.",
            "next_action": "Correct APN on subscription and bounce data session.",
            "customer_impact": "Data works only on Wi-Fi.",
        },
        {
            "issue_code": "NET-03",
            "issue_label": "Backhaul capacity",
            "blocked_reason": "Cell site backhaul at capacity; throttling new activations.",
            "next_action": "Schedule capacity uplift or re-home to alternate RAN node.",
            "customer_impact": "Degraded throughput in peak hours.",
        },
        {
            "issue_code": "NET-04",
            "issue_label": "Core timeout",
            "blocked_reason": "Provisioning callback from core timed out after retries.",
            "next_action": "Manual reconcile in core and mark order ready for activation.",
            "customer_impact": "Order past internal SLA.",
        },
    ),
    "field_ops": (
        {
            "issue_code": "FLD-01",
            "issue_label": "Install window",
            "blocked_reason": "Customer missed first dispatch; reschedule required before closeout.",
            "next_action": "Book next available slot and confirm access instructions.",
            "customer_impact": "CPE not delivered; circuit not turned up.",
        },
        {
            "issue_code": "FLD-02",
            "issue_label": "On-site swap",
            "blocked_reason": "Faulty ONT; swap parts not on truck.",
            "next_action": "Dispatch with correct SKU and validate optical levels post-swap.",
            "customer_impact": "Intermittent drops.",
        },
        {
            "issue_code": "FLD-03",
            "issue_label": "Access / entry",
            "blocked_reason": "Site contact unavailable; technician could not enter MDF.",
            "next_action": "Coordinate building access and reschedule within SLA.",
            "customer_impact": "Business line still down.",
        },
        {
            "issue_code": "FLD-04",
            "issue_label": "Safety hold",
            "blocked_reason": "Demarcation wiring fails safety checklist.",
            "next_action": "Engage certified electrician or customer remediation before work resume.",
            "customer_impact": "Work order on hold.",
        },
    ),
}


def get_ticket_by_order(order_id: str) -> dict:
    oid = (order_id or "").strip() or "ORD-UNK"
    dept_idx, issue_idx = ticket_email_routing_indices(oid)
    department = _DEPARTMENTS[dept_idx]
    scenarios = _ISSUE_SCENARIOS[department]
    scenario = scenarios[issue_idx]
    subject = f"{scenario['issue_label']} — order blocked"
    description = (
        f"{scenario['blocked_reason']} Suggested next step: {scenario['next_action']}"
    )
    data = {
        "order_id": oid,
        "department": department,
        "issue_code": scenario["issue_code"],
        "issue_label": scenario["issue_label"],
        "blocked_reason": scenario["blocked_reason"],
        "next_action": scenario["next_action"],
        "customer_impact": scenario["customer_impact"],
        "subject": subject,
        "description": description,
        "status": "open" if department != "field_ops" or issue_idx != 3 else "pending",
        "created_at": now_iso(),
        "system": "Oracle Siebel CRM",
    }
    return AdapterResponse(meta=ToolMeta(**tool_meta("siebel_crm", "get_ticket_by_order")), data=data).model_dump()
