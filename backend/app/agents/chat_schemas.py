"""Pydantic schemas for the conversational Verkenner chat endpoint."""

from typing import Any, Literal

from pydantic import BaseModel, Field

# ── Intent catalog ───────────────────────────────────────────────────────

Intent = Literal[
    "PARCEL_SEARCH",
    "PARCEL_DETAIL",
    "MY_FAVORITES",
    "MY_REPORTS",
    "UNSUPPORTED",
]

# COUNT_PREVIEW is a synthetic intent produced by the PARCEL_SEARCH handler
# when the result count exceeds the threshold — never returned by classifier.
ResponseIntent = Literal[
    "PARCEL_SEARCH",
    "PARCEL_DETAIL",
    "MY_FAVORITES",
    "MY_REPORTS",
    "UNSUPPORTED",
    "COUNT_PREVIEW",
]


# ── Request / Response ───────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """User message to the Verkenner chat endpoint."""

    message: str = Field(
        min_length=1,
        max_length=2000,
        description="Natural language query in Dutch",
    )
    previous_intent: str | None = Field(
        default=None,
        description="Intent from the previous turn (for refinement context)",
    )
    previous_params: dict[str, Any] | None = Field(
        default=None,
        description="Params from the previous turn",
    )
    previous_count: int | None = Field(
        default=None,
        description="Result count from the previous turn (for count-first refinement)",
    )
    force_results: bool = Field(
        default=False,
        description="Skip count threshold — force full results for PARCEL_SEARCH",
    )


class ChatResponse(BaseModel):
    """Response from the Verkenner chat endpoint."""

    intent: ResponseIntent = Field(description="Classified or synthetic intent")
    params: dict[str, Any] = Field(
        default_factory=dict,
        description="Intent-specific structured params from classification",
    )
    data: Any = Field(
        default=None,
        description="Handler result — typed per intent (list, dict, or None)",
    )
    count: int | None = Field(
        default=None,
        description="Result count (for COUNT_PREVIEW and PARCEL_SEARCH)",
    )
    suggestions: list[str] | None = Field(
        default=None,
        description="Refinement suggestions (for COUNT_PREVIEW)",
    )
    message: str | None = Field(
        default=None,
        description="Human-readable text (UNSUPPORTED reason, etc.)",
    )
    query_id: str | None = Field(
        default=None,
        description="Persisted query ID (for CSV export, history)",
    )


# ── Parcel detail summary (returned by PARCEL_DETAIL handler) ────────────

class ParcelDetailSummary(BaseModel):
    """Lightweight property summary for inline chat display."""

    parcel_id: str
    parcel_code: str | None = None
    address: str | None = None
    municipality: str | None = None
    bouwjaar: int | None = None
    area_m2: float | None = None
    bestemming: str | None = None
    pand_status: str | None = None
    woz_waarde: int | None = None
    energielabel: str | None = None
    has_report: bool = False
    report_id: str | None = None


# ── Favorites summary (returned by MY_FAVORITES handler) ─────────────────

class FavoriteSummary(BaseModel):
    """Lightweight favorite for inline chat display."""

    parcel_id: str
    address: str | None = None
    gemeente_naam: str | None = None
    wijk_naam: str | None = None
    pipeline_stage: str
    potentie_score: float | None = None
    risico_score: float | None = None


# ── Report summary (returned by MY_REPORTS handler) ──────────────────────

class ReportSummary(BaseModel):
    """Lightweight report for inline chat display."""

    id: str
    report_name: str
    address: str | None = None
    city: str | None = None
    created_at: str


# ── Bulk favorites ───────────────────────────────────────────────────────

class BulkFavoriteCreate(BaseModel):
    """Request body for bulk-adding parcels to favorites."""

    parcel_ids: list[str] = Field(
        max_length=500,
        description="Kadaster parcel IDs to add",
    )
    gemeente_code: str | None = Field(default=None, max_length=10)
    gemeente_naam: str | None = Field(default=None, max_length=100)


class BulkFavoriteResponse(BaseModel):
    """Response from bulk favorites creation."""

    created: int = Field(description="Newly created favorites")
    existing: int = Field(description="Already existed (idempotent)")
    failed: int = Field(description="Failed to create")
