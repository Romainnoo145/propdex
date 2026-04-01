"""Pydantic response schemas for properties domain endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ── Address suggestion ────────────────────────────────────────────


class AddressSuggestion(BaseModel):
    """Single address autocomplete suggestion from PDOK."""

    # PDOK suggest returns dicts whose keys vary; use permissive fields.
    weergavenaam: str | None = None
    id: str | None = None
    type: str | None = None
    score: float | None = None
    # Additional fields may be present depending on PDOK response
    adrestype: str | None = None
    gemeentenaam: str | None = None
    provincienaam: str | None = None
    postcode: str | None = None
    huisnummer: int | None = None
    straatnaam: str | None = None
    woonplaatsnaam: str | None = None

    model_config = {"extra": "allow"}


# ── Actievoorstellen ─────────────────────────────────────────────


class ActievoorstellenResponse(BaseModel):
    """Actionable recommendations for a parcel."""

    parcel_id: str
    acties: list[dict[str, Any]]
    total: int


# ── Document generation ──────────────────────────────────────────


class DocumentTemplate(BaseModel):
    """A single document generation template."""

    id: str
    name: str
    description: str


class TemplateListResponse(BaseModel):
    """Available document templates."""

    templates: list[DocumentTemplate]


class DocumentGenerationResponse(BaseModel):
    """Result of generating a concept document for a parcel."""

    parcel_id: str
    template_id: str
    content: str
    format: str = "markdown"


# ── Task management ──────────────────────────────────────────────


class TaskItem(BaseModel):
    """A single parcel task in list responses."""

    id: str
    title: str
    description: str | None = None
    status: str
    priority: str
    category: str | None = None
    use_case: str | None = None
    deadline: str | None = None
    source_actie_id: str | None = None
    created_at: str


class TaskListResponse(BaseModel):
    """List of tasks for a parcel."""

    parcel_id: str
    tasks: list[TaskItem]
    total: int


class TaskCreateResponse(BaseModel):
    """Response after creating a single task."""

    id: str
    title: str
    status: str
    created: bool = True


class TaskUpdateResponse(BaseModel):
    """Response after updating a task."""

    id: str
    status: str
    updated: bool = True


class BulkTaskCreateResponse(BaseModel):
    """Response after auto-creating tasks from actievoorstellen."""

    parcel_id: str
    created: int
    skipped: int
