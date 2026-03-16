"""Single collective reconciler: deletes SandboxClaims for terminal runs. One loop, one DB query per interval."""

import asyncio
import logging
import os

from runtime.db import get_runs_with_uncleaned_claims, mark_claim_deleted
from runtime.sandbox_trigger import SANDBOX_NAMESPACE, _delete_sandbox_claim

CLAIM_RECONCILER_INTERVAL_SEC = float(os.environ.get("CLAIM_RECONCILER_INTERVAL_SEC", "5"))
LOG = logging.getLogger(__name__)


async def claim_reconciler() -> None:
    """Runs once on startup, handles ALL runs. Every interval: one query, delete claims, mark deleted."""
    while True:
        await asyncio.sleep(CLAIM_RECONCILER_INTERVAL_SEC)
        try:
            rows = await get_runs_with_uncleaned_claims()
        except Exception as e:
            LOG.exception("claim_reconciler: get_runs_with_uncleaned_claims failed: %s", e)
            continue
        for run_id, claim_name in rows:
            _delete_sandbox_claim(claim_name, SANDBOX_NAMESPACE)
            try:
                await mark_claim_deleted(run_id)
            except Exception as e:
                LOG.exception("claim_reconciler: mark_claim_deleted(%s) failed: %s", run_id, e)
