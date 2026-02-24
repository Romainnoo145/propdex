"""BRK Bevragen V2 ownership schema.

CRITICAL: BRK eigendomsdata MUST NEVER be cached or stored (Kadaster Tier 3).
This schema is used for live display only — stripped from report before DB save.
The never_cache class-level marker signals the save layer to actively strip this field.
"""

from __future__ import annotations

from typing import ClassVar, Literal

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


class PerceelOwnership(BaseModel):
    """Ownership data for a single cadastral perceel.

    Groups all rights holders for one kadastraalOnroerendeZaak.
    """

    perceel_identificatie: str = Field(
        description="PDOK/BRK kadastraalOnroerendeZaakIdentificatie (NL.IMKAD.KadastraalObject.XXXXXXXX)",
    )
    gerechtigden: list[ZakelijkGerechtigde] = Field(
        default_factory=list,
        description="List of rights holders for this perceel",
    )
    heeft_hypotheek: bool = Field(
        default=False,
        description="True if a mortgage (hypotheek) is registered on this perceel",
    )


class BRKOwnership(BaseModel):
    """Ownership and rights data from BRK Bevragen V2.

    CRITICAL: never_cache = True — strip from report before JSONB save.
    BRK eigendomsdata MUST NEVER be cached or stored (Kadaster Tier 3 never-store terms).
    This field MUST be excluded from model_dump() before DB persist.

    Three-state status:
    - 'available': BRK data successfully fetched; data array populated
    - 'unavailable': BRK not configured (PKIOverheid cert pending) or no perceel found
    - 'error': BRK configured but API call failed
    """

    # Class-level never_cache marker — checked by save layer before JSONB persist.
    # ClassVar is excluded from Pydantic serialization (does not appear in model_dump output).
    never_cache: ClassVar[bool] = True

    status: Literal["available", "unavailable", "error"] = Field(
        description="'available'=BRK data fetched; 'unavailable'=not configured/no cert; 'error'=cert present but API failed",
    )
    data: list[PerceelOwnership] | None = Field(
        default=None,
        description="Per-perceel ownership records (None when status != 'available')",
    )
    reason: str | None = Field(
        default=None,
        description="Dutch-language reason (populated when status='unavailable' or 'error')",
    )
    fetched_at: str | None = Field(
        default=None,
        description="ISO 8601 UTC timestamp of live BRK query",
    )
    admin_hint: str | None = Field(
        default=None,
        description="Admin-facing hint shown when status='unavailable' — indicates required PKIOverheid setup",
    )
