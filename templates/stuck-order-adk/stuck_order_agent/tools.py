"""Mock tools for stuck order resolution — ADK format (dict return, ToolContext for state)."""

from typing import Any

from google.adk.tools import ToolContext

from stuck_order_agent._scenario_state import get_run_state, get_scenario, reset_run_state

# ---------------------------------------------------------------------------
# Order management (from order_management.py)
# ---------------------------------------------------------------------------


def _order_details(order_id: str, scenario: int) -> dict:
    base = {
        "order_id": order_id,
        "system_of_record": "BSS",
        "created_at": "2024-01-15T09:00:00Z",
        "updated_at": "2024-01-15T09:45:00Z",
        "sla_deadline": "2024-01-15T12:00:00Z",
        "priority": "high",
        "channel": "web",
        "region": "eu-west",
        "customer_id": f"CUST-{order_id}",
    }
    scenarios = [
        {**base, "status": "stuck_in_provisioning", "stuck_duration_minutes": 45, "order_type": "new_activation", "error_code": "TIMEOUT_504", "fulfillment_stage": "hlr_provisioning", "last_provisioning_attempt": "2024-01-15T10:03:00Z", "msisdn": "+34600000001", "imsi": "214070000000001", "sim_iccid": "89340765001234567890"},
        {**base, "status": "billing_hold", "stuck_duration_minutes": 120, "order_type": "plan_change", "error_code": "LEDGER_MISMATCH", "fulfillment_stage": "billing_validation", "last_provisioning_attempt": "2024-01-15T08:52:00Z", "msisdn": "+34600000002", "imsi": "214070000000002", "sim_iccid": None},
        {**base, "status": "network_hold", "stuck_duration_minutes": 90, "order_type": "port_in", "error_code": "HOLD_FRAUD", "fulfillment_stage": "port_verification", "last_provisioning_attempt": "2024-01-15T08:01:00Z", "msisdn": "+34600000003", "imsi": "214070000000003", "sim_iccid": "89340765001234567892"},
        {**base, "status": "pending_upstream", "stuck_duration_minutes": 30, "order_type": "upgrade", "error_code": "UPSTREAM_UNAVAILABLE", "fulfillment_stage": "upstream_sync", "last_provisioning_attempt": "2024-01-15T11:00:35Z", "msisdn": "+34600000004", "imsi": "214070000000004", "sim_iccid": "89340765001234567893"},
        {**base, "status": "stuck_in_provisioning", "stuck_duration_minutes": 60, "order_type": "new_activation", "error_code": "UNKNOWN", "fulfillment_stage": "completed", "last_provisioning_attempt": "2024-01-15T10:05:00Z", "msisdn": "+34600000005", "imsi": "214070000000005", "sim_iccid": "89340765001234567894"},
    ]
    return scenarios[min(scenario, 4)]


def _customer_profile(order_id: str, customer_id: str | None, scenario: int) -> dict:
    s = min(scenario, 3)
    profiles = [
        {"customer_id": customer_id or f"CUST-{order_id or 'UNK'}", "customer_name": "Acme Telecom", "customer_type": "enterprise", "plan_name": "Enterprise 500", "plan_tier": "premium", "data_allowance_gb": 500, "voice_minutes": -1, "region": "eu-west", "timezone": "Europe/Madrid", "account_status": "active", "billing_cycle": "monthly", "payment_method": "invoice", "credit_limit": 50000, "contact_email": "ops@acmetelecom.es", "primary_phone": "+34911234567", "account_manager": "Maria Garcia"},
        {"customer_id": customer_id or f"CUST-{order_id or 'UNK'}", "customer_name": "Beta Corp", "customer_type": "smb", "plan_name": "SMB 100", "plan_tier": "business", "data_allowance_gb": 100, "voice_minutes": 2000, "region": "eu-west", "timezone": "Europe/Madrid", "account_status": "active", "billing_cycle": "monthly", "payment_method": "direct_debit", "credit_limit": 5000, "contact_email": "billing@betacorp.es", "primary_phone": "+34912345678", "account_manager": None},
        {"customer_id": customer_id or f"CUST-{order_id or 'UNK'}", "customer_name": "Gamma Inc", "customer_type": "smb", "plan_name": "Starter Unlimited", "plan_tier": "standard", "data_allowance_gb": 20, "voice_minutes": 500, "region": "eu-west", "timezone": "Europe/Lisbon", "account_status": "active", "billing_cycle": "monthly", "payment_method": "card", "credit_limit": 1000, "contact_email": "admin@gammainc.pt", "primary_phone": "+351912345678", "account_manager": None},
        {"customer_id": customer_id or f"CUST-{order_id or 'UNK'}", "customer_name": "Delta Ltd", "customer_type": "enterprise", "plan_name": "Custom Flex", "plan_tier": "custom", "data_allowance_gb": 1000, "voice_minutes": -1, "region": "eu-west", "timezone": "Europe/London", "account_status": "active", "billing_cycle": "monthly", "payment_method": "invoice", "credit_limit": 100000, "contact_email": "telecom@deltaltd.co.uk", "primary_phone": "+442071234567", "account_manager": "James Wilson"},
    ]
    return profiles[s]


