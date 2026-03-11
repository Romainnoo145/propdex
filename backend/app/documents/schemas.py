"""Pydantic schemas for parcel document endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentResponse(BaseModel):
    """Single document metadata (without file bytes)."""

    id: uuid.UUID
    parcel_id: str
    document_type: str
    filename: str
    content_type: str
    file_size: int
    uploaded_at: datetime = Field(validation_alias="created_at")
    uploaded_by_user_id: uuid.UUID | None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DocumentListResponse(BaseModel):
    """List of documents with total count."""

    documents: list[DocumentResponse]
    total: int
