"""Drain queued AgentMail inbound (FIFO by created_at) when the run becomes claimable."""

import asyncio
import logging
import os

from runtime.db import (
    fetch_oldest_unprocessed_pending,
    get_communication_route,
    get_run,
    insert_run_event,
    mark_pending_processed_by_id,
    try_claim_run_for_reply,
)
from runtime.sandbox_trigger import trigger_sandbox_post_run

PENDING_REPLY_WORKER_INTERVAL_SEC = float(os.environ.get("PENDING_REPLY_WORKER_INTERVAL_SEC", "5"))
LOG = logging.getLogger(__name__)


async def _mark_dead_letter(pending_id: int, thread_id: str, reason: str, detail: str = "") -> None:
    """Drop a permanently unprocessable pending row so FIFO can advance."""
    if not await mark_pending_processed_by_id(pending_id):
        return
    LOG.warning(
        "pending_reply_worker: dead-letter reason=%s pending_id=%s thread_id=%s %s",
        reason,
        pending_id,
        thread_id,
        detail.strip(),
    )
    LOG.info(
        "pending_reply_worker: marked pending inbound processed pending_id=%s thread_id=%s",
        pending_id,
        thread_id,
    )


def build_reply_merge_payload(
    run: dict,
    thread_id: str,
    body: dict,
    *,
    reply_prior_status: str,
    pending_inbound_id: int | None = None,
) -> dict:
    """Same merge shape as AgentMail webhook after a successful claim."""
    st = run.get("state") if isinstance(run.get("state"), dict) else {}
    base_payload = dict(run.get("payload") or {}) if isinstance(run.get("payload"), dict) else {}
    msg = body.get("message")
    if not isinstance(msg, dict):
        msg = {}
    ext = msg.get("extracted_text")
    if ext is not None and str(ext).strip():
        reply_body = str(ext).strip()
    else:
        t = msg.get("text")
        reply_body = str(t).strip() if t is not None else ""
    raw_from = msg.get("from")
    inbound_mid = msg.get("message_id")
    merged = {
        **base_payload,
        "thread_state": st,
        "reply_context": {
            "body": reply_body,
            "from": raw_from if isinstance(raw_from, list) else raw_from,
            "inbound_message_id": str(inbound_mid).strip() if inbound_mid else None,
            "thread_id": thread_id,
        },
        "reply_prior_status": reply_prior_status,
    }
    if pending_inbound_id is not None:
        merged["pending_inbound_id"] = pending_inbound_id
    return merged


async def pending_reply_worker() -> None:
    while True:
        await asyncio.sleep(PENDING_REPLY_WORKER_INTERVAL_SEC)
        try:
            row = await fetch_oldest_unprocessed_pending()
            if row is None:
                continue
            pending_id, thread_id, body = row
            if not isinstance(body, dict):
                await _mark_dead_letter(pending_id, thread_id, "invalid_body", "payload is not a JSON object")
                continue
            route = await get_communication_route(thread_id)
            if route is None:
                await _mark_dead_letter(pending_id, thread_id, "no_route", "communication_threads has no row")
                continue
            run_id, template_id = route
            run = await get_run(run_id)
            if run is None:
                await _mark_dead_letter(pending_id, thread_id, "run_missing", f"run_id={run_id}")
                continue
            status = run.get("status") or ""
            fup = bool(run.get("follow_up_in_progress"))
            busy = status in ("pending", "running", "processing_reply") or fup
            if busy:
                continue
            if status not in ("waiting_for_followup", "exhausted"):
                await _mark_dead_letter(
                    pending_id, thread_id, "run_terminal_status", f"status={status!r}"
                )
                continue
            prior = str(status).strip()
            claimed = await try_claim_run_for_reply(run_id)
            if not claimed:
                continue
            merged = build_reply_merge_payload(
                run,
                thread_id,
                body,
                reply_prior_status=prior,
                pending_inbound_id=pending_id,
            )
            await insert_run_event(
                run_id,
                "agentmail_inbound",
                (
                    "A queued reply was received on the escalation email thread; "
                    "a response workflow is starting in the sandbox."
                ),
                {"thread_id": thread_id, "run_id": str(run_id), "source": "pending_reply_worker"},
            )
            await trigger_sandbox_post_run(run_id, template_id, merged)
        except Exception:
            LOG.exception("pending_reply_worker: iteration failed")
