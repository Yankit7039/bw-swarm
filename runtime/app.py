"""Runtime service: template-agnostic API for runs. FastAPI, Postgres only."""

import asyncio
import base64
import binascii
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
    enqueue_pending_inbound,
    get_communication_route,
    get_run,
    get_run_events,
    get_template,
    init_db,
    insert_run_event,
    try_claim_run_for_reply,
)
from runtime.db.run_migrations import run_migrations
from runtime.sandbox_trigger import trigger_sandbox_post_run

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


def _verify_svix_signature(
    body: bytes,
    msg_id: str | None,
    timestamp: str | None,
    sig_header: str | None,
    secret: str,
) -> bool:
    """Svix (AgentMail) webhooks: HMAC-SHA256 over f'{id}.{timestamp}.{body}' with whsec_ secret."""
    if not msg_id or not timestamp or not sig_header or not secret:
        return False
    if not secret.startswith("whsec_"):
        return False
    try:
        key = base64.b64decode(secret[6:])
    except (ValueError, binascii.Error):
        return False
    try:
        body_str = body.decode("utf-8")
    except UnicodeDecodeError:
        return False
    signed_content = f"{msg_id}.{timestamp}.{body_str}".encode("utf-8")
    expected = hmac.new(key, signed_content, hashlib.sha256).digest()
    for part in sig_header.split():
        part = part.strip()
        if not part.startswith("v1,"):
            continue
        b64_sig = part[3:]
        try:
            sig_bytes = base64.b64decode(b64_sig)
        except (ValueError, binascii.Error):
            continue
        if hmac.compare_digest(expected, sig_bytes):
            return True
    return False


async def _read_and_verify_agentmail_webhook(request: Request) -> dict:
    body_bytes = await request.body()
    secret = os.environ.get("AGENTMAIL_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    h = request.headers
    msg_id = h.get("svix-id") or h.get("webhook-id")
    timestamp = h.get("svix-timestamp") or h.get("webhook-timestamp")
    sig_header = h.get("svix-signature") or h.get("webhook-signature")
    if not _verify_svix_signature(body_bytes, msg_id, timestamp, sig_header, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not body_bytes:
        return {}
    try:
        parsed = json.loads(body_bytes.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _reply_body_from_message(msg: dict) -> str:
    if not isinstance(msg, dict):
        return ""
    ext = msg.get("extracted_text")
    if ext is not None and str(ext).strip():
        return str(ext).strip()
    t = msg.get("text")
    return str(t).strip() if t is not None else ""


def _normalize_message_from(msg: dict) -> object:
    raw = msg.get("from") if isinstance(msg, dict) else None
    if isinstance(raw, list):
        return raw
    return raw


async def _agentmail_webhook_task(body: dict) -> None:
    if body.get("event_type") != "message.received":
        return
    msg = body.get("message")
    if not isinstance(msg, dict):
        return
    thread_id = msg.get("thread_id")
    if not thread_id or not str(thread_id).strip():
        LOG.warning("AgentMail webhook: missing thread_id")
        return
    thread_id = str(thread_id).strip()

    route = await get_communication_route(thread_id)
    if route is None:
        LOG.info("AgentMail webhook: no run registered for thread_id=%s", thread_id)
        return

    run_id, template_id = route
    run = await get_run(run_id)
    if run is None:
        LOG.warning("AgentMail webhook: run %s missing for thread %s", run_id, thread_id)
        return

    status = run.get("status") or ""
    fup = bool(run.get("follow_up_in_progress"))
    busy = status in ("pending", "running", "processing_reply") or fup
    full_payload = dict(body)

    if busy:
        await enqueue_pending_inbound(thread_id, full_payload)
        return

    claimed = await try_claim_run_for_reply(run_id)
    if not claimed:
        await enqueue_pending_inbound(thread_id, full_payload)
        return

    st = run.get("state") if isinstance(run.get("state"), dict) else {}
    base_payload = dict(run.get("payload") or {}) if isinstance(run.get("payload"), dict) else {}
    reply_body = _reply_body_from_message(msg)
    inbound_mid = msg.get("message_id")
    merged = {
        **base_payload,
        "thread_state": st,
        "reply_context": {
            "body": reply_body,
            "from": _normalize_message_from(msg),
            "inbound_message_id": str(inbound_mid).strip() if inbound_mid else None,
            "thread_id": thread_id,
        },
    }

    await insert_run_event(
        run_id,
        "agentmail_inbound",
        (
            "A reply was received on the escalation email thread; a response workflow is starting "
            "in the sandbox."
        ),
        {"thread_id": thread_id, "run_id": str(run_id)},
    )

    await trigger_sandbox_post_run(run_id, template_id, merged)


@app.post("/webhooks/agentmail")
async def agentmail_webhook(request: Request, background_tasks: BackgroundTasks) -> dict:
    """AgentMail webhook: verify HMAC, return 200 immediately; process in background."""
    body = await _read_and_verify_agentmail_webhook(request)
    background_tasks.add_task(_agentmail_webhook_task, body)
    return {"status": "accepted"}


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
