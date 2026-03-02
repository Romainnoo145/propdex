"""Bodemloket WBB dossier schemas for soil contamination data. Phase 68."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class WBBDossierRef(BaseModel):
    """Single WBB (Wet bodembescherming) dossier reference from Bodemloket ArcGIS REST.

    All fields are optional because Bodemloket data quality varies and some fields
    may be null in the live API response (e.g., STATUSVER is frequently null).
    """

    wbb_dossier_dbk: int | None = Field(
        default=None,
        description="Primary key OID for the WBB dossier (WBB_DOSSIER_DBK)",
    )
    sikb_id: str | None = Field(
        default=None,
        description="SIKB reference number for cross-system linkage (SIKB_ID)",
    )
    type_cd: str | None = Field(
        default=None,
        description="Contamination type code (TYPE_CD), e.g., '20'",
    )
    vervolg_wbb: str | None = Field(
        default=None,
        description="Follow-up status under WBB (VERVOLG_WBB), e.g., 'voldoende onderzocht'",
    )
    statusver: str | None = Field(
        default=None,
        description="Sanering/remediation status (STATUSVER), often null for unfinished cases",
    )
    status_oord: str | None = Field(
        default=None,
        description="Contamination verdict/assessment (STATUS_OORD), e.g., 'niet ernstig'",
    )
    administrator_nm: str | None = Field(
        default=None,
        description="Competent authority name (ADMINISTRATOR_NM), e.g., 'Schiermonnikoog'",
    )
    locatiecode_bevoegd_gezag: str | None = Field(
        default=None,
        description="Authority location code (LOCATIECODE_BEVOEGD_GEZAG)",
    )
    bis_loccode: str | None = Field(
        default=None,
        description="BIS location code (BIS_LOCCODE) for Bodeminformatiesysteem linkage",
    )


class BodemData(BaseModel):
    """Aggregated bodem (soil contamination) data from Bodemloket ArcGIS REST.

    BODEM-03 compliance: dossiers=[] means no WBB registrations found within
    the query buffer. This is NOT a quality guarantee — see disclaimer.
    """

    dossiers: list[WBBDossierRef] = Field(
        default_factory=list,
        description=(
            "List of WBB dossier references within the query buffer. "
            "Empty list = no registrations found (not a clean-ground certificate)."
        ),
    )
    disclaimer: str = Field(
        description="Mandatory disclaimer per Bodemloket usage terms. Always non-empty.",
    )
    queried_at: datetime | None = Field(
        default=None,
        description="Timestamp of the original query (for future use / cache metadata)",
    )
