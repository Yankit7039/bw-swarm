from __future__ import annotations

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_serial_lookup(identifier: str) -> dict:
    return AdapterResponse(
        meta=ToolMeta(**tool_meta("netcracker", "get_serial_lookup")),
        data={"identifier": identifier, "serial": f"SER-{(identifier or 'UNK')[-8:]}"},
    ).model_dump()

