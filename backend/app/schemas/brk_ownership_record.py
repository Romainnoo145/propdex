"""Pydantic schemas for BrkOwnershipRecord persistent storage (M050/S01).

Distinct from `app/schemas/brk_ownership.py` which describes the live Phase 105
ephemeral BRK Bevragen response (never_cache=True). These schemas describe the
persistent rechtspersoon-only record after AVG strip + service-layer validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class BRKOwnershipRecordCreate(BaseModel):
    """Input to brk_persistence_service.persist_record().

    Service-layer enforces (D8): eigenaar_naam MUST NOT be None for rechtspersoon.
    DB-layer CHECK enforces (D1): eigenaar_type IN ('rechtspersoon', 'overheid').
    """

    parcel_id: str = Field(..., max_length=64)
    eigenaar_type: Literal["rechtspersoon", "overheid"]
    eigenaar_naam: str | None = None
    kvk_nummer: str | None = Field(default=None, max_length=8)
    statutaire_zetel: str | None = None
    zakelijk_recht_type: str | None = Field(default=None, max_length=32)
    aandeel: str | None = None
    koopsom: Decimal | None = None
    koopjaar: int | None = None
    heeft_hypotheek: bool = False
    raw_brk_response: dict[str, Any] | None = None


class BRKOwnershipRecordRead(BaseModel):
    """Read-shape returned by service for downstream consumers (S02 + S03)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    parcel_id: str
    eigenaar_type: str
    eigenaar_naam: str | None
    kvk_nummer: str | None
    statutaire_zetel: str | None
    zakelijk_recht_type: str | None
    aandeel: str | None
    koopsom: Decimal | None
    koopjaar: int | None
    heeft_hypotheek: bool
    fetched_at: datetime
    soft_deleted_at: datetime | None
    hard_delete_after: datetime | None
    created_at: datetime
    updated_at: datetime