def fetch_order_details(order_id: str, tool_context: ToolContext) -> dict:
    """Fetch full order details from BSS for the given order_id."""
    reset_run_state(order_id)
    s = get_scenario(order_id)
    return _order_details(order_id, s)


def fetch_customer_profile(order_id: str, customer_id: str, tool_context: ToolContext) -> dict:
    """Fetch customer profile from CRM. Pass order_id; optionally pass customer_id (or empty string to look up by order_id)."""
    cid = customer_id.strip() or None
    oid = order_id or ""
    s = get_scenario(oid)
    s = min(s, 3)
    return _customer_profile(oid, cid, s)


# ---------------------------------------------------------------------------
# Provisioning audit (from provisioning_audit.py)
# ---------------------------------------------------------------------------


def _entry(ts: str, level: str, event: str, detail: str, source: str = "BSS-PROV", **kw: Any) -> dict:
    e: dict[str, Any] = {"timestamp": ts, "level": level, "event": event, "detail": detail, "source": source}
    e.update(kw)
    return e


def _entries_scenario_0(order_id: str) -> list[dict]:
    trace = "tr-0-" + (order_id or "X")[:8]
    corr = "corr-" + (order_id or "X")[:12]
    return [
        _entry("2024-01-15T09:54:58Z", "INFO", "PROV_START", "Order submitted to BSS", "BSS-PROV", trace_id=trace, correlation_id=corr),
        _entry("2024-01-15T09:54:59Z", "DEBUG", "BILLING_CHECK", "Pre-provision ledger OK", "CRM", trace_id=trace),
        _entry("2024-01-15T09:55:00Z", "INFO", "INVENTORY_RESERVED", "SIM allocated", "OSS-INVENTORY", span_id="inv-001"),
        _entry("2024-01-15T09:56:30Z", "WARN", "HLR_TIMEOUT", "No response within 30s", "OSS-HLR", code="ERR_HLR_7734"),
        _entry("2024-01-15T10:03:00Z", "ERROR", "PROV_ABANDONED", "BSS did not respond within 30s", "BSS-PROV", code="TIMEOUT_504"),
    ]


def _entries_scenario_1(order_id: str) -> list[dict]:
    trace = "tr-1-" + (order_id or "X")[:8]
    return [
        _entry("2024-01-15T08:50:00Z", "INFO", "PROV_START", "Order submitted", "BSS-PROV", trace_id=trace),
        _entry("2024-01-15T08:51:02Z", "WARN", "LEDGER_DELTA", "First month proration 12.50 EUR", "CRM", code="LEDGER_MISMATCH"),
        _entry("2024-01-15T08:52:00Z", "INFO", "HOLD_APPLIED", "Order on hold pending reconcile", "BSS-PROV"),
    ]


def _entries_scenario_2(order_id: str) -> list[dict]:
    trace = "tr-2-" + (order_id or "X")[:8]
    return [
        _entry("2024-01-15T08:00:00Z", "INFO", "PROV_START", "Order submitted", "BSS-PROV", trace_id=trace),
        _entry("2024-01-15T08:01:00Z", "WARN", "NETWORK_HOLD", "FRAUD hold on MSISDN", "OSS-HLR", hold_id="HOLD-8821"),
        _entry("2024-01-15T08:01:05Z", "INFO", "HOLD_ACTIVE", "Hold type: PORTING", "OSS-HLR", hold_id="HOLD-8821"),
    ]


