from __future__ import annotations

import hashlib
from typing import Any


def scenario_for_order_id(order_id: str) -> int:
    """
    Derive a stable scenario index [0..4] from order_id.

    Aligns with the stuck-order template's 5 scenarios without requiring shared state.
    """
    raw = (order_id or "ORD-UNK").encode("utf-8")
    h = hashlib.sha256(raw).hexdigest()
    return int(h[:8], 16) % 5


def resolution_bucket_for_order_id(order_id: str) -> int:
    """
    Used with get_order_status(use_resolution_buckets=True): bucket 0 returns COMPLETED at route;
    buckets 1–3 return stuck_in_provisioning at route (escalation in follow_up).

    ORDER-001 → 0, ORDER-002 → 1, … ORDER-004 → 3, ORDER-005 → 0 (cycles).
    """
    suffix = (order_id or "").upper().split("-")[-1]
    mapping = {"001": 0, "002": 1, "003": 2, "004": 3}
    idx = int(suffix) if suffix.isdigit() else 1
    key = f"{(idx - 1) % 4 + 1:03d}"
    return mapping.get(key, (idx - 1) % 4)


def ticket_email_routing_indices(order_id: str) -> tuple[int, int]:
    """
    Deterministic department + issue row for ticket-email-routing mock data only.

    Parses the last hyphen segment as an integer when possible (ORDER-001 → 1, ORD-123 → 123).
    Non-numeric suffixes behave like n=1.

    - dept_idx = (n - 1) % 4  → billing, porting, network_provisioning, field_ops cycle
    - issue_idx = ((n - 1) // 4) % 4  → four distinct blocked-reason templates per department lane
    """
    suffix = (order_id or "").strip().upper().split("-")[-1]
    if suffix.isdigit():
        n = int(suffix)
    else:
        n = 1
    if n < 1:
        n = 1
    dept_idx = (n - 1) % 4
    issue_idx = ((n - 1) // 4) % 4
    return dept_idx, issue_idx


def now_iso() -> str:
    # Keep deterministic-ish timestamps out of scope for now; return a plausible constant.
    return "2024-01-15T10:05:00Z"


def tool_meta(adapter: str, tool: str) -> dict[str, Any]:
    return {"adapter": adapter, "tool": tool, "mock": True}
