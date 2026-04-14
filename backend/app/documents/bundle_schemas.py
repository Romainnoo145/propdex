"""Pydantic DTOs for the parcel document bundle cascade API."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PolicyDocumentRead(BaseModel):
    """Read DTO for a policy document. Excludes file_data bytes."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    entity_type: str
    entity_code: str
    source_key: str
    filename: str
    content_type: str
    file_size: int
    uploaded_at: datetime = Field(validation_alias="created_at")
    version_number: int
    ai_summary: str | None = None


class ParcelDocumentRead(BaseModel):
    """Read DTO for a parcel document. Excludes file_data bytes."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: UUID
    parcel_id: str
    document_type: str
    filename: str
    content_type: str
    file_size: int
    uploaded_at: datetime = Field(validation_alias="created_at")
    ai_summary: str | None = None


class CascadePolicyDocs(BaseModel):
    """Policy documents cascaded from landelijk → provincie → gemeente."""

    landelijk: list[PolicyDocumentRead] = []
    provincie: list[PolicyDocumentRead] = []
    gemeente: list[PolicyDocumentRead] = []


class ParcelDocumentBundle(BaseModel):
    """Full document bundle for a parcel: peer docs + cascaded policy docs + checklist links."""

    peer_docs: list[ParcelDocumentRead]
    cascade_policy_docs: CascadePolicyDocs
    checklist_links: dict[str, str]
