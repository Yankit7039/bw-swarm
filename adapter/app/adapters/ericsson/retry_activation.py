from __future__ import annotations

from app.adapters._mock_scenarios import scenario_for_order_id, tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def retry_activation(order_id: str, msisdn: str = "") -> dict:
    s = scenario_for_order_id(order_id)
    m = msisdn.strip() or f"MSISDN-{order_id}"
    ok = s in (0, 3)
    return AdapterResponse(
        meta=ToolMeta(**tool_meta("ericsson", "retry_activation")),
        data={"order_id": order_id, "msisdn": m, "queued": ok, "message": "Activation retry queued" if ok else "Activation retry not applicable"},
    ).model_dump()

