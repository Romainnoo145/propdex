"""Gemeente profile and raadsinformatie schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class GemeenteProfile(BaseModel):
    """Aggregated regulatory posture for a municipality."""

    gemeente_naam: str = Field(description="Municipality display name")
    severity_label: str = Field(
        description="Regulatory climate severity: Gunstig / Gemiddeld / Ongunstig / Zeer ongunstig / Onbekend",
    )
    approval_rate_pct: float | None = Field(
        default=None,
        description="Percentage of permits granted (verleend) out of decided permits",
    )
    rejection_rate_pct: float | None = Field(
        default=None,
        description="Percentage of permits rejected (geweigerd/buiten behandeling)",
    )
    avg_doorlooptijd_days: int | None = Field(
        default=None,
        description="Median court procedure duration in days (from RulingCache)",
    )
    bekendmakingen_30d: int = Field(default=0, description="Bekendmakingen in last 30 days")
    bekendmakingen_90d: int = Field(default=0, description="Bekendmakingen in last 90 days")
    bekendmakingen_365d: int = Field(default=0, description="Bekendmakingen in last year")
    permit_type_distribution: dict[str, int] = Field(
        default_factory=dict,
        description="Permit count by category (e.g. Omgevingsvergunning, Sloop)",
    )
    sample_size: int = Field(default=0, description="Total permit records used")
    data_coverage: str = Field(
        default="none",
        description="Data confidence: high (>50), medium (10-50), low (<10), none (0)",
    )


class RaadsstukResponse(BaseModel):
    """A single council document from Open Raadsinformatie."""

    doc_id: str = Field(description="ORI document ID")
    titel: str = Field(description="Document title")
    datum: str | None = Field(default=None, description="Document date (ISO 8601)")
    type: str | None = Field(default=None, description="Document type (AgendaItem, Meeting, etc.)")
    samenvatting: str | None = Field(default=None, description="Summary or description preview")
    bron_url: str | None = Field(default=None, description="Link to original document on ORI")


class RaadsinformatieResponse(BaseModel):
    """Raadsinformatie search results for a municipality."""

    gemeente_naam: str = Field(description="Municipality display name")
    dekking: bool = Field(description="Whether the gemeente is covered by ORI")
    stukken: list[RaadsstukResponse] = Field(default_factory=list, description="Council documents")
    total_found: int = Field(default=0, description="Total documents found")


class SubsidieResponse(BaseModel):
    """A development-relevant subsidy from RVO."""

    id: str = Field(description="RVO subsidy ID")
    title: str = Field(description="Subsidy name")
    intro: str | None = Field(default=None, description="Short description")
    url: str | None = Field(default=None, description="Link to RVO page")
    sectors: list[str] = Field(default_factory=list, description="Relevant sectors")
    targets: list[str] = Field(default_factory=list, description="Target groups")


class SubsidiesResponse(BaseModel):
    """Development-relevant subsidies list."""

    subsidies: list[SubsidieResponse] = Field(default_factory=list)
    total: int = Field(default=0, description="Number of relevant subsidies")
    source: str = Field(default="RVO", description="Data source")
