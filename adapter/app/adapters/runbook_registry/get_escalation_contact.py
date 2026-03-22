"""swarm_runbook_svc - escalation contact lookup."""

from __future__ import annotations

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta

_MATRIX = {
    ("P1", "L1", "esim_activation"): {"team": "Fraud Operations", "contact": "fraud-ops@carrier.com", "sla_minutes": 15},
    ("P1", "L2", "esim_activation"): {"team": "Fraud Ops Lead", "contact": "fraud-ops-lead@carrier.com", "sla_minutes": 30},
    ("P1", "L3", "esim_activation"): {"team": "Digital Service Manager", "contact": "digital-svc-mgr@carrier.com", "sla_minutes": 60},
    ("P1", "L1", "number_porting"): {"team": "Porting Operations", "contact": "porting-ops@carrier.com", "sla_minutes": 15},
    ("P1", "L2", "number_porting"): {"team": "Porting Lead", "contact": "porting-lead@carrier.com", "sla_minutes": 30},
    ("P1", "L3", "number_porting"): {"team": "Customer Ops Manager", "contact": "customer-ops-mgr@carrier.com", "sla_minutes": 60},
}


def get_escalation_contact(priority: str, level: str, order_type: str) -> dict:
    key = (priority or "P1", level or "L1", order_type or "esim_activation")
    contact = _MATRIX.get(key, _MATRIX.get(("P1", "L1", "esim_activation")))
    data = {**contact, "priority": priority, "level": level, "order_type": order_type, "system": "swarm_runbook_svc"}
    return AdapterResponse(meta=ToolMeta(**tool_meta("runbook_registry", "get_escalation_contact")), data=data).model_dump()