def _entries_scenario_3(order_id: str) -> list[dict]:
    trace = "tr-3-" + (order_id or "X")[:8]
    return [
        _entry("2024-01-15T11:00:00Z", "INFO", "PROV_START", "Order submitted", "BSS-PROV", trace_id=trace),
        _entry("2024-01-15T11:00:35Z", "WARN", "UPSTREAM_CALL_FAILED", "External API 503", "BSS-PROV", code="ERR_UPSTREAM_503"),
    ]


def _entries_contradictory(order_id: str) -> list[dict]:
    trace = "tr-4-" + (order_id or "X")[:8]
    return [
        _entry("2024-01-15T10:00:00Z", "INFO", "PROV_START", "Order submitted", "BSS-PROV", trace_id=trace),
        _entry("2024-01-15T10:05:00Z", "INFO", "PROV_COMPLETE", "Provisioning completed successfully", "BSS-PROV"),
        _entry("2024-01-15T10:05:01Z", "INFO", "STATUS_UPDATE", "Order marked completed in BSS", "BSS-PROV"),
    ]


def query_provisioning_logs(order_id: str, limit: int, offset: int, tool_context: ToolContext) -> dict:
    """Query provisioning logs for errors or timeouts for this order. Returns a page of entries; use limit and offset to paginate (e.g. limit=10, offset=0 for first page). Check has_more and total_count."""
    s = get_scenario(order_id)
    if s == 4:
        all_entries = _entries_contradictory(order_id)
    elif s == 0:
        all_entries = _entries_scenario_0(order_id)
    elif s == 1:
        all_entries = _entries_scenario_1(order_id)
    elif s == 2:
        all_entries = _entries_scenario_2(order_id)
    else:
        all_entries = _entries_scenario_3(order_id)
    total = len(all_entries)
    entries = all_entries[offset : offset + limit]
    return {
        "order_id": order_id,
        "entries": entries,
        "count": len(entries),
        "total_count": total,
        "offset": offset,
        "has_more": offset + len(entries) < total,
    }


# ---------------------------------------------------------------------------
# Billing (from billing_revenue.py)
# ---------------------------------------------------------------------------


def _line_items(order_id: str, scenario: int) -> list[dict]:
    if scenario == 0:
        return [
            {"timestamp": "2024-01-14T00:00:00Z", "type": "recurring", "amount": 29.99, "currency": "EUR", "description": "Monthly plan", "status": "posted"},
            {"timestamp": "2024-01-15T09:00:00Z", "type": "one_time", "amount": 0.00, "currency": "EUR", "description": "Activation fee (waived)", "status": "pending"},
        ]
    if scenario == 1:
        return [
            {"timestamp": "2024-01-14T00:00:00Z", "type": "recurring", "amount": 29.99, "currency": "EUR", "description": "Monthly plan", "status": "posted"},
            {"timestamp": "2024-01-15T00:00:00Z", "type": "proration", "amount": 12.50, "currency": "EUR", "description": "First month proration", "status": "mismatch", "reconciliation_status": "pending"},
            {"timestamp": "2024-01-15T09:00:00Z", "type": "hold", "amount": 0, "currency": "EUR", "description": "Order on hold", "status": "active"},
        ]
    if scenario == 2:
        return [
            {"timestamp": "2024-01-14T00:00:00Z", "type": "recurring", "amount": 19.99, "currency": "EUR", "description": "Monthly plan", "status": "posted"},
            {"timestamp": "2024-01-15T08:00:01Z", "type": "hold", "amount": 0, "currency": "EUR", "description": "Manual review required", "status": "active"},
        ]
    if scenario == 3:
        return [
            {"timestamp": "2024-01-14T00:00:00Z", "type": "recurring", "amount": 39.99, "currency": "EUR", "description": "Monthly plan", "status": "posted"},
            {"timestamp": "2024-01-15T11:00:00Z", "type": "pending", "amount": 0, "currency": "EUR", "description": "Upstream sync pending", "status": "pending"},
        ]
    return [
        {"timestamp": "2024-01-14T00:00:00Z", "type": "recurring", "amount": 29.99, "currency": "EUR", "description": "Monthly plan", "status": "posted"},
        {"timestamp": "2024-01-15T10:05:00Z", "type": "one_time", "amount": 5.00, "currency": "EUR", "description": "Activation", "status": "pending", "collected": False},
    ]


