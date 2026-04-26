"""Pydantic schemas for factor pin REST endpoints (Phase 7 / M048-S04)."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

PinCategory = Literal["potentie", "risico"]


class FactorPinCreate(BaseModel):
    """Request body for POST /api/users/me/factor-pins."""

    category: PinCategory = Field(..., description="Tab where the pin lives")
    factor_key: str = Field(..., min_length=1, max_length=64)


class FactorPinResponse(BaseModel):
    """Response shape for list / create endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category: PinCategory
    factor_key: str
    position: int
    created_at: datetime
