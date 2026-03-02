"""Pydantic schemas for professional directory API."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict


class ProfessionalCreate(BaseModel):
    """Schema for creating a new professional directory entry."""

    naam: str
    bedrijfsnaam: str | None = None
    werkgebied: list[str] = []
    gevolgklassen: list[str] = []
    email: str | None = None
    telefoon: str | None = None
    website: str | None = None
    tlokb_url: str | None = None


class ProfessionalUpdate(BaseModel):
    """Schema for partial update of a professional directory entry (all fields optional)."""

    naam: str | None = None
    bedrijfsnaam: str | None = None
    werkgebied: list[str] | None = None
    gevolgklassen: list[str] | None = None
    email: str | None = None
    telefoon: str | None = None
    website: str | None = None
    tlokb_url: str | None = None


class ProfessionalResponse(BaseModel):
    """Schema for professional directory entry response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    naam: str
    bedrijfsnaam: str | None
    werkgebied: list[str]
    gevolgklassen: list[str]
    email: str | None
    telefoon: str | None
    website: str | None
    tlokb_url: str | None
    is_active: bool


class ProfessionalListResponse(BaseModel):
    """Schema for paginated professional directory list response."""

    professionals: list[ProfessionalResponse]
    total: int
    gemeente_filter: str | None = None
    gevolgklasse_filter: str | None = None
