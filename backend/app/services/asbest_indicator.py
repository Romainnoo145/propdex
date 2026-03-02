"""Bouwjaar-based asbest risk indicator per NEN 2991."""

from __future__ import annotations

from app.schemas.address import BuildingData
from app.schemas.property import AsbestIndicator

_NEN_2991 = "NEN 2991"


def assess_asbest_risk(*, building: BuildingData | None) -> AsbestIndicator:
    """
    Assess asbest risk based on building's bouwjaar.

    Risk bands per NEN 2991:
    - bouwjaar >= 1994: geen (asbest banned in building materials since Jan 1, 1994)
    - bouwjaar 1963-1993: hoog (heavy asbestos use period)
    - bouwjaar < 1963: middel (pre-industrial period, possible but less common)
    - bouwjaar None: onbekend
    """
    if building is None or building.bouwjaar is None:
        return AsbestIndicator(
            risk="onbekend",
            bouwjaar=None,
            reden="Bouwjaar niet beschikbaar — asbestrisico kan niet worden bepaald.",
        )

    bouwjaar = building.bouwjaar

    if bouwjaar >= 1994:
        return AsbestIndicator(
            risk="geen",
            bouwjaar=bouwjaar,
            reden=(
                f"Bouwjaar {bouwjaar} — na 1 januari 1994. "
                "Asbest was op dat moment al verboden in bouwmaterialen."
            ),
        )
    elif bouwjaar >= 1963:
        return AsbestIndicator(
            risk="hoog",
            bouwjaar=bouwjaar,
            norm_reference=_NEN_2991,
            reden=(
                f"Bouwjaar {bouwjaar} — periode 1963\u20131993. "
                "Asbesthoudende materialen zijn waarschijnlijk aanwezig. "
                "Asbestinventarisatie verplicht voor sloop of ingrijpende verbouwing (NEN 2991)."
            ),
        )
    else:
        return AsbestIndicator(
            risk="middel",
            bouwjaar=bouwjaar,
            norm_reference=_NEN_2991,
            reden=(
                f"Bouwjaar {bouwjaar} — voor 1963. "
                "Asbest was minder gangbaar maar kan aanwezig zijn in oudere materialen."
            ),
        )