def check_billing_ledger(order_id: str, tool_context: ToolContext) -> dict:
    """Check billing ledger for mismatches or holds for this order."""
    s = min(get_scenario(order_id), 4)
    items = _line_items(order_id, s)
    return {"order_id": order_id, "line_items": items, "count": len(items)}


# ---------------------------------------------------------------------------
# Network OSS (from network_oss.py)
# ---------------------------------------------------------------------------

HOLD_DETAILS: dict[str, dict] = {
    "HOLD-8821": {"hold_id": "HOLD-8821", "type": "PORTING", "reason": "Port-in verification pending", "created": "2024-01-15T08:01:00Z", "status": "active", "applied_by": "OSS-HLR"},
    "HOLD-7702": {"hold_id": "HOLD-7702", "type": "BILLING", "reason": "Ledger mismatch", "created": "2024-01-15T09:05:00Z", "status": "active", "applied_by": "BSS-BILLING"},
    "HOLD-9910": {"hold_id": "HOLD-9910", "type": "FRAUD", "reason": "Manual review required", "created": "2024-01-15T08:01:00Z", "status": "active", "applied_by": "OSS-HLR"},
}


def _network_status(msisdn: str, order_id: str, scenario: int) -> dict:
    s = scenario if scenario < 4 else 0
    base = {"msisdn": msisdn, "order_id": order_id, "subscriber_status": "active", "roaming_status": "home"}
    statuses = [
        {"hold": False, "detail": "No network hold", **base},
        {"hold": True, "hold_type": "BILLING", "detail": "Billing reconciliation hold", **base},
        {"hold": True, "hold_type": "FRAUD", "detail": "Fraud prevention hold", **base},
        {"hold": True, "hold_type": "PORTING", "detail": "Port-in verification hold", **base},
    ]
    return statuses[s]


def _network_events(msisdn: str, scenario: int) -> list[dict]:
    s = scenario if scenario < 4 else 0
    if s == 0:
        return [
            {"timestamp": "2024-01-15T09:56:00Z", "event": "HLR_QUERY_START", "detail": "Querying HLR for MSISDN"},
            {"timestamp": "2024-01-15T09:56:30Z", "event": "HLR_TIMEOUT", "code": "ERR_HLR_7734", "detail": "No response within 30s"},
        ]
    if s in (2, 3):
        return [
            {"timestamp": "2024-01-15T08:01:00Z", "event": "NETWORK_HOLD", "hold_id": "HOLD-8821", "detail": "Hold applied"},
            {"timestamp": "2024-01-15T08:01:05Z", "event": "HOLD_ACTIVE", "hold_id": "HOLD-8821", "detail": "Port-in verification"},
        ]
    return [
        {"timestamp": "2024-01-15T09:00:00Z", "event": "BILLING_CHECK", "detail": "Ledger check"},
        {"timestamp": "2024-01-15T09:05:00Z", "event": "HOLD_APPLIED", "hold_id": "HOLD-7702", "detail": "Billing hold"},
    ]


def check_network_status(order_id: str, msisdn: str, tool_context: ToolContext) -> dict:
    """Check network status and active holds. Pass order_id; msisdn can be from order context or a placeholder like MSISDN-{order_id}."""
    oid = order_id or ""
    m = msisdn or f"MSISDN-{oid}"
    s = get_scenario(oid)
    return _network_status(m, oid, s)


def get_network_events(msisdn: str, hours: int, tool_context: ToolContext) -> dict:
    """Get raw network event log for MSISDN. Returns events with hold_id references; call get_hold_details(hold_id) for details. hours: lookback (e.g. 24)."""
    oid = msisdn.replace("MSISDN-", "") if "MSISDN-" in msisdn else msisdn
    s = get_scenario(oid)
    events = _network_events(msisdn, s)
    return {"msisdn": msisdn, "hours": hours, "events": events}


def get_hold_details(hold_id: str, tool_context: ToolContext) -> dict:
    """Get details for a hold. Call after finding hold_id in get_network_events or provisioning logs."""
    return HOLD_DETAILS.get(
        hold_id,
        {"hold_id": hold_id, "type": "unknown", "reason": "No details", "status": "unknown", "created": None, "applied_by": None},
    )


