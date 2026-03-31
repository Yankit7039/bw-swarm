"""Template-agnostic sandbox trigger: SandboxClaim + POST /run with run_id + payload."""

import asyncio
import logging
import os
import uuid

try:
    from kubernetes import client, config
    from kubernetes.client.rest import ApiException
    _HAS_K8S = True
except ImportError:
    _HAS_K8S = False

try:
    import httpx
except ImportError:
    httpx = None

SANDBOX_NAMESPACE = os.environ.get("SANDBOX_NAMESPACE", "default")
ENTRYPOINT_PORT = int(os.environ.get("ENTRYPOINT_PORT", "8888"))
LOG = logging.getLogger(__name__)


class QueueRetryableError(Exception):
    """Pod not ready in time; run reset to queued; Redis message must not be ACKed."""


class QueuePermanentError(Exception):
    """Non-retryable queue failure; run marked failed; message should go to DLQ and be ACKed."""


def _sandbox_attempt_from_payload(payload: dict) -> int:
    """0 = initial POST /runs; follow-up pods use followup_context.followup_attempt_number."""
    fc = payload.get("followup_context") if isinstance(payload, dict) else None
    if not isinstance(fc, dict):
        return 0
    try:
        n = int(fc.get("followup_attempt_number") or 0)
    except (TypeError, ValueError):
        n = 0
    return max(0, n)


def _get_pod_hostname_for_claim_sync(claim_name: str, namespace: str) -> str | None:
    """Poll SandboxClaim until it has an assigned pod; return hostname (blocking)."""
    if not _HAS_K8S:
        return None
    try:
        config.load_incluster_config()
    except config.ConfigException:
        try:
            config.load_kube_config()
        except config.ConfigException:
            return None

    custom_api = client.CustomObjectsApi()
    group, version = "extensions.agents.x-k8s.io", "v1alpha1"
    plural = "sandboxclaims"

    for _ in range(60):
        try:
            claim = custom_api.get_namespaced_custom_object(
                group=group, version=version, namespace=namespace,
                plural=plural, name=claim_name,
            )
            status = claim.get("status") or {}
            hostname = (
                status.get("sandbox", {}).get("Name")
                or status.get("podName")
                or status.get("assignedPod")
            )
            if hostname and any(c.get("type") == "Ready" and c.get("status") == "True" for c in (status.get("conditions") or [])):
                return hostname
        except ApiException:
            pass
        import time
        time.sleep(1)
    return None


def _delete_sandbox_claim(claim_name: str, namespace: str) -> bool:
    """Delete SandboxClaim by name. Idempotent (404 = already gone)."""
    if not _HAS_K8S:
        return False
    try:
        config.load_incluster_config()
    except config.ConfigException:
        try:
            config.load_kube_config()
        except config.ConfigException:
            return False

    custom_api = client.CustomObjectsApi()
    group, version = "extensions.agents.x-k8s.io", "v1alpha1"
    plural = "sandboxclaims"
    try:
        custom_api.delete_namespaced_custom_object(
            group=group, version=version, namespace=namespace,
            plural=plural, name=claim_name,
        )
        return True
    except ApiException as e:
        if e.status == 404:
            return True
        LOG.error("SandboxClaim delete ApiException: status=%s reason=%s body=%s", e.status, e.reason, e.body)
        return False


def _create_sandbox_claim(claim_name: str, warm_pool_ref: str, namespace: str) -> bool:
    """Create a SandboxClaim so the controller assigns a pod from the warm pool."""
    if not _HAS_K8S:
        return False
    try:
        config.load_incluster_config()
    except config.ConfigException:
        try:
            config.load_kube_config()
        except config.ConfigException:
            return False

    custom_api = client.CustomObjectsApi()
    body = {
        "apiVersion": "extensions.agents.x-k8s.io/v1alpha1",
        "kind": "SandboxClaim",
        "metadata": {"name": claim_name, "namespace": namespace},
        "spec": {"sandboxTemplateRef": {"name": warm_pool_ref}},
    }
    LOG.info("Creating SandboxClaim: name=%s group=extensions.agents.x-k8s.io", claim_name)
    try:
        custom_api.create_namespaced_custom_object(
            group="extensions.agents.x-k8s.io", version="v1alpha1", namespace=namespace,
            plural="sandboxclaims", body=body,
        )
        return True
    except ApiException as e:
        LOG.error("SandboxClaim ApiException: status=%s reason=%s body=%s", e.status, e.reason, e.body)
        return False


