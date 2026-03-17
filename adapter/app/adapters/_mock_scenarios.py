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


def now_iso() -> str:
    # Keep deterministic-ish timestamps out of scope for now; return a plausible constant.
    return "2024-01-15T10:05:00Z"


def tool_meta(adapter: str, tool: str) -> dict[str, Any]:
    return {"adapter": adapter, "tool": tool, "mock": True}

