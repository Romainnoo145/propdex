"""Bouwjaar + gebruiksdoel-based asbest risk indicator per NEN 2991."""

from __future__ import annotations

from app.schemas.address import BuildingData
from app.schemas.property import AsbestIndicator

_NEN_2991 = "NEN 2991"

_ELEVATED_GEBRUIKSDOEL = {"industriefunctie", "onderwijsfunctie"}

_RISK_SEVERITY = {"hoog": 3, "middel": 2, "geen": 1, "onbekend": 0}


def _has_elevated_gebruiksdoel(
    gebruiksdoel: list[str],
) -> tuple[bool, str | None]:
    """Check if any gebruiksdoel is in the elevated-risk set (case-insensitive)."""
    for gd in gebruiksdoel:
        lower = gd.lower()
        if lower in _ELEVATED_GEBRUIKSDOEL:
            return True, lower
    return False, None


def assess_asbest_risk(*, building: BuildingData | None) -> AsbestIndicator:
    """
    Assess asbest risk based on building's bouwjaar and gebruiksdoel.

    Risk bands per NEN 2991 (bouwjaar baseline):
    - bouwjaar >= 1994: geen (asbest banned in building materials since Jan 1, 1994)
    - bouwjaar 1963-1993: hoog (heavy asbestos use period)
    - bouwjaar < 1963: middel (pre-industrial period, possible but less common)
    - bouwjaar None: onbekend

    Gebruiksdoel uplift (additive only, never reduces baseline):
    - industriefunctie / onderwijsfunctie: uplift to at least middel
    - Only applies when baseline is not onbekend
    """
    if building is None or building.bouwjaar is None:
        return AsbestIndicator(
            risk="onbekend",
            bouwjaar=building.bouwjaar if building else None,
            reden="Bouwjaar niet beschikbaar — asbestrisico kan niet worden bepaald.",
        )

    bouwjaar = building.bouwjaar

    # Compute bouwjaar baseline
    if bouwjaar >= 1994:
        baseline_risk = "geen"
        baseline_reden = (
            f"Bouwjaar {bouwjaar} — na 1 januari 1994. "
            "Asbest was op dat moment al verboden in bouwmaterialen."
        )
        baseline_norm = None
    elif bouwjaar >= 1963:
        baseline_risk = "hoog"
        baseline_reden = (
            f"Bouwjaar {bouwjaar} — periode 1963\u20131993. "
            "Asbesthoudende materialen zijn waarschijnlijk aanwezig. "
            "Asbestinventarisatie verplicht voor sloop of ingrijpende verbouwing (NEN 2991)."
        )
        baseline_norm = _NEN_2991
    else:
        baseline_risk = "middel"
        baseline_reden = (
            f"Bouwjaar {bouwjaar} — voor 1963. "
            "Asbest was minder gangbaar maar kan aanwezig zijn in oudere materialen."
        )
        baseline_norm = _NEN_2991

    # Gebruiksdoel uplift (additive only)
    elevated, matched = _has_elevated_gebruiksdoel(building.gebruiksdoel or [])
    gebruiksdoel_factor: str | None = None
    final_risk = baseline_risk
    final_reden = baseline_reden
    final_norm = baseline_norm

    if elevated and matched and baseline_risk != "onbekend":
        uplifted_risk = "middel"  # Gebruiksdoel uplift target
        if _RISK_SEVERITY[uplifted_risk] > _RISK_SEVERITY[baseline_risk]:
            final_risk = uplifted_risk
            final_norm = _NEN_2991
        gebruiksdoel_factor = matched
        final_reden += (
            f" Gebouwfunctie ({matched}) verhoogt het risico"
            " — asbest was veelgebruikt in dit type gebouw."
        )

    return AsbestIndicator(
        risk=final_risk,
        bouwjaar=bouwjaar,
        norm_reference=final_norm,
        gebruiksdoel_factor=gebruiksdoel_factor,
        reden=final_reden,
    )
