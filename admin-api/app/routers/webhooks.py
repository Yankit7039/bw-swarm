"""Webhook endpoints for external triggers."""

import os
from typing import Any
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app import db

RUNTIME_URL = os.environ.get("RUNTIME_URL", "http://runtime:8000")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class WebhookPayload(BaseModel):
    """Webhook payload - flexible to accept any JSON payload for the run."""
    model_config = {"extra": "allow"}


@router.post("/templates/{template_id}", response_model=dict)
async def webhook_trigger_run(template_id: str, payload: WebhookPayload) -> dict:
    """
    Webhook endpoint to trigger one or more runs for a specific template.

    URL format: POST /webhooks/templates/{template_id}
    Body: Single object or array of objects containing order data.

    Example single payload:
    {
        "order_id": "PORT-67890"
    }

    Example batch payload (multiple runs):
    {
        "orders": [
            {"order_id": "PORT-67890"},
            {"order_id": "PORT-67891"},
            {"order_id": "PORT-67892"}
        ]
    }
    """
    import logging
    logger = logging.getLogger(__name__)

    # Verify template exists
    template = await db.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    payload_dict = payload.dict(exclude_unset=True)

    # Check if batch mode (orders array) or single mode
    if "orders" in payload_dict and isinstance(payload_dict["orders"], list):
        # Batch mode - trigger multiple runs
        orders = payload_dict["orders"]
        if not orders:
            raise HTTPException(status_code=422, detail="orders array cannot be empty")

        results = []
        errors = []

        async with httpx.AsyncClient(timeout=30.0) as client:
            for idx, order in enumerate(orders):
                try:
                    runtime_payload = {
                        "template_id": template_id,
                        "payload": order if isinstance(order, dict) else {"data": order},
                    }
                    response = await client.post(f"{RUNTIME_URL}/runs", json=runtime_payload)
                    response.raise_for_status()
                    results.append({
                        "index": idx,
                        "order": order,
                        "result": response.json()
                    })
                except Exception as e:
                    logger.error(f"Failed to trigger run for order {idx}: {str(e)}")
                    errors.append({
                        "index": idx,
                        "order": order,
                        "error": str(e)
                    })

        return {
            "template_id": template_id,
            "total": len(orders),
            "successful": len(results),
            "failed": len(errors),
            "results": results,
            "errors": errors
        }
    else:
        # Single mode - trigger one run
        try:
            logger.info(f"Triggering single run for template {template_id}")
            async with httpx.AsyncClient(timeout=30.0) as client:
                runtime_payload = {
                    "template_id": template_id,
                    "payload": payload_dict,
                }
                logger.info(f"Sending payload: {runtime_payload}")
                response = await client.post(f"{RUNTIME_URL}/runs", json=runtime_payload)
                logger.info(f"Runtime response status: {response.status_code}")
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Runtime HTTP error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Runtime error: {e.response.text}"
            )
        except httpx.ConnectError as e:
            logger.error(f"Cannot connect to runtime at {RUNTIME_URL}: {str(e)}")
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to runtime service at {RUNTIME_URL}. Please ensure the runtime is running."
            )
        except Exception as e:
            logger.error(f"Failed to trigger run: {type(e).__name__}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to trigger run: {type(e).__name__}: {str(e)}"
            )


@router.get("/templates/{template_id}")
async def get_webhook_info(template_id: str) -> dict:
    """
    Get webhook URL and sample payload for a template.

    Returns the webhook URL and example payload structure.
    """
    template = await db.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    # Simple sample payload - just order_id
    sample_payload = {
        "order_id": "ORDER-12345"
    }

    # Batch sample payload for multiple runs
    batch_payload = {
        "orders": [
            {"order_id": "ORDER-12345"},
            {"order_id": "ORDER-12346"},
            {"order_id": "ORDER-12347"}
        ]
    }

    return {
        "template_id": template_id,
        "template_name": template.get("name"),
        "webhook_url": f"/webhooks/templates/{template_id}",
        "method": "POST",
        "content_type": "application/json",
        "sample_payload": sample_payload,
        "batch_payload": batch_payload,
        "description": f"Trigger a run for the '{template.get('name')}' template",
        "notes": "Send single object for one run, or use {'orders': [...]} for batch processing"
    }
