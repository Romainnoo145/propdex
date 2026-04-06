"""Pydantic schemas for policy document endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PolicyDocumentResponse(BaseModel):
    """Single policy document metadata (without file bytes)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: str
    entity_code: str
    source_key: str
    filename: str
    content_type: str
    file_size: int
    status: str
    ai_summary: str | None = None
    created_at: datetime
    updated_at: datetime


class PolicyDocumentListResponse(BaseModel):
    """List of policy documents for an entity."""

    documents: list[PolicyDocumentResponse]
    total: int
