"""swarm_runbook_svc - internal SOP registry."""

from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_runbook(root_cause: str, order_type: str) -> dict:
    """Runbook: Getting runbook

    Fetches the standard operating procedure for a given root cause and order type
    from the internal runbook registry. Returns recommended resolution steps and tool names.
    """
    runbooks = {
        "fraud_clearance_hold": {
            "runbook_id": "RB-FRAUD-001",
            "title": "Fraud Hold Clearance",
            "steps": ["Verify NICE Actimize hold reason", "Check auto_release_eligible", "Call fraud_engine__release_fraud_hold if eligible"],
            "recommended_tools": ["fraud_engine__check_fraud_hold", "fraud_engine__release_fraud_hold"],
        },
        "kyc_failure": {
            "runbook_id": "RB-KYC-001",
            "title": "KYC Retry Workflow",
            "steps": ["Verify liveness_passed in KYC status", "Trigger KYC retry", "Monitor for completion"],
            "recommended_tools": ["fraud_engine__check_kyc_status", "fraud_engine__trigger_kyc_retry"],
        },
        "activation_system_error": {
            "runbook_id": "RB-ESIM-001",
            "title": "eSIM Activation Retry",
            "steps": ["Check SM-DP+ profile status", "Retry activation if profile ready"],
            "recommended_tools": ["esim_manager__check_activation_status", "esim_manager__retry_activation"],
        },
        "account_number_mismatch": {
            "runbook_id": "RB-PORT-001",
            "title": "Port Account Mismatch",
            "steps": ["Get subscriber identity from Siebel", "Correct account in port request", "Resubmit to porting gateway"],
            "recommended_tools": ["siebel_crm__get_subscriber_identity", "porting_gateway__correct_and_resubmit"],
        },
        "dob_mismatch": {
            "runbook_id": "RB-PORT-002",
            "title": "DOB Mismatch Correction",
            "steps": ["Update subscriber record in Siebel", "Resubmit port request"],
            "recommended_tools": ["siebel_crm__update_subscriber_record", "porting_gateway__correct_and_resubmit"],
        },
        "loa_invalid": {
            "runbook_id": "RB-PORT-003",
            "title": "Letter of Authorization",
            "steps": ["Verify LOA form", "Retry port request with corrected LOA reference"],
            "recommended_tools": ["porting_gateway__retry_port_request"],
        },
        "gateway_timeout": {
            "runbook_id": "RB-PORT-004",
            "title": "Porting Gateway Timeout",
            "steps": ["Retry port request", "Escalate if repeated failure"],
            "recommended_tools": ["porting_gateway__retry_port_request"],
        },
        "unknown": {
            "runbook_id": "RB-GEN-001",
            "title": "Generic Troubleshooting",
            "steps": ["Gather all system outputs", "Escalate to L1"],
            "recommended_tools": [],
        },
    }
    rb = runbooks.get(root_cause or "unknown", runbooks["unknown"])
    data = {**rb, "root_cause": root_cause, "order_type": order_type, "system": "swarm_runbook_svc"}
    return AdapterResponse(meta=ToolMeta(**tool_meta("runbook_registry", "get_runbook")), data=data).model_dump()
