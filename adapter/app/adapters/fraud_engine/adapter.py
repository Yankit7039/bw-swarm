from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .check_fraud_hold import check_fraud_hold
from .check_kyc_status import check_kyc_status
from .release_fraud_hold import release_fraud_hold
from .trigger_kyc_retry import trigger_kyc_retry


def register_fraud_engine_tools(mcp: Any) -> None:
    register_tool(mcp, name="fraud_engine__check_fraud_hold", fn=check_fraud_hold)
    register_tool(mcp, name="fraud_engine__check_kyc_status", fn=check_kyc_status)
    register_tool(mcp, name="fraud_engine__release_fraud_hold", fn=release_fraud_hold)
    register_tool(mcp, name="fraud_engine__trigger_kyc_retry", fn=trigger_kyc_retry)
