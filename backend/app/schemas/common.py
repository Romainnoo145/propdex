"""Shared lightweight response schemas used across multiple routers."""

from pydantic import BaseModel


class StatusResponse(BaseModel):
    """Generic status-only response (e.g. {"status": "ok"})."""

    status: str


class MessageResponse(BaseModel):
    """Generic message response, optionally carrying an ID."""

    message: str
    id: str | None = None
