"""Redis Streams consumer: dequeue run_ids and drive SandboxClaim + POST /run."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
from datetime import datetime, timezone
from uuid import UUID

import redis.asyncio as redis
from redis.exceptions import ResponseError

from runtime.db import update_run_status
from runtime.sandbox_trigger import (
    QueuePermanentError,
    QueueRetryableError,
    trigger_run_for_queue,
)

LOG = logging.getLogger(__name__)

STREAM_KEY = "swarm:runs:queue"
DEAD_STREAM_KEY = "swarm:runs:dead"
GROUP_NAME = "runtime-workers"
AUTOCLAIM_MIN_IDLE_MS = 30_000
READ_BLOCK_MS = 5_000


def _consumer_name() -> str:
    return os.environ.get("QUEUE_WORKER_CONSUMER_NAME") or socket.gethostname() or "runtime"


async def _ensure_consumer_group(r: redis.Redis) -> None:
    try:
        await r.xgroup_create(STREAM_KEY, GROUP_NAME, id="0", mkstream=True)
        LOG.info("Created Redis stream consumer group %s on %s", GROUP_NAME, STREAM_KEY)
    except ResponseError as e:
        if "BUSYGROUP" not in str(e).upper():
            raise


def _entries_from_xreadgroup(
    result: list | None,
) -> list[tuple[str, dict[str, str]]]:
    out: list[tuple[str, dict[str, str]]] = []
    if not result:
        return out
    for _stream_name, entries in result:
        for msg_id, fields in entries:
            if isinstance(fields, dict):
                decoded = {str(k): str(v) for k, v in fields.items()}
            else:
                decoded = dict(fields)  # type: ignore[arg-type]
            out.append((str(msg_id), decoded))
    return out


def _entries_from_xautoclaim(result: object) -> list[tuple[str, dict[str, str]]]:
    """redis-py returns [next_id, messages, ...] or legacy shapes; normalize to (id, fields) list."""
    out: list[tuple[str, dict[str, str]]] = []
    if result is None:
        return out
    if isinstance(result, (list, tuple)) and len(result) >= 2:
        messages = result[1]
        if not messages:
            return out
        for item in messages:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                msg_id, fields = item[0], item[1]
                if isinstance(fields, dict):
                    decoded = {str(k): str(v) for k, v in fields.items()}
                else:
                    decoded = dict(fields)  # type: ignore[arg-type]
                out.append((str(msg_id), decoded))
    return out


async def _process_one(
    r: redis.Redis,
    msg_id: str,
    fields: dict[str, str],
) -> None:
    run_id_s = fields.get("run_id") or ""
    template_id = fields.get("template_id") or ""
    payload_raw = fields.get("payload") or "{}"
    try:
        payload = json.loads(payload_raw) if isinstance(payload_raw, str) else {}
        if not isinstance(payload, dict):
            payload = {}
    except json.JSONDecodeError:
        payload = {}

    try:
        run_id = UUID(run_id_s)
    except ValueError:
        err = f"invalid run_id: {run_id_s!r}"
        LOG.error("%s — sending to DLQ", err)
        await r.xadd(
            DEAD_STREAM_KEY,
            {
                "run_id": run_id_s,
                "error": err,
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "original_payload": payload_raw,
            },
        )
        await r.xack(STREAM_KEY, GROUP_NAME, msg_id)
        return

    await update_run_status(run_id, "pending")

    try:
        await trigger_run_for_queue(run_id, template_id, payload)
    except QueueRetryableError as e:
        LOG.info(
            "Queue retryable for run_id=%s: %s — leaving message pending (no ACK)",
            run_id,
            e,
        )
        return
    except QueuePermanentError as e:
        LOG.warning("Queue permanent failure run_id=%s: %s", run_id, e)
        await r.xadd(
            DEAD_STREAM_KEY,
            {
                "run_id": str(run_id),
                "template_id": template_id,
                "error": str(e),
                "failed_at": datetime.now(timezone.utc).isoformat(),
                "original_payload": payload_raw,
            },
        )
        await r.xack(STREAM_KEY, GROUP_NAME, msg_id)
        return
    except Exception:
        LOG.exception("Unexpected error processing run_id=%s — not ACKing for retry", run_id)
        return

    await r.xack(STREAM_KEY, GROUP_NAME, msg_id)
    LOG.debug("ACKed stream message %s for run_id=%s", msg_id, run_id)


async def queue_worker_loop(r: redis.Redis) -> None:
    await _ensure_consumer_group(r)
    consumer = _consumer_name()
    LOG.info(
        "Queue worker started stream=%s group=%s consumer=%s",
        STREAM_KEY,
        GROUP_NAME,
        consumer,
    )

    while True:
        try:
            claimed = await r.xautoclaim(
                name=STREAM_KEY,
                groupname=GROUP_NAME,
                consumername=consumer,
                min_idle_time=AUTOCLAIM_MIN_IDLE_MS,
                start_id="0-0",
                count=1,
            )
            batch = _entries_from_xautoclaim(claimed)
            if not batch:
                result = await r.xreadgroup(
                    groupname=GROUP_NAME,
                    consumername=consumer,
                    streams={STREAM_KEY: ">"},
                    count=1,
                    block=READ_BLOCK_MS,
                )
                batch = _entries_from_xreadgroup(result)

            for msg_id, fields in batch:
                await _process_one(r, msg_id, fields)
        except asyncio.CancelledError:
            raise
        except Exception:
            LOG.exception("queue_worker iteration failed; backing off")
            await asyncio.sleep(2)


async def queue_worker(r: redis.Redis) -> None:
    """Entry point: run forever until cancelled."""
    await queue_worker_loop(r)
