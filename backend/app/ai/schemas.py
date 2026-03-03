"""Pydantic schemas for AI document parsing with Claude."""

from typing import Literal

from pydantic import BaseModel, Field


class BuildingDimensionsAI(BaseModel):
    """Building dimension constraints extracted by AI from bestemmingsplan text."""

    max_bouwhoogte: float | None = Field(
        default=None,
        description="Maximum building height in meters",
    )
    max_goothoogte: float | None = Field(
        default=None,
        description="Maximum gutter height in meters",
    )
    max_bebouwingspercentage: float | None = Field(
        default=None,
        description="Maximum coverage percentage (0-100)",
    )
    max_floor_area_ratio: float | None = Field(
        default=None,
        description="Maximum floor area ratio / FSI (FAR)",
    )
    max_oppervlakte: float | None = Field(
        default=None,
        description="Maximum floor area in m2",
    )
    max_inhoud: float | None = Field(
        default=None,
        description="Maximum volume in m3",
    )
    overige: dict[str, str] = Field(
        default_factory=dict,
        description="Other dimension rules as key-value pairs",
    )


class BestemmingsregelExtract(BaseModel):
    """Single zoning rule extracted from bestemmingsplan PDF by AI."""

    artikel: str = Field(
        description="Article reference (e.g., 'Artikel 3.1.2 Wonen')"
    )
    bestemming: str = Field(
        description="Zoning designation (e.g., 'Wonen', 'Gemengd')"
    )
    toegestane_gebruiken: list[str] = Field(
        default_factory=list,
        description="Permitted uses",
    )
    verboden_gebruiken: list[str] = Field(
        default_factory=list,
        description="Forbidden uses",
    )
    bouwregels: BuildingDimensionsAI | None = Field(
        default=None,
        description="Building dimension rules",
    )
    parkeereis: str | None = Field(
        default=None,
        description="Parking requirement text",
    )
    milieu_restricties: list[str] = Field(
        default_factory=list,
        description="Environmental restrictions",
    )
    bijzondere_voorwaarden: list[str] = Field(
        default_factory=list,
        description="Special conditions, exceptions",
    )
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = Field(
        description="Confidence for this specific rule"
    )
    disclaimer: str | None = Field(
        default=None,
        description="Dutch warning for LOW-confidence items only",
    )


class BestemmingsplanParsed(BaseModel):
    """Complete AI-parsed bestemmingsplan output from Claude."""

    plan_naam: str = Field(
        description="Plan name as stated in document"
    )
    plan_idn: str = Field(
        description="IMRO plan identifier (NL.IMRO.{gemeente}.{plan}-{version})"
    )
    regels: list[BestemmingsregelExtract] = Field(
        description="All extracted zoning rules"
    )
    overall_confidence: Literal["HIGH", "MEDIUM", "LOW"] = Field(
        description="Overall parsing confidence"
    )
    disclaimers: list[str] = Field(
        default_factory=list,
        description="Dutch disclaimers for ambiguous items",
    )
    samenvatting: str = Field(
        description="Brief Dutch summary of key findings for developers"
    )


class AIParsingSection(BaseModel):
    """AI-parsed data section for inclusion in property report."""

    parsed_plan: BestemmingsplanParsed | None = Field(
        default=None,
        description="Parsed bestemmingsplan data",
    )
    job_id: str | None = Field(
        default=None,
        description="ARQ job ID if parsing is in progress",
    )
    status: Literal["complete", "in_progress", "queued", "failed", "not_available", "pdf_not_found"] = Field(
        description="Current parsing status. 'pdf_not_found' signals frontend to show upload option."
    )
    upload_required: bool = Field(
        default=False,
        description="True when PDF auto-download failed — frontend shows upload UI per user decision",
    )
    error_message: str | None = Field(
        default=None,
        description="Error description if failed",
    )
    disclaimer_banner: str = Field(
        default="AI-geanalyseerd — Controleer bij notaris voor investeringsbeslissingen",
        description="Section-level Dutch disclaimer banner",
    )


class JobStatusResponse(BaseModel):
    """Response schema for job status polling endpoint."""

    job_id: str = Field(
        description="ARQ job identifier"
    )
    status: Literal["queued", "in_progress", "complete", "failed", "not_found"] = Field(
        description="Current job status"
    )
    progress_pct: int = Field(
        default=0,
        description="Estimated progress percentage (0-100)",
    )
    message: str | None = Field(
        default=None,
        description="Human-readable status message",
    )
    data: BestemmingsplanParsed | None = Field(
        default=None,
        description="Parsed data when complete",
    )
    error: str | None = Field(
        default=None,
        description="Error message when failed",
    )
