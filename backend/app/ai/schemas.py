"""Pydantic schemas for AI document parsing with Claude.

Design principle: Claude's JSON output is unpredictable — field names vary
between Dutch and English, lists may arrive as strings, fields may be missing.
Every field has a default, every list field coerces strings, every model accepts
both Dutch and English field names via aliases + populate_by_name.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


def _coerce_to_list(v: Any) -> list[str]:
    """Accept a string, list, or None and always return list[str]."""
    if v is None:
        return []
    if isinstance(v, str):
        if "; " in v:
            return [s.strip() for s in v.split("; ") if s.strip()]
        if "\n" in v:
            return [s.strip() for s in v.split("\n") if s.strip()]
        return [v]
    if isinstance(v, list):
        return [str(item) for item in v if item]
    return []


# ── Building dimensions (AI-extracted) ───────────────────────────

class BuildingDimensionsAI(BaseModel):
    """Building dimension constraints extracted by AI from bestemmingsplan text."""

    max_bouwhoogte: float | None = None
    max_goothoogte: float | None = None
    max_bebouwingspercentage: float | None = None
    max_floor_area_ratio: float | None = None
    max_oppervlakte: float | None = None
    max_inhoud: float | None = None
    overige: dict[str, str] = Field(default_factory=dict)


# ── Single zoning rule ───────────────────────────────────────────

class BestemmingsregelExtract(BaseModel):
    """Single zoning rule extracted from bestemmingsplan PDF by AI."""

    model_config = {"populate_by_name": True, "extra": "ignore"}

    artikel: str = Field(default="", alias="article")
    bestemming: str = Field(default="Onbekend", alias="designation")
    toegestane_gebruiken: list[str] = Field(default_factory=list, alias="permitted_uses")
    verboden_gebruiken: list[str] = Field(default_factory=list, alias="forbidden_uses")
    bouwregels: BuildingDimensionsAI | None = Field(default=None, alias="building_rules")
    parkeereis: str | None = Field(default=None, alias="parking_requirement")
    milieu_restricties: list[str] = Field(default_factory=list, alias="environmental_restrictions")
    bijzondere_voorwaarden: list[str] = Field(default_factory=list, alias="special_conditions")
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = "MEDIUM"
    disclaimer: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _coerce_all_fields(cls, data: Any) -> Any:
        """Coerce every field to the expected type — Claude is wildly inconsistent."""
        if not isinstance(data, dict):
            return data
        # list[str] fields: accept string → wrap in list
        for key in (
            "toegestane_gebruiken", "permitted_uses",
            "verboden_gebruiken", "forbidden_uses",
            "milieu_restricties", "environmental_restrictions",
            "bijzondere_voorwaarden", "special_conditions",
        ):
            if key in data:
                data[key] = _coerce_to_list(data[key])
        # str fields: accept list/dict → flatten into string
        for key in ("parkeereis", "parking_requirement", "artikel", "article", "bestemming", "designation", "disclaimer"):
            val = data.get(key)
            if val is not None and not isinstance(val, str):
                if isinstance(val, dict):
                    data[key] = "; ".join(f"{k}: {v}" for k, v in val.items()) if val else None
                elif isinstance(val, list):
                    data[key] = "; ".join(str(x) for x in val) if val else None
                else:
                    data[key] = str(val)
        return data


# ── Complete parsed bestemmingsplan ──────────────────────────────

class BestemmingsplanParsed(BaseModel):
    """Complete AI-parsed bestemmingsplan output from Claude."""

    model_config = {"populate_by_name": True, "extra": "ignore"}

    plan_naam: str = Field(default="Onbekend", alias="plan_name")
    plan_idn: str = Field(default="", alias="plan_id")
    regels: list[BestemmingsregelExtract] = Field(default_factory=list, alias="rules")
    overall_confidence: Literal["HIGH", "MEDIUM", "LOW"] = Field(default="MEDIUM", alias="confidence")
    disclaimers: list[str] = Field(default_factory=list)
    samenvatting: str = Field(default="Geen samenvatting beschikbaar.", alias="summary")

    @field_validator("disclaimers", mode="before")
    @classmethod
    def _coerce_disclaimers(cls, v: Any) -> list[str]:
        return _coerce_to_list(v)

    @field_validator("regels", mode="before")
    @classmethod
    def _coerce_regels(cls, v: Any) -> list:
        """Accept None or non-list gracefully."""
        if v is None:
            return []
        if isinstance(v, list):
            return v
        return []

    @model_validator(mode="before")
    @classmethod
    def _normalize_keys(cls, data: Any) -> Any:
        """Map common Claude key variants to our field names."""
        if not isinstance(data, dict):
            return data
        # Claude sometimes uses these alternative keys
        mappings = {
            "plan_name": "plan_naam",
            "plan_id": "plan_idn",
            "rules": "regels",
            "confidence": "overall_confidence",
            "summary": "samenvatting",
        }
        for alt, canonical in mappings.items():
            if alt in data and canonical not in data:
                data[canonical] = data.pop(alt)
        return data


# ── AI parsing section (property report inclusion) ───────────────

class AIParsingSection(BaseModel):
    """AI-parsed data section for inclusion in property report."""

    parsed_plan: BestemmingsplanParsed | None = None
    job_id: str | None = None
    status: Literal[
        "complete", "in_progress", "queued", "failed",
        "not_available", "pdf_not_found", "opt_in_required",
    ] = "not_available"
    upload_required: bool = False
    error_message: str | None = None
    disclaimer_banner: str = "AI-geanalyseerd — Controleer bij notaris voor investeringsbeslissingen"


class JobStatusResponse(BaseModel):
    """Response schema for job status polling endpoint."""

    job_id: str
    status: Literal["queued", "in_progress", "complete", "failed", "not_found"] = "queued"
    progress_pct: int = 0
    message: str | None = None
    data: BestemmingsplanParsed | None = None
    error: str | None = None


# ── Jurisprudence analysis schemas (unchanged) ───────────────────

class RulingAnalysis(BaseModel):
    """AI analysis of a single court ruling for property development risk."""

    ecli: str
    bezwaargrond: str = ""
    uitkomst: Literal["toegewezen", "afgewezen", "gedeeltelijk", "onbekend"] = "onbekend"
    relevantie: str = ""
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = "MEDIUM"
    vergunningstype: str = "overig"
    rechtsgronden: list[Literal[
        "procedurefout",
        "motiveringsgebrek",
        "gelijkheidsbeginsel",
        "disproportioneel",
        "etfal_ruimtelijke_ordening",
    ]] = Field(default_factory=list)
    tegenstanders: list[str] = Field(default_factory=list)


class DoorlooptijdStats(BaseModel):
    """Per-vergunningstype procedure duration statistics."""

    vergunningstype: str
    count: int = 0
    avg_dagen: int | None = None
    min_dagen: int | None = None
    max_dagen: int | None = None
    insufficient_data: bool = False


class JuridischAnalysisResult(BaseModel):
    """Aggregated AI analysis of court rulings for a municipality.

    M046/S01 RM-1: scores are nullable — None when the dev-type filtered
    sample is below MIN_DEV_RULINGS_FOR_AGGREGATION. Previously defaulted
    to 50, which collided with the legitimate "50% success rate" semantics.
    Callers must check succeskans_missing before trusting the scores.
    """

    gemeente_naam: str
    juridisch_klimaat_score: int | None = Field(default=None, ge=0, le=100)
    vergunnings_succeskans: int | None = Field(default=None, ge=0, le=100)
    succeskans_missing: bool = Field(default=False)
    succeskans_reason: str | None = Field(default=None)
    dev_type_ruling_count: int = Field(default=0, ge=0)
    risico_samenvatting: str = ""
    top_risico_factoren: list[str] = Field(default_factory=list)
    ruling_analyses: list[RulingAnalysis] = Field(default_factory=list)
    doorlooptijd: dict[str, DoorlooptijdStats] | None = None
    disclaimer: str = "Indicatief — gebaseerd op historische uitspraken, geen juridisch advies"
    analyzed_at: str = ""
