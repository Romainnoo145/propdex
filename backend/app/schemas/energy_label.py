"""Energy label schema from EP-Online V5 API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class EnergyLabel(BaseModel):
    """Registered energy label from EP-Online V5.

    Fields based on EP-Online V5 API response (public.ep-online.nl/swagger).
    All external-API fields are Optional — EP-Online may return 404 for
    unregistered VBOs, and field names are provisional (MEDIUM confidence).
    Phase 53 will validate field names against a live API call.
    """

    # Core label data
    energieklasse: str | None = Field(
        default=None,
        description="Energy class (A++++, A+++, A++, A+, A, B, C, D, E, F, G)",
    )
    registratie_datum: str | None = Field(
        default=None,
        description="ISO 8601 registration date",
    )
    geldig_tot: str | None = Field(
        default=None,
        description="ISO 8601 expiry date (registration + 10 years)",
    )
    is_geldig: bool | None = Field(
        default=None,
        description="True if label is currently valid (geldigTot > today)",
    )

    # Technical detail
    berekenings_type: str | None = Field(
        default=None,
        description="Calculation methodology (e.g., 'NTA 8800', 'Bouwbesluit 2012')",
    )
    soort_opname: str | None = Field(
        default=None,
        description="Survey type (e.g., 'Basisopname', 'Gedetailleerde opname')",
    )
    opname_datum: str | None = Field(
        default=None,
        description="Date of energy survey",
    )

    # Identifiers
    bag_vbo_id: str | None = Field(
        default=None,
        description="BAG verblijfsobject ID used for lookup",
    )

    # Data quality
    is_geregistreerd: bool = Field(
        default=False,
        description="False when property has no registered label (normal for ~20-30% of properties)",
    )
    niet_geregistreerd_reden: str | None = Field(
        default=None,
        description="Dutch explanation when label is absent (e.g., 'Niet geregistreerd')",
    )
