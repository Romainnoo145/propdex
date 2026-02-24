"""BRK Bevragen V2 ownership schema.

CRITICAL: BRK eigendomsdata MUST NEVER be cached or stored (Kadaster Tier 3).
This schema is used for live display only — stripped from report before DB save.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ZakelijkGerechtigde(BaseModel):
    """A single rights holder on the cadastral object.

    Per BRK-02: show eigenaar type only, never show personal names (AVG compliance).
    """

    eigenaar_type: Literal[
        "natuurlijk_persoon", "rechtspersoon", "overheid", "onbekend"
    ] = Field(
        default="onbekend",
        description="Owner type — personal names/addresses are NEVER returned (AVG)",
    )
    zakelijk_recht_type: str | None = Field(
        default=None,
        description="Right type (e.g., 'Eigendom', 'Opstal', 'Erfpacht', 'Vruchtgebruik')",
    )
    aandeel: str | None = Field(
        default=None,
        description="Ownership share (e.g., '1/2' for half-ownership)",
    )


class BRKOwnership(BaseModel):
    """Ownership and rights data from BRK Bevragen V2.

    CRITICAL: Never cache or store this data.
    Strip from PropertyReportResponse before JSONB save.

    All external-API fields are Optional — field names are provisional (MEDIUM confidence).
    Phase 53 will validate field names against the live BRK Bevragen V2 API.
    """

    gerechtigden: list[ZakelijkGerechtigde] = Field(
        default_factory=list,
        description="List of rights holders",
    )
    heeft_hypotheek: bool = Field(
        default=False,
        description="True if a mortgage (hypotheek) is registered on this object",
    )
    aantal_eigenaren: int | None = Field(
        default=None,
        description="Total number of rights holders",
    )
    actueel_opgevraagd: str | None = Field(
        default=None,
        description="ISO 8601 timestamp when data was fetched (shown in UI per BRK-06)",
    )

    # Data availability
    is_beschikbaar: bool = Field(
        default=False,
        description="False when BRK is unconfigured (PKIOverheid cert pending)",
    )
    niet_beschikbaar_reden: str | None = Field(
        default=None,
        description="Dutch explanation when BRK is unavailable",
    )
