"""Parcel opportunity scoring service.

Provides weighted scoring with transparent per-factor breakdowns for client conversations.
Fixed scoring formula for all organizations (per-org weights deferred per user decision).

Scoring factors determine default sort order (most promising parcels first).
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

# Scoring weights exported for documentation and client transparency
SCORING_WEIGHTS = {
    "vacant_land": 30,  # max points: 30
    "size_optimal": 25,  # max points: 25
    "zoning_residential": 25,  # max points: 25
    "recent_permits": 20,  # max points: 20
}


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
        parcel_data: Object with attributes: has_pand, area_m2, bestemmingen, enrichment_data
                     Works with both ParcelCache ORM instances and test mocks.

    Returns:
        ScoreBreakdown with total_score, category, and factors dict.

    Scoring factors:
        - vacant_land (30 points max): has_pand=False → 30, has_pand=True → 0
        - size_optimal (25 points max): 500-2000m² → 25, 300-500 or 2000-3000m² → 15, else → 5
        - zoning_residential (25 points max): bestemmingen contains type "Wonen" → 25, else → 0
        - recent_permits (20 points max): >=3 permits in last 3 years → 20, 1-2 permits → 10, 0 → 0

    Category thresholds:
        - High >= 70
        - Medium >= 40
        - Low < 40
    """
    factors: dict[str, float] = {}

    # Factor 1: Vacant land (30 points max)
    factors["vacant_land"] = 0.0 if parcel_data.has_pand else 30.0

    # Factor 2: Size optimal (25 points max)
    factors["size_optimal"] = _score_size_optimal(parcel_data.area_m2)

    # Factor 3: Zoning residential (25 points max)
    factors["zoning_residential"] = _score_zoning_residential(parcel_data.bestemmingen)

    # Factor 4: Recent permits (20 points max)
    factors["recent_permits"] = _score_recent_permits(parcel_data.enrichment_data)

    # Calculate total score
    total_score = sum(factors.values())

    # Determine category
    if total_score >= 70:
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


def _score_size_optimal(area_m2: float | None) -> float:
    """
    Score parcel size optimality.

    - 500-2000m² → 25 points (optimal for development)
    - 300-500m² or 2000-3000m² → 15 points (suboptimal but viable)
    - else → 5 points (too small or too large)
    - None → 0 points
    """
    if area_m2 is None:
        return 0.0

    if 500 <= area_m2 <= 2000:
        return 25.0
    elif (300 <= area_m2 < 500) or (2000 < area_m2 <= 3000):
        return 15.0
    else:
        return 5.0


def _score_zoning_residential(bestemmingen: list | None) -> float:
    """
    Score residential zoning.

    - Contains type "Wonen" → 25 points
    - else → 0 points
    """
    if not bestemmingen:
        return 0.0

    for bestemming in bestemmingen:
        if isinstance(bestemming, dict) and bestemming.get("type") == "Wonen":
            return 25.0

    return 0.0


def _score_recent_permits(enrichment_data: dict | None) -> float:
    """
    Score recent permits activity.

    - >=3 permits in last 3 years → 20 points
    - 1-2 permits in last 3 years → 10 points
    - 0 permits → 0 points

    Args:
        enrichment_data: Dict with optional "vergunningen" list containing
                        dicts with "publicatiedatum" field (YYYY-MM-DD format)
    """
    if not enrichment_data:
        return 0.0

    vergunningen = enrichment_data.get("vergunningen", [])
    if not vergunningen:
        return 0.0

    # Count permits in last 3 years
    now = datetime.utcnow()
    three_years_ago = now - timedelta(days=3 * 365)

    recent_count = 0
    for vergunning in vergunningen:
        pub_date_str = vergunning.get("publicatiedatum")
        if not pub_date_str:
            continue

        try:
            pub_date = datetime.strptime(pub_date_str, "%Y-%m-%d")
            if pub_date >= three_years_ago:
                recent_count += 1
        except (ValueError, TypeError):
            # Skip invalid dates
            continue

    if recent_count >= 3:
        return 20.0
    elif recent_count >= 1:
        return 10.0
    else:
        return 0.0
