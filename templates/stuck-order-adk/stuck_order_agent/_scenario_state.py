"""Shared scenario state for correlated mock tool responses across order_id."""

from typing import Any

SCENARIO_ORDER_IDS = {
    "ORDER-TIMEOUT": 0,
    "ORDER-BILLING": 1,
    "ORDER-NETWORK": 2,
    "ORDER-UPSTREAM": 3,
    "ORDER-CONTRADICTORY": 4,
}

_run_state: dict[str, dict[str, Any]] = {}


def get_scenario(order_id: str) -> int:
    """Map order_id to scenario 0..4. Unknown IDs fall back to 0."""
    return SCENARIO_ORDER_IDS.get(order_id, 0)


def get_run_state(order_id: str) -> dict[str, Any]:
    """Ensure run state exists for this order."""
    if order_id not in _run_state:
        _run_state[order_id] = {"remediations": [], "poll_count": 0}
    return _run_state[order_id]


def reset_run_state(order_id: str) -> None:
    """Reset run-scoped state for this order (called at start of enrich)."""
    _run_state[order_id] = {"remediations": [], "poll_count": 0}
