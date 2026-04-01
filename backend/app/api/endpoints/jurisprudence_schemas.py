"""Pydantic response schemas for jurisprudence API endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ── Search ────────────────────────────────────────────────────────


class JurisprudenceSearchResponse(BaseModel):
    """Search results from Rechtspraak Open Data API."""

    status: str
    results: list[dict[str, Any]]


# ── Gemeente rulings ─────────────────────────────────────────────


class RulingItem(BaseModel):
    """Serialized ruling from RulingCache."""

    ecli: str
    court_code: str | None = None
    instantie: str | None = None
    datum_uitspraak: str | None = None
    title: str | None = None
    summary: str | None = None
    extracted_gemeente: str | None = None
    geo_relevance: str | None = None
    uitkomst: str | None = None
    vergunningstype: str | None = None
    fetched_at: str | None = None


class WinLoss(BaseModel):
    """Win/loss ratio aggregation."""

    toegewezen: int = 0
    afgewezen: int = 0
    gedeeltelijk: int = 0
    onbekend: int = 0
    total: int = 0


class GemeenteRulingsResponse(BaseModel):
    """Cached omgevingsrecht rulings for a gemeente."""

    status: str
    rulings: list[RulingItem]
    win_loss: WinLoss
    doorlooptijd: dict[str, Any]
    ingestion_status: str
    count: int


# ── Document ──────────────────────────────────────────────────────


class JurisprudenceDocResponse(BaseModel):
    """Full jurisprudence document content by ECLI."""

    status: str
    document: dict[str, Any]


# ── Analysis trigger / status ─────────────────────────────────────


class AnalysisTriggerResponse(BaseModel):
    """Response after triggering ruling analysis for a gemeente."""

    status: str  # "complete" | "partial"
    gemeente_naam: str
    juridisch_klimaat_score: int
    vergunnings_succeskans: int
    ruling_analyses: list[dict[str, Any]]
    analyzed_count: int
    pending_count: int
    total_count: int
    job_id: str | None = None
    analyzed_at: str


class AnalysisStatusResponse(BaseModel):
    """Polling status of ruling analysis for a gemeente."""

    status: str  # "complete" | "in_progress" | "not_found"
    gemeente_naam: str
    juridisch_klimaat_score: int | None = None
    vergunnings_succeskans: int | None = None
    ruling_analyses: list[dict[str, Any]] | None = None
    analyzed_count: int | None = None
    pending_count: int | None = None
    total_count: int | None = None


# ── Doorlooptijd ──────────────────────────────────────────────────


class DoorlooptijdResponse(BaseModel):
    """Procedure duration statistics per vergunningstype.

    The endpoint returns ``{"status": "success", **stats}`` where stats
    comes from ``get_doorlooptijd_stats``.
    """

    status: str
    gemeente_naam: str
    stats: list[dict[str, Any]]
    total_count: int
    overall_avg_dagen: int | None = None


# ── Explorer ──────────────────────────────────────────────────────


class ExplorerRulingItem(BaseModel):
    """A ruling in the explorer results list."""

    ecli: str
    court_code: str | None = None
    instantie: str | None = None
    datum_uitspraak: str | None = None
    title: str | None = None
    summary: str | None = None
    extracted_gemeente: str | None = None
    uitkomst: str | None = None
    vergunningstype: str | None = None
    rechtsgronden: list[str] = Field(default_factory=list)
    doorlooptijd_dagen: int | None = None
    ai_analysis: dict[str, Any] | None = None


class DoorlooptijdPerType(BaseModel):
    """Doorlooptijd stats for a single vergunningstype."""

    vergunningstype: str
    count: int
    avg_dagen: int | None = None
    min_dagen: int | None = None
    max_dagen: int | None = None


class OpponentProfile(BaseModel):
    """Aggregated opponent (tegenstander) profile."""

    naam: str
    zaken: int
    gewonnen: int = 0
    verloren: int = 0


class FacetItem(BaseModel):
    """A single facet value with count."""

    value: str
    count: int


class ExplorerResponse(BaseModel):
    """Faceted explorer results for court rulings."""

    results: list[ExplorerRulingItem]
    total_count: int
    has_more: bool
    facets: dict[str, list[FacetItem]]
    doorlooptijd_per_type: list[DoorlooptijdPerType]
    opponent_profiles: list[OpponentProfile]


# ── Trend ─────────────────────────────────────────────────────────


class TrendMonth(BaseModel):
    """A single month bucket in trend data."""

    month: str
    total: int
    toegewezen: int
    afgewezen: int
    gedeeltelijk: int
    klimaat_score: int
    avg_doorlooptijd: int | None = None


class TrendSummary(BaseModel):
    """Aggregated summary across all trend months."""

    total_rulings: int
    avg_doorlooptijd: int | None = None
    succes_pct: int
    months_with_data: int


class TrendResponse(BaseModel):
    """Rolling 12-month trend data for a gemeente."""

    gemeente_naam: str
    months: list[TrendMonth]
    summary: TrendSummary
