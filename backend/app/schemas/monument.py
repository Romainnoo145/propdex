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

    @model_validator(mode="after")
    def compute_monument_status(self) -> MonumentStatus:
        """Compute is_monument from sources."""
        # Set is_monument to True if ANY source says it's a monument
        self.is_monument = any(
            source.is_monument is True for source in self.sources if source.error is None
        )
        return self