# ---------------------------------------------------------------------------
# Resolution support (from resolution_support.py)
# ---------------------------------------------------------------------------

ERROR_CODES: dict[str, dict] = {
    "ERR_HLR_7734": {"code": "ERR_HLR_7734", "meaning": "HLR timeout", "action": "Retry HLR query or check HLR availability", "severity": "high"},
    "TIMEOUT_504": {"code": "TIMEOUT_504", "meaning": "BSS gateway timeout", "action": "Trigger provisioning retry", "severity": "high"},
    "ERR_UPSTREAM_503": {"code": "ERR_UPSTREAM_503", "meaning": "Upstream API unavailable", "action": "Wait and retry or escalate", "severity": "medium"},
    "LEDGER_MISMATCH": {"code": "LEDGER_MISMATCH", "meaning": "Billing ledger mismatch", "action": "Run force_billing_reconcile", "severity": "high"},
    "HOLD_FRAUD": {"code": "HOLD_FRAUD", "meaning": "Fraud or port-in hold on MSISDN", "action": "Release network hold after verification", "severity": "medium"},
    "UPSTREAM_UNAVAILABLE": {"code": "UPSTREAM_UNAVAILABLE", "meaning": "External dependency unavailable", "action": "Retry later or escalate", "severity": "medium"},
    "UNKNOWN": {"code": "UNKNOWN", "meaning": "Unknown code", "action": "Check documentation or escalate", "severity": "unknown"},
}


def _similar_cases_raw(scenario: int) -> list[dict]:
    if scenario == 0:
        return [{"case_id": "C-1001", "symptom": "Timeout 504", "relevance_score": 0.92, "tried": ["trigger_provisioning_retry"], "outcome": "worked", "notes": "Success rate 85%", "department": "provisioning"}, {"case_id": "C-1002", "symptom": "ERR_HLR_7734", "relevance_score": 0.88, "tried": ["retry after 5m"], "outcome": "worked", "notes": "HLR was transiently slow", "department": "provisioning"}]
    if scenario == 1:
        return [{"case_id": "C-2001", "symptom": "Ledger mismatch", "relevance_score": 0.95, "tried": ["force_billing_reconcile", "poll_order_status"], "outcome": "worked", "notes": "Proration corrected", "department": "billing"}]
    if scenario == 2:
        return [{"case_id": "C-3001", "symptom": "Network hold PORTING", "relevance_score": 0.93, "tried": ["release_network_hold", "trigger_provisioning_retry"], "outcome": "worked", "notes": "Then retry provisioning", "department": "network_ops"}]
    if scenario == 3:
        return [{"case_id": "C-4001", "symptom": "Upstream 503", "relevance_score": 0.91, "tried": ["wait 1h", "trigger_provisioning_retry"], "outcome": "worked", "notes": "API recovered", "department": "provisioning"}]
    return [{"case_id": "C-5001", "symptom": "Logs say completed but status stuck", "relevance_score": 0.94, "tried": ["poll_order_status", "force_billing_reconcile"], "outcome": "worked", "notes": "Pending charge was blocking", "department": "billing"}]


def _case_details_by_id() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for sc in range(5):
        for c in _similar_cases_raw(sc):
            out[c["case_id"]] = {k: c[k] for k in ["tried", "outcome", "notes", "department"] if k in c}
    return out


_CASE_DETAILS = _case_details_by_id()


def lookup_error_code(code: str, tool_context: ToolContext) -> dict:
    """Look up what an opaque error code (e.g. ERR_HLR_7734, TIMEOUT_504) means."""
    return ERROR_CODES.get(code, {"code": code, "meaning": "Unknown code", "action": "Check documentation or escalate", "severity": "unknown"})


def search_similar_cases(order_id: str, query: str, tool_context: ToolContext) -> dict:
    """Search similar resolved cases for this order. Returns case_id, symptom, relevance_score. Call get_case_details(case_id) for resolution hints."""
    s = get_scenario(order_id)
    raw = _similar_cases_raw(s)
    cases = [{"case_id": c["case_id"], "symptom": c["symptom"], "relevance_score": c["relevance_score"]} for c in raw]
    return {"query": query or order_id, "cases": cases, "count": len(cases)}


