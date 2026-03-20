"""Gemeente profile schemas."""

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
