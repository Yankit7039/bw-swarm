"""Poll for runs due for follow-up; claim, emit event, trigger sandbox pod."""

import asyncio
import logging
import os
from uuid import UUID

from runtime.db import claim_followup_run, fetch_due_followup_runs, insert_run_event
from runtime.sandbox_trigger import trigger_sandbox_post_run

FOLLOWUP_POLLER_INTERVAL_SEC = float(os.environ.get("FOLLOWUP_POLLER_INTERVAL_SEC", "5"))
LOG = logging.getLogger(__name__)


def _followup_number_from_state(state: dict | None) -> int:
    if not state or not isinstance(state, dict):
        return 1
    try:
        n = int(state.get("follow_up_count", 0))
    except (TypeError, ValueError):
        n = 0
    return max(1, n + 1)


async def followup_poller() -> None:
    while True:
        await asyncio.sleep(FOLLOWUP_POLLER_INTERVAL_SEC)
        try:
            due = await fetch_due_followup_runs()
        except Exception:
            LOG.exception("followup_poller: fetch_due_followup_runs failed")
            continue

        for run_id, template_id, payload, state in due:
            run_uuid = run_id if isinstance(run_id, UUID) else UUID(str(run_id))
            try:
                claimed = await claim_followup_run(run_uuid)
            except Exception:
                LOG.exception("followup_poller: claim_followup_run failed run_id=%s", run_id)
                continue
            if not claimed:
                continue

            fn = _followup_number_from_state(state)
            try:
                await insert_run_event(
                    run_uuid,
                    "followup_started",
                    (
                        f"Follow-up {fn} has started for this run; the workflow will check "
                        f"ticket status and send a reply if the ticket is still open."
                    ),
                    {
                        "follow_up_number": fn,
                        "run_id": str(run_uuid),
                        "template_id": template_id,
                    },
                )
            except Exception:
                LOG.exception("followup_poller: insert_run_event followup_started failed run_id=%s", run_id)

            merged = dict(payload) if isinstance(payload, dict) else {}
            merged["followup_context"] = state if isinstance(state, dict) else {}

            try:
                await trigger_sandbox_post_run(run_uuid, template_id, merged)
            except Exception:
                LOG.exception("followup_poller: trigger_sandbox_post_run failed run_id=%s", run_id)
