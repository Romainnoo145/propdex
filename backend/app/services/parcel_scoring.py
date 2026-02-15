"""Parcel opportunity scoring service.

5-factor scoring formula targeting "leeg/onderbenut" (empty/underutilized) parcels.
Uses BAG building status, construction year, zoning, size, and combination bonuses
to identify promising development opportunities.

Scoring factors determine default sort order (most promising parcels first).
"""

from dataclasses import dataclass

# Scoring weights exported for documentation and client transparency
SCORING_WEIGHTS = {
    "pand_status_signal": 30,
    "building_age": 20,
    "zoning_value": 25,
    "footprint_size": 15,
    "underutilization": 10,
}

# Qualification thresholds
QUALIFICATION_THRESHOLD = 40.0
MAX_QUALIFYING = 150


@dataclass
class ScoreBreakdown:
    """Score breakdown with category label and per-factor contributions."""

    total_score: float  # 0-100
    category: str  # High, Medium, Low
    factors: dict[str, float]  # factor_name → contribution


def compute_opportunity_score(parcel_data) -> ScoreBreakdown:
    """
    Compute opportunity score for a parcel with transparent per-factor breakdown.

    Args:
        parcel_data: Object with attributes: has_pand, area_m2, bestemmingen,
                     bouwjaar, pand_status.
                     Works with both ParcelCache ORM instances and test mocks.

    Returns:
        ScoreBreakdown with total_score, category, and factors dict.
    """
    factors: dict[str, float] = {}

    pand_status = getattr(parcel_data, "pand_status", None) or ""
    bouwjaar = getattr(parcel_data, "bouwjaar", None)

    # Factor 1: Pand status signal (30 points max)
    factors["pand_status_signal"] = _score_pand_status(pand_status)

    # Factor 2: Building age (20 points max)
    factors["building_age"] = _score_building_age(bouwjaar)

    # Factor 3: Zoning value (25 points max)
    factors["zoning_value"] = _score_zoning_value(parcel_data.bestemmingen)

    # Factor 4: Footprint size (15 points max)
    factors["footprint_size"] = _score_footprint_size(parcel_data.area_m2)

    # Factor 5: Underutilization combo bonus (10 points max)
    factors["underutilization"] = _score_underutilization(
        pand_status, bouwjaar, parcel_data.area_m2
    )

    total_score = sum(factors.values())

    if total_score >= 65:
        category = "High"
    elif total_score >= 40:
        category = "Medium"
    else:
        category = "Low"

    return ScoreBreakdown(
        total_score=total_score,
        category=category,
        factors=factors,
    )


def _score_pand_status(pand_status: str) -> float:
    """
    Score based on BAG building status.

    Sloopvergunning/niet in gebruik → 30
    Buiten gebruik → 25
    Bouwvergunning verleend → 20
    Verbouwing → 10
    In gebruik → 0
    Unknown/empty → 15
    """
    status_lower = pand_status.lower().strip() if pand_status else ""

    if not status_lower:
        return 15.0

    if "sloop" in status_lower or "niet in gebruik" in status_lower:
        return 30.0
    if "buiten gebruik" in status_lower:
        return 25.0
    if "bouwvergunning" in status_lower:
        return 20.0
    if "verbouw" in status_lower:
        return 10.0
    if "in gebruik" in status_lower:
        return 0.0

    return 15.0


def _score_building_age(bouwjaar: int | None) -> float:
    """
    Score based on construction year. Older = higher opportunity.

    Pre-1940 → 20
    1940-1970 → 15
    1970-1990 → 10
    1990-2010 → 5
    2010+ → 0
    Unknown → 10
    """
    if bouwjaar is None:
        return 10.0

    if bouwjaar < 1940:
        return 20.0
    if bouwjaar < 1970:
        return 15.0
    if bouwjaar < 1990:
        return 10.0
    if bouwjaar < 2010:
        return 5.0
    return 0.0


def _score_zoning_value(bestemmingen: list | None) -> float:
    """
    Score based on zoning type. Higher-value zones score more.

    Gemengd/Centrum → 25
    Wonen → 20
    Maatschappelijk → 15
    Bedrijven → 10
    Agrarisch → 5
    None/unknown → 0
    """
    if not bestemmingen:
        return 0.0

    best_score = 0.0
    for bestemming in bestemmingen:
        if not isinstance(bestemming, dict):
            continue
        btype = (bestemming.get("type") or "").lower()

        if "gemengd" in btype or "centrum" in btype:
            best_score = max(best_score, 25.0)
        elif "wonen" in btype:
            best_score = max(best_score, 20.0)
        elif "maatschappelijk" in btype:
            best_score = max(best_score, 15.0)
        elif "bedrijven" in btype or "bedrijf" in btype:
            best_score = max(best_score, 10.0)
        elif "agrarisch" in btype:
            best_score = max(best_score, 5.0)

    return best_score


def _score_footprint_size(area_m2: float | None) -> float:
    """
    Score based on parcel size. Larger = higher opportunity.

    >5000m² → 15
    2000-5000 → 12
    1000-2000 → 10
    500-1000 → 7
    200-500 → 4
    <200 → 1
    None → 0
    """
    if area_m2 is None:
        return 0.0

    if area_m2 > 5000:
        return 15.0
    if area_m2 >= 2000:
        return 12.0
    if area_m2 >= 1000:
        return 10.0
    if area_m2 >= 500:
        return 7.0
    if area_m2 >= 200:
        return 4.0
    return 1.0


def _score_underutilization(
    pand_status: str, bouwjaar: int | None, area_m2: float | None
) -> float:
    """
    Combination bonus for underutilization signals.

    Vacant + large (>1000m²) → +5
    Vacant + old (pre-1970) → +3
    Old (pre-1970) + large (>1000m²) → +2
    Capped at 10.
    """
    status_lower = (pand_status or "").lower().strip()
    is_vacant = any(
        kw in status_lower
        for kw in ("sloop", "niet in gebruik", "buiten gebruik")
    )
    is_old = bouwjaar is not None and bouwjaar < 1970
    is_large = area_m2 is not None and area_m2 > 1000

    bonus = 0.0
    if is_vacant and is_large:
        bonus += 5.0
    if is_vacant and is_old:
        bonus += 3.0
    if is_old and is_large:
        bonus += 2.0

    return min(bonus, 10.0)
