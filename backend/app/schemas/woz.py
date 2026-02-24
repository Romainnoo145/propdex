"""WOZ (waardering onroerende zaken) schema."""

from __future__ import annotations

from pydantic import BaseModel, Field


class WOZWaarde(BaseModel):
    """Single WOZ assessment value for one peildatum."""

    vastgestelde_waarde: int | None = Field(
        default=None,
        description="Assessed value in euros (integer — WOZ values are whole euros)",
    )
    peildatum: str | None = Field(
        default=None,
        description="Valuation reference date (ISO 8601, e.g., '2024-01-01')",
    )
    toestandspeildatum: str | None = Field(
        default=None,
        description="Condition reference date for this valuation",
    )


class WOZData(BaseModel):
    """WOZ object data from waardeloket or WOZ Bevragen API.

    All external-API fields are Optional — field names are provisional (MEDIUM confidence).
    Phase 53 will validate field names against a live API call.

    Note: WOZ Bevragen (Kadaster) is municipality-only; SaaS clients use the
    public WOZ Waardeloket endpoint. low_confidence=True indicates scraped data.
    """

    woz_objectnummer: str | None = Field(
        default=None,
        description="WOZ object registration number",
    )

    # Most recent valuation (for display)
    meest_recente_waarde: int | None = Field(
        default=None,
        description="Most recent vastgesteldeWaarde in euros",
    )
    meest_recente_peildatum: str | None = Field(
        default=None,
        description="Peildatum for the most recent value",
    )

    # Historical values (optional)
    waarden: list[WOZWaarde] = Field(
        default_factory=list,
        description="All known WOZ values by peildatum",
    )
    grondoppervlakte: int | None = Field(
        default=None,
        description="Ground surface area in m² from WOZ registration",
    )

    # Data quality
    low_confidence: bool = Field(
        default=False,
        description="True when data comes from unofficial waardeloket scrape (not Kadaster API)",
    )
    low_confidence_reden: str | None = Field(
        default=None,
        description="Dutch explanation of confidence limitation (shown in UI per WOZ-04)",
    )
    bron: str = Field(
        default="WOZ Waardeloket",
        description="Data source attribution",
    )
