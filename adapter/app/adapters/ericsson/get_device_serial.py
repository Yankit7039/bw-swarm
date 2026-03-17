from __future__ import annotations

from app.adapters._mock_scenarios import tool_meta
from app.models.responses import AdapterResponse, ToolMeta


def get_device_serial(imsi: str) -> dict:
    serial = f"DEV-{(imsi or 'UNK')[-6:]}-SN"
    return AdapterResponse(meta=ToolMeta(**tool_meta("ericsson", "get_device_serial")), data={"imsi": imsi, "device_serial": serial}).model_dump()

