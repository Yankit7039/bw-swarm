"""Shared scenario state for correlated mock tool responses across order_id."""

from typing import Any
import re

_run_state: dict[str, dict[str, Any]] = {}


def get_scenario(order_id: str) -> int:
    """Map order_id to scenario 0..4 using numeric suffix modulo 5. Unknown/non-numeric IDs fall back to 0."""
    if not order_id:
        return 0

    # Use the last numeric substring in the order_id (e.g. OH-159 -> 159, ORDER-42 -> 42, "159" -> 159).
    matches = re.findall(r"\d+", order_id)
    if not matches:
        return 0

    n = int(matches[-1])
    return n % 5


def get_run_state(order_id: str) -> dict[str, Any]:
    """Ensure run state exists for this order."""
    if order_id not in _run_state:
        _run_state[order_id] = {"remediations": [], "poll_count": 0}
    return _run_state[order_id]


def reset_run_state(order_id: str) -> None:
    """Reset run-scoped state for this order (called at start of enrich)."""
    _run_state[order_id] = {"remediations": [], "poll_count": 0}
