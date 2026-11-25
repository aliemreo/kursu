"""Errors with a stable, machine-readable code (the Error schema in contracts/openapi.yaml).

The client shows its own Turkish message for each code; `detail` is an English explanation
for developers.
"""

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class ApiError(HTTPException):
    """An HTTP error answered as `{"detail": ..., "code": ...}`.

    It is an HTTPException, so code that catches HTTPException (for example to roll back)
    handles it too.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        detail: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status_code, detail, headers)
        self.code = code


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        {"detail": exc.detail, "code": exc.code},
        status_code=exc.status_code,
        headers=exc.headers,
    )
