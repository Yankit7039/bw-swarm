from __future__ import annotations

from typing import Any

from app.adapters._mcp_register import register_tool

from .get_account_status import get_account_status
from .get_billing_flags import get_billing_flags
from .get_contact_details import get_contact_details
from .get_service_requests import get_service_requests
from .lookup_customer import lookup_customer


def register_siebel_crm_tools(mcp: Any) -> None:
    register_tool(mcp, name="siebel_crm__lookup_customer", fn=lookup_customer)
    register_tool(mcp, name="siebel_crm__get_account_status", fn=get_account_status)
    register_tool(mcp, name="siebel_crm__get_billing_flags", fn=get_billing_flags)
    register_tool(mcp, name="siebel_crm__get_service_requests", fn=get_service_requests)
    register_tool(mcp, name="siebel_crm__get_contact_details", fn=get_contact_details)