def get_case_details(case_id: str, tool_context: ToolContext) -> dict:
    """Get resolution details for a case. Call after search_similar_cases to see what was tried and the outcome."""
    details = _CASE_DETAILS.get(case_id, {"tried": ["unknown"], "outcome": "unknown", "notes": "Case not found", "department": None})
    return {"case_id": case_id, **details}


def trigger_provisioning_retry(order_id: str, tool_context: ToolContext) -> dict:
    """Trigger a provisioning retry for the order."""
    s = get_scenario(order_id)
    if s == 4:
        return {"success": True, "order_id": order_id, "message": "Retry queued (provisioning already complete)"}
    if s in (0, 3):
        get_run_state(order_id)["remediations"].append("trigger_provisioning_retry")
        return {"success": True, "order_id": order_id, "message": "Retry triggered"}
    return {"success": False, "order_id": order_id, "message": "Already in progress or not applicable"}


def force_billing_reconcile(order_id: str, tool_context: ToolContext) -> dict:
    """Force billing reconciliation for the order."""
    s = get_scenario(order_id)
    if s in (1, 4):
        get_run_state(order_id)["remediations"].append("force_billing_reconcile")
        return {"success": True, "order_id": order_id, "message": "Reconcile completed"}
    return {"success": False, "order_id": order_id, "message": "Reconcile failed"}


def release_network_hold(order_id: str, msisdn: str, tool_context: ToolContext) -> dict:
    """Release network hold for the given order or MSISDN. Pass msisdn from order context or empty string."""
    s = get_scenario(order_id)
    if s in (2, 3):
        get_run_state(order_id)["remediations"].append("release_network_hold")
        return {"success": True, "order_id": order_id, "message": "Hold released"}
    return {"success": False, "order_id": order_id, "message": "Hold still active or not applicable"}


def poll_order_status(order_id: str, tool_context: ToolContext) -> dict:
    """Poll current order status. Status may change after remediation actions; poll after each action."""
    s = get_scenario(order_id)
    state = get_run_state(order_id)
    state["poll_count"] = state.get("poll_count", 0) + 1
    remediations = state.get("remediations", [])

    if s == 4:
        if "force_billing_reconcile" in remediations:
            return {"order_id": order_id, "status": "completed"}
        return {"order_id": order_id, "status": "stuck_in_provisioning"}
    if s == 0:
        if "trigger_provisioning_retry" in remediations:
            return {"order_id": order_id, "status": "completed" if state["poll_count"] >= 2 else "in_progress"}
        return {"order_id": order_id, "status": "stuck_in_provisioning"}
    if s == 1:
        if "force_billing_reconcile" in remediations:
            return {"order_id": order_id, "status": "completed"}
        return {"order_id": order_id, "status": "billing_hold"}
    if s in (2, 3):
        if "release_network_hold" in remediations or "trigger_provisioning_retry" in remediations:
            return {"order_id": order_id, "status": "completed"}
        return {"order_id": order_id, "status": "network_hold" if s == 2 else "pending_upstream"}
    return {"order_id": order_id, "status": "unknown"}


def _escalation_owner(department: str, severity: str) -> dict:
    deps = {"provisioning": {"slack_channel": "#provisioning-oncall", "phone": "+34-900-111-001"}, "billing": {"slack_channel": "#billing-ops", "phone": "+34-900-111-002"}, "network_ops": {"slack_channel": "#network-ops", "phone": "+34-900-111-003"}, "customer_care": {"slack_channel": "#care-escalations", "phone": "+34-900-111-004"}}
    slas = {"low": 120, "medium": 60, "high": 30, "critical": 15}
    info = deps.get(department, {"slack_channel": "#ops-general", "phone": "+34-900-111-000"})
    return {"owner_name": f"On-call {department}", "owner_email": f"{department}-oncall@example.com", "department": department, "severity": severity, "slack_channel": info["slack_channel"], "phone": info["phone"], "sla_response_minutes": slas.get(severity, 60)}


def lookup_escalation_owner(department: str, severity: str, tool_context: ToolContext) -> dict:
    """Look up the escalation owner for the given department and severity (e.g. provisioning, billing; low, medium, high, critical)."""
    return _escalation_owner(department, severity)


def send_email(to: str, subject: str, body: str, tool_context: ToolContext) -> dict:
    """Send an email to the given address."""
    return {"sent": True, "to": to, "subject": subject}
