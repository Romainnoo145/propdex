"""Pydantic schemas for the favorites and portfolio API."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PipelineStage = Literal["Gesignaleerd", "Onderzoek", "Contact", "Besluit", "Afgerond"]


class FavoriteCreate(BaseModel):
    parcel_id: str = Field(max_length=50, description="Kadaster parcel ID")
    gemeente_code: str | None = Field(default=None, max_length=10)
    gemeente_naam: str | None = Field(default=None, max_length=100)
    wijk_naam: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=500)


class PipelineUpdateRequest(BaseModel):
    stage: PipelineStage
    afgerond_reden: str | None = Field(
        default=None,
        max_length=30,
        description="Gekocht or Afgewezen (required when stage=Afgerond)",
    )
    notitie: str | None = Field(default=None, max_length=500)


class FavoriteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parcel_id: str
    parcel_cache_id: uuid.UUID | None = None
    user_id: uuid.UUID
    gemeente_code: str | None
    gemeente_naam: str | None
    wijk_naam: str | None
    address: str | None
    pipeline_stage: str
    afgerond_reden: str | None
    notitie: str | None
    potentie_score: float | None = None
    risico_score: float | None = None
    has_report: bool = False
    report_id: uuid.UUID | None = None
    project_type: str | None = None  # canonical projecttype enum value, None when unset/no row
    created_at: datetime
    updated_at: datetime


class PortfolioWijkGroup(BaseModel):
    wijk_naam: str | None
    parcel_count: int


class PortfolioGemeenteGroup(BaseModel):
    gemeente_code: str | None
    gemeente_naam: str | None
    total_count: int
    wijken: list[PortfolioWijkGroup]


class PortfolioResponse(BaseModel):
    gemeenten: list[PortfolioGemeenteGroup]
    total_favorites: int


class FavoriteCentroidResponse(BaseModel):
    parcel_code: str
    lon: float
    lat: float


class NotitieUpdateRequest(BaseModel):
    notitie: str | None = None
