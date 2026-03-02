"""Deterministic Wkb gevolgklasse classification."""

from __future__ import annotations

from app.schemas.address import BuildingData
from app.schemas.monument import MonumentStatus
from app.schemas.property import WkbClassification

_VERBOUWING_STATUS = "verbouwing pand"


def classify_wkb(
    *,
    building: BuildingData | None,
    monuments: MonumentStatus | None,
) -> WkbClassification:
    """
    Classify Wkb gevolgklasse for a property.

    Exclusion order: rijksmonument first, verbouwing second, then GK classification.
    Returns optimistic wkb_applicable=True when no exclusion applies (Phase 71 CTA).
    """
    # Exclusion 1: rijksmonument (only rijksmonumenten excluded, not gemeentelijke)
    if monuments is not None and monuments.consensus_status == "rijksmonument":
        return WkbClassification(
            wkb_applicable=False,
            gevolgklasse="niet_van_toepassing",
            exclusion_reason="rijksmonument",
        )

    # Exclusion 2: verbouwing (December 2024 ministerial ruling)
    if building is not None:
        status_lower = (building.status or "").strip().lower()
        if status_lower == _VERBOUWING_STATUS:
            return WkbClassification(
                wkb_applicable=False,
                gevolgklasse="niet_van_toepassing",
                exclusion_reason="verbouwing",
            )

    # GK1: ground-level single-family dwellings with woonfunctie gebruiksdoel
    if building is not None:
        gebruiksdoel_lower = [g.lower() for g in (building.gebruiksdoel or [])]
        if "woonfunctie" in gebruiksdoel_lower:
            return WkbClassification(
                wkb_applicable=True,
                gevolgklasse="GK1",
            )

    # Default: cannot determine — optimistic for Phase 71 CTA
    return WkbClassification(
        wkb_applicable=True,
        gevolgklasse="onbekend",
    )