async def trigger_sandbox_post_run(run_id: uuid.UUID, template_id: str, payload: dict) -> None:
    """
    Resolve template → warm pool, create SandboxClaim, wait for pod,
    POST /run with { run_id, payload }. On failure, sets run to failed.
    """
    from runtime.db import get_template, update_run_status

    template = await get_template(template_id)
    if not template:
        await update_run_status(run_id, "failed", error_message=f"Template '{template_id}' not found")
        return

    warm_pool_ref = template.get("warm_pool_ref")
    if not warm_pool_ref:
        await update_run_status(run_id, "failed", error_message="Template has no warm_pool_ref")
        return

    attempt = _sandbox_attempt_from_payload(payload)
    base = f"run-{run_id.hex[:12]}-a{attempt}"
    if isinstance(payload, dict) and payload.get("reply_context"):
        claim_name = f"{base}-reply"
    else:
        claim_name = base
    namespace = SANDBOX_NAMESPACE
    created = _create_sandbox_claim(claim_name, warm_pool_ref, namespace)

    if not created:
        await update_run_status(
            run_id, "failed", sandbox_claim_name=claim_name,
            error_message="Failed to create SandboxClaim (no K8s or claim failed)",
        )
        return

    hostname = await asyncio.get_event_loop().run_in_executor(
        None, _get_pod_hostname_for_claim_sync, claim_name, namespace
    )

    if not hostname:
        await update_run_status(
            run_id, "failed", sandbox_claim_name=claim_name,
            error_message="SandboxClaim timed out waiting for pod",
        )
        return

    await update_run_status(run_id, "running", assigned_pod=hostname, sandbox_claim_name=claim_name)

    if not httpx:
        await update_run_status(run_id, "failed", error_message="httpx not installed")
        return

    url = f"http://{hostname}:{ENTRYPOINT_PORT}/run"
    body = {"run_id": str(run_id), "payload": payload}
    timeout_s = float(os.environ.get("SANDBOX_POST_TIMEOUT", "60"))
    async with httpx.AsyncClient(timeout=timeout_s) as http_client:
        try:
            r = await http_client.post(url, json=body)
            r.raise_for_status()
        except Exception as e:
            msg = str(e).strip() or f"{type(e).__name__}"
            await update_run_status(run_id, "failed", error_message=f"POST /run failed: {msg}")


async def trigger_run(run_id: uuid.UUID, template_id: str, payload: dict) -> None:
    """Enqueue a new run: SandboxClaim + POST /run (same as trigger_sandbox_post_run)."""
    await trigger_sandbox_post_run(run_id, template_id, payload)


async def trigger_run_for_queue(run_id: uuid.UUID, template_id: str, payload: dict) -> None:
    """
    Same as trigger_sandbox_post_run, but pod assignment timeout is retryable:
    deletes the claim, resets the run to queued, and raises QueueRetryableError (no ACK).
    Other failures raise QueuePermanentError after marking the run failed.
    """
    from runtime.db import get_template, reset_run_for_queue_retry, update_run_status

    template = await get_template(template_id)
    if not template:
        await update_run_status(run_id, "failed", error_message=f"Template '{template_id}' not found")
        raise QueuePermanentError(f"Template '{template_id}' not found")

    warm_pool_ref = template.get("warm_pool_ref")
    if not warm_pool_ref:
        await update_run_status(run_id, "failed", error_message="Template has no warm_pool_ref")
        raise QueuePermanentError("Template has no warm_pool_ref")

    attempt = _sandbox_attempt_from_payload(payload)
    base = f"run-{run_id.hex[:12]}-a{attempt}"
    if isinstance(payload, dict) and payload.get("reply_context"):
        claim_name = f"{base}-reply"
    else:
        claim_name = base
    namespace = SANDBOX_NAMESPACE
    created = _create_sandbox_claim(claim_name, warm_pool_ref, namespace)

    if not created:
        await update_run_status(
            run_id,
            "failed",
            sandbox_claim_name=claim_name,
            error_message="Failed to create SandboxClaim (no K8s or claim failed)",
        )
        raise QueuePermanentError("Failed to create SandboxClaim")

    hostname = await asyncio.get_event_loop().run_in_executor(
        None, _get_pod_hostname_for_claim_sync, claim_name, namespace
    )

    if not hostname:
        await asyncio.get_event_loop().run_in_executor(
            None, _delete_sandbox_claim, claim_name, namespace
        )
        await reset_run_for_queue_retry(run_id)
        raise QueueRetryableError("SandboxClaim timed out waiting for pod")

    await update_run_status(run_id, "running", assigned_pod=hostname, sandbox_claim_name=claim_name)

    if not httpx:
        await update_run_status(run_id, "failed", error_message="httpx not installed")
        raise QueuePermanentError("httpx not installed")

    url = f"http://{hostname}:{ENTRYPOINT_PORT}/run"
    body = {"run_id": str(run_id), "payload": payload}
    timeout_s = float(os.environ.get("SANDBOX_POST_TIMEOUT", "60"))
    async with httpx.AsyncClient(timeout=timeout_s) as http_client:
        try:
            r = await http_client.post(url, json=body)
            r.raise_for_status()
        except Exception as e:
            msg = str(e).strip() or f"{type(e).__name__}"
            await update_run_status(run_id, "failed", error_message=f"POST /run failed: {msg}")
            raise QueuePermanentError(f"POST /run failed: {msg}") from e
