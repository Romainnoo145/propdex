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


class ChecklistCheck(BaseModel):
    """One org user's checked state for a specific item.

    NOTE: updated_at is the ChecklistProgress row's row-level timestamp,
    not per-item. "Alice checked opt-03 on X" means "Alice's optoppen-
    progress row was last modified on X and currently contains opt-03".
    Per-item timestamps would require a schema change — skipped in S04.
    """

    user_id: UUID
    user_name: str
    updated_at: datetime


class ChecklistLinkedDocument(BaseModel):
    """One org user's parcel_document linked to a specific checklist item."""

    document_id: UUID
    user_id: UUID
    user_name: str
    updated_at: datetime


class ChecklistItemLinks(BaseModel):
    """Aggregated org-wide state for a single item_id in one use_case."""

    checked_by: list[ChecklistCheck] = []
    linked_documents: list[ChecklistLinkedDocument] = []


class ChecklistLinksBundle(BaseModel):
    """Org-aggregated checklist state across all 4 use cases.

    Always exposes all 4 use_case keys (empty dict when no activity) —
    consistent with CascadePolicyDocs.landelijk/provincie/gemeente pattern.
    """

    optoppen: dict[str, ChecklistItemLinks] = {}
    splitsen: dict[str, ChecklistItemLinks] = {}
    transformatie: dict[str, ChecklistItemLinks] = {}
    nieuwbouw: dict[str, ChecklistItemLinks] = {}


class ParcelDocumentBundle(BaseModel):
    """Full document bundle for a parcel: peer docs + cascaded policy docs + checklist links."""

    peer_docs: list[ParcelDocumentRead]
    cascade_policy_docs: CascadePolicyDocs
    checklist_links: ChecklistLinksBundle
