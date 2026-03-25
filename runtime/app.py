"""Runtime service: template-agnostic API for runs. FastAPI, Postgres only."""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import secrets
import uuid

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

from runtime.claim_reconciler import claim_reconciler
from runtime.followup_poller import followup_poller
from runtime.db import (
    create_run,
    get_run,
    get_run_events,
    get_template,
    init_db,
    insert_run_event,
)
from runtime.db.run_migrations import run_migrations

LOG = logging.getLogger(__name__)

JIRA_ISSUE_CREATED = "jira:issue_created"
TICKET_EMAIL_ROUTING_TEMPLATE = "ticket-email-routing"

app = FastAPI(
    title="Runtime",
    description="Template-agnostic orchestrator: POST /runs (template_id + payload), GET /runs, GET /runs/events.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()
    await run_migrations()
    asyncio.create_task(claim_reconciler())
    asyncio.create_task(followup_poller())


@app.post("/runs")
async def submit_run(body: dict, background_tasks: BackgroundTasks) -> dict:
    """Create a run and enqueue sandbox trigger. Body: { "template_id": string, "payload": object }."""
    template_id = body.get("template_id")
    payload = body.get("payload")
    if not template_id:
        raise HTTPException(status_code=422, detail="template_id is required")
    if payload is None:
        payload = {}

    template = await get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    run_id = uuid.uuid4()
    await create_run(run_id, template_id, payload)

    from runtime.sandbox_trigger import trigger_run

    background_tasks.add_task(trigger_run, run_id, template_id, payload)
    return {"run_id": str(run_id), "template_id": template_id, "status": "pending"}


def _verify_jira_x_hub_signature(body: bytes, sig_header: str, secret: str) -> bool:
    """Verify WebSub-style X-Hub-Signature (sha256=<hex>) per Atlassian admin webhooks."""
    sig_header = sig_header.strip()
    if not sig_header.startswith("sha256="):
        return False
    expected_hex = sig_header[7:].strip()
    computed = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    if len(expected_hex) != len(computed):
        return False
    return secrets.compare_digest(computed, expected_hex)


def _verify_jira_bearer(authorization: str | None, secret: str) -> bool:
    if not authorization or not authorization.startswith("Bearer "):
        return False
    token = authorization[7:].strip()
    return secrets.compare_digest(token, secret)


async def _read_and_verify_jira_webhook(request: Request, authorization: str | None) -> dict:
    """
    Read raw body once, verify Jira delivery auth, return parsed JSON object.

    Jira Cloud admin webhooks with a configured secret send HMAC-SHA256 in X-Hub-Signature.
    Optional: Authorization: Bearer <same secret> for manual/curl testing.
    """
    body_bytes = await request.body()
    secret = os.environ.get("JIRA_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    sig_header = request.headers.get("x-hub-signature") or request.headers.get("X-Hub-Signature")
    if sig_header:
        if not _verify_jira_x_hub_signature(body_bytes, sig_header, secret):
            raise HTTPException(status_code=401, detail="Unauthorized")
    elif _verify_jira_bearer(authorization, secret):
        pass
    else:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not body_bytes:
        return {}
    try:
        parsed = json.loads(body_bytes.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def _jira_webhook_task(order_id: str | None, body: dict) -> None:
    if body.get("webhookEvent") != JIRA_ISSUE_CREATED:
        return
    if not order_id or not str(order_id).strip():
        LOG.warning("Jira webhook: missing or empty order_id query param")
        return
    order_id = str(order_id).strip()
    template = await get_template(TICKET_EMAIL_ROUTING_TEMPLATE)
    if not template:
        LOG.error("Jira webhook: template %s not found", TICKET_EMAIL_ROUTING_TEMPLATE)
        return
    LOG.info("Jira webhook received for %s, triggering ticket-email-routing run", order_id)
    run_id = uuid.uuid4()
    payload = {"order_id": order_id}
    await create_run(run_id, TICKET_EMAIL_ROUTING_TEMPLATE, payload)
    await insert_run_event(
        run_id,
        "jira_webhook",
        f"Run triggered from Jira issue {order_id} (Jira webhook).",
        {"order_id": order_id, "source": "jira_webhook"},
    )
    from runtime.sandbox_trigger import trigger_run

    await trigger_run(run_id, TICKET_EMAIL_ROUTING_TEMPLATE, payload)


@app.post("/webhooks/jira")
async def jira_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    order_id: str | None = Query(None),
    authorization: str | None = Header(None),
) -> dict:
    """Jira Cloud webhook: fast 200; verify X-Hub-Signature (admin) or Bearer; then enqueue run."""
    body = await _read_and_verify_jira_webhook(request, authorization)
    background_tasks.add_task(_jira_webhook_task, order_id, body)
    return {"status": "accepted"}


@app.get("/runs/{run_id}")
async def get_run_status(run_id: uuid.UUID) -> dict:
    """Return run status, result, error_message, timestamps."""
    row = await get_run(run_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return row


@app.get("/runs/{run_id}/events")
async def get_run_events_endpoint(run_id: uuid.UUID) -> list:
    """Return run_events for live step-by-step UI."""
    events = await get_run_events(run_id)
    return events


@app.get("/health")
async def health():
    return {"status": "ok"}
