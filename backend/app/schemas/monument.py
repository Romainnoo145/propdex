"""Monument status schemas for multi-source heritage information."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class MonumentSourceResult(BaseModel):
    """Monument information from a single source."""

    source: str = Field(
        description="Source identifier (one of 'RCE', 'BAG', 'Kadaster')",
    )
    is_monument: bool | None = Field(
        default=None,
        description="Whether this source indicates monument status",
    )
    monument_type: str | None = Field(
        default=None,
        description="Type of monument (e.g., 'rijksmonument', 'gemeentelijk')",
    )
    monument_nummer: str | None = Field(
        default=None,
        description="Monument registration number",
    )
    monument_naam: str | None = Field(
        default=None,
        description="Monument name or description",
    )
    cached_at: str | None = Field(
        default=None,
        description="ISO 8601 timestamp when data was cached",
    )
    age_seconds: int | None = Field(
        default=None,
        description="Cache age in seconds",
    )
    error: str | None = Field(
        default=None,
        description="Error message if source lookup failed",
    )


class RCEMonumentDetail(BaseModel):
    """Detailed RCE monument data from RCE Linked Data REST API.

    Field names are LOW confidence — Phase 53 will validate against the live
    linkeddata.cultureelerfgoed.nl API. All fields are Optional to tolerate
    field name corrections.
    """

    rijksmonumentnummer: str | None = Field(
        default=None,
        description="Official rijksmonumentnummer from RCE register",
    )
    redengevende_omschrijving: str | None = Field(
        default=None,
        description="Detailed architectural/historical description (can be 1,000-5,000 words)",
    )
    oorspronkelijke_functie: str | None = Field(
        default=None,
        description="Original function of the monument",
    )
    bouwjaar_van: int | None = Field(
        default=None,
        description="Construction period start year",
    )
    bouwjaar_tot: int | None = Field(
        default=None,
        description="Construction period end year",
    )
    architect: str | None = Field(
        default=None,
        description="Architect name(s)",
    )
    bouwstijl: str | None = Field(
        default=None,
        description="Architectural style",
    )
    monument_register_url: str | None = Field(
        default=None,
        description="URL to official register entry",
    )


class MonumentStatus(BaseModel):
    """
    Aggregated monument status from multiple sources.

    Compares results from RCE, BAG, and Kadaster to detect conflicts
    and provide consensus monument status.
    """

    sources: list[MonumentSourceResult] = Field(
        description="Individual source results",
    )
    has_conflict: bool = Field(
        default=False,
        description="Whether sources disagree on monument status",
    )
    conflict_note: str | None = Field(
        default=None,
        description="Explanation of any conflicts detected",
    )
    consensus_status: str | None = Field(
        default=None,
        description="Consensus monument status from all sources",
    )
    restrictions_summary: list[str] = Field(
        default_factory=list,
        description="Summary of monument-related restrictions",
    )
    is_monument: bool = Field(
        default=False,
        description="Whether ANY source indicates monument status",
    )
    rce_detail: RCEMonumentDetail | None = Field(
        default=None,
        description="Detailed RCE monument data (enriched in Phase 55)",
    )

    @model_validator(mode="after")
    def compute_monument_status(self) -> MonumentStatus:
        """Compute is_monument from sources."""
        # Set is_monument to True if ANY source says it's a monument
        self.is_monument = any(
            source.is_monument is True for source in self.sources if source.error is None
        )
        return self
