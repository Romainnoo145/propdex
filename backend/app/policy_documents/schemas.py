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
    version_number: int
    ai_summary: str | None = None
    extraction_status: str = "nvt"  # parsed | pending | nvt (from cascade cache)
    extraction: dict | None = None  # latest cascade extracted_payload, or None
    created_at: datetime
    updated_at: datetime


class PolicyDocumentListResponse(BaseModel):
    """List of policy documents for an entity."""

    documents: list[PolicyDocumentResponse]
    total: int


class PolicySummariesResponse(BaseModel):
    """Map of source_key → ai_summary for an entity's policy documents."""

    summaries: dict[str, str]


class AutoIngestRequest(BaseModel):
    """Request body for the on-demand auto-ingest endpoint."""

    gemeente_code: str  # e.g. "GM0983"
    gemeente_naam: str  # e.g. "Venlo"


class AutoIngestResponse(BaseModel):
    """Response body for the auto-ingest endpoint.

    summary maps source_key → version_number written, or None when
    skipped (no SRU result, already ingested, or PDF download failed).
    """

    gemeente_code: str
    gemeente_naam: str
    summary: dict[str, int | None]
