from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        details: list | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.code,
            "message": exc.message,
            "details": exc.details,
        },
    )


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    from fastapi.exceptions import RequestValidationError

    if isinstance(exc, RequestValidationError):
        errors = []
        for error in exc.errors():
            errors.append({
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
            })
        return JSONResponse(
            status_code=400,
            content={
                "error": "validation_failed",
                "message": "Request validation failed",
                "details": errors,
            },
        )
    raise exc
