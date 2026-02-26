"""Parcel opportunity scoring service.

5-factor scoring formula targeting "leeg/onderbenut" (empty/underutilized) parcels.
Uses BAG building status, construction year, zoning, size, and combination bonuses
to identify promising development opportunities.

Scoring factors determine default sort order (most promising parcels first).
"""

import re
from dataclasses import dataclass
from typing import Any

# Scoring weights exported for documentation and client transparency
SCORING_WEIGHTS = {
    "pand_status_signal": 40,
    "underutilization": 30,
    "zoning_value": 20,
    "footprint_size": 5,
    "building_age": 5,
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


@dataclass
class OpportunityInsights:
    """Non-score diagnostics used to explain why a parcel is interesting."""

    vacancy_signal: str  # leeg_perceel | leegstaand_pand | in_gebruik | onbekend
    signals: list[str]
    building_metrics: dict[str, float | None]


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
    has_pand = bool(getattr(parcel_data, "has_pand", True))
    bouwjaar = getattr(parcel_data, "bouwjaar", None)
    area_m2 = getattr(parcel_data, "area_m2", None)
    vacancy_signal = _classify_vacancy_signal(has_pand, pand_status)
    building_metrics = extract_building_metrics(parcel_data.bestemmingen)

    # Factor 1: Pand status signal (40 points max)
    factors["pand_status_signal"] = _score_pand_status(has_pand, pand_status)

    # Factor 2: Building age (5 points max)
    factors["building_age"] = _score_building_age(bouwjaar)

    # Factor 3: TAR/FAR build intensity potential (20 points max)
    factors["zoning_value"] = _score_zoning_value(parcel_data.bestemmingen, building_metrics)

    # Factor 4: Footprint size (5 points max)
    factors["footprint_size"] = _score_footprint_size(area_m2)

    # Factor 5: Underutilization (30 points max) — dominant factor
    factors["underutilization"] = _score_underutilization(
        vacancy_signal, area_m2, building_metrics
    )

    base_total = sum(factors.values())
    total_score, guardrail_delta = _apply_vacancy_guardrail(base_total, vacancy_signal)
    factors["vacancy_guardrail"] = guardrail_delta
    total_score = max(0.0, min(100.0, total_score))

    if total_score >= 60:
        category = "High"
    elif total_score >= 35:
        category = "Medium"
    else:
        category = "Low"

    return ScoreBreakdown(
        total_score=total_score,
        category=category,
        factors=factors,
    )


def derive_opportunity_insights(parcel_data) -> OpportunityInsights:
    """
    Derive transparent opportunity signals without changing ranking score.

    This complements compute_opportunity_score with qualitative indicators
    (vacancy, zoning metrics) that users can understand immediately.
    """
    has_pand = bool(getattr(parcel_data, "has_pand", True))
    pand_status = (getattr(parcel_data, "pand_status", None) or "").strip()
    bouwjaar = getattr(parcel_data, "bouwjaar", None)
    area_m2 = getattr(parcel_data, "area_m2", None)
    bestemmingen = getattr(parcel_data, "bestemmingen", None)

    vacancy_signal = _classify_vacancy_signal(has_pand, pand_status)
    building_metrics = extract_building_metrics(bestemmingen)
    signals: list[str] = []

    if vacancy_signal == "leeg_perceel":
        signals.append("Leeg perceel (geen pand geregistreerd)")
    elif vacancy_signal == "leegstaand_pand":
        signals.append("Leegstaand/buiten gebruik pand")
    elif vacancy_signal == "in_gebruik":
        signals.append("Pand momenteel in gebruik")
    else:
        signals.append("Leegstand onbekend (status onduidelijk)")

    if bouwjaar is not None and bouwjaar < 1970:
        signals.append("Oud pand (pre-1970)")

    if area_m2 is not None and area_m2 >= 500:
        signals.append("Voldoende schaal voor herontwikkeling")

    if _is_residential_or_mixed(bestemmingen):
        signals.append("Bestemming ondersteunt wonen/gemengd")

    if building_metrics["max_bebouwingspercentage"] is not None:
        signals.append(
            f"Max bebouwingspercentage: {building_metrics['max_bebouwingspercentage']:.1f}%"
        )
    if building_metrics["max_floor_area_ratio"] is not None:
        signals.append(
            f"Max FAR: {building_metrics['max_floor_area_ratio']:.2f}"
        )

    return OpportunityInsights(
        vacancy_signal=vacancy_signal,
        signals=signals,
        building_metrics=building_metrics,
    )


def _score_pand_status(has_pand: bool, pand_status: str) -> float:
    """
    Score based on BAG status with strong vacancy emphasis.

    Leeg perceel (geen pand) → 40
    Sloop/niet in gebruik/buiten gebruik → 36-38
    Bouw/verbouw traject → 20-24
    In gebruik → 0
    Unknown/empty → 12
    """
    if not has_pand:
        return 40.0

    status_lower = pand_status.lower().strip() if pand_status else ""

    if not status_lower:
        return 12.0

    if "sloop" in status_lower or "niet in gebruik" in status_lower:
        return 38.0
    if "buiten gebruik" in status_lower:
        return 36.0
    if "bouwvergunning" in status_lower:
        return 24.0
    if "verbouw" in status_lower:
        return 20.0
    if "bouw gestart" in status_lower:
        return 22.0
    if "in gebruik" in status_lower:
        return 0.0

    return 12.0


def _classify_vacancy_signal(has_pand: bool, pand_status: str) -> str:
    """Classify vacancy signal from BAG status and building presence."""
    if not has_pand:
        return "leeg_perceel"

    status_lower = pand_status.lower().strip() if pand_status else ""
    if not status_lower:
        return "onbekend"

    if any(
        kw in status_lower
        for kw in ("niet in gebruik", "buiten gebruik", "sloop", "gesloopt", "niet gerealiseerd")
    ):
        return "leegstaand_pand"

    if "in gebruik" in status_lower:
        return "in_gebruik"

    return "onbekend"


def _apply_vacancy_guardrail(base_score: float, vacancy_signal: str) -> tuple[float, float]:
    """
    Enforce intuitive vacancy ordering in final ranking.

    Users expect in-use assets to rank below confirmed vacancy. This guardrail
    keeps scores explainable while preserving other factor contributions.

    Returns:
        (adjusted_score, delta_applied)
    """
    adjusted = base_score

    if vacancy_signal == "in_gebruik":
        adjusted = min(adjusted, 35.0)
    elif vacancy_signal == "leegstaand_pand":
        adjusted = max(adjusted, 45.0)
    elif vacancy_signal == "leeg_perceel":
        adjusted = max(adjusted, 55.0)

    return adjusted, adjusted - base_score


def _score_building_age(bouwjaar: int | None) -> float:
    """
    Light legacy signal. Older can indicate transform potential, but should not dominate.

    Pre-1940 → 5
    1940-1970 → 4
    1970-1990 → 3
    1990-2010 → 1
    2010+ → 0
    Unknown → 2
    """
    if bouwjaar is None:
        return 2.0

    if bouwjaar < 1940:
        return 5.0
    if bouwjaar < 1970:
        return 4.0
    if bouwjaar < 1990:
        return 3.0
    if bouwjaar < 2010:
        return 1.0
    return 0.0


def _is_residential_or_mixed(bestemmingen: list | None) -> bool:
    if not bestemmingen:
        return False
    for bestemming in bestemmingen:
        if not isinstance(bestemming, dict):
            continue
        btype = str(bestemming.get("type") or "").lower()
        if "wonen" in btype or "gemengd" in btype or "centrum" in btype:
            return True
    return False


def extract_building_metrics(bestemmingen: list | None) -> dict[str, float | None]:
    """
    Extract zoning build metrics (if present) from bestemmingen payload.

    Returns max values discovered across overlapping bestemmingen.
    """
    max_bebouwingspercentage: float | None = None
    max_far: float | None = None

    if not bestemmingen:
        return {
            "max_bebouwingspercentage": None,
            "max_floor_area_ratio": None,
        }

    for bestemming in bestemmingen:
        if not isinstance(bestemming, dict):
            continue

        bebouwing = _to_float(bestemming.get("max_bebouwingspercentage"))
        far = _to_float(bestemming.get("max_floor_area_ratio"))

        if bebouwing is not None:
            max_bebouwingspercentage = (
                bebouwing
                if max_bebouwingspercentage is None
                else max(max_bebouwingspercentage, bebouwing)
            )

        if far is not None:
            max_far = far if max_far is None else max(max_far, far)

        # Backward-compatible parsing for raw maatvoering text fields.
        maatvoering_text = " ".join(
            str(v)
            for v in (
                bestemming.get("maatvoering"),
                bestemming.get("naam"),
                bestemming.get("aanduiding"),
            )
            if v is not None
        ).lower()

        values_in_text = _extract_numeric_values(maatvoering_text)
        if values_in_text:
            if "bebouwingspercentage" in maatvoering_text:
                candidate = max(values_in_text)
                max_bebouwingspercentage = (
                    candidate
                    if max_bebouwingspercentage is None
                    else max(max_bebouwingspercentage, candidate)
                )
            if any(token in maatvoering_text for token in ("fsi", "far", "floor area", "vloeroppervlakte")):
                candidate = max(values_in_text)
                max_far = candidate if max_far is None else max(max_far, candidate)

    return {
        "max_bebouwingspercentage": max_bebouwingspercentage,
        "max_floor_area_ratio": max_far,
    }


def _to_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(",", ".")
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _extract_numeric_values(text: str) -> list[float]:
    matches = re.findall(r"-?\d+(?:[.,]\d+)?", text)
    values: list[float] = []
    for m in matches:
        try:
            values.append(float(m.replace(",", ".")))
        except ValueError:
            continue
    return values


def _score_zoning_value(
    bestemmingen: list | None,
    building_metrics: dict[str, float | None],
) -> float:
    """
    Score TAR/FAR-driven build intensity first, bestemming second.
    """
    far = building_metrics.get("max_floor_area_ratio")
    bebouwingspct = building_metrics.get("max_bebouwingspercentage")

    if far is not None:
        if far >= 2.5:
            base = 20.0
        elif far >= 1.8:
            base = 16.0
        elif far >= 1.2:
            base = 12.0
        elif far >= 0.8:
            base = 8.0
        else:
            base = 4.0

        # Additional upside when allowed coverage is high.
        if bebouwingspct is not None:
            if bebouwingspct >= 80:
                base += 2.0
            elif bebouwingspct >= 60:
                base += 1.0
        return min(base, 20.0)

    # Fallback when FAR/TAR is missing.
    if not bestemmingen:
        return 2.0

    best_score = 0.0
    for bestemming in bestemmingen:
        if not isinstance(bestemming, dict):
            continue
        btype = (bestemming.get("type") or "").lower()

        if "gemengd" in btype or "centrum" in btype:
            best_score = max(best_score, 10.0)
        elif "wonen" in btype:
            best_score = max(best_score, 8.0)
        elif "maatschappelijk" in btype:
            best_score = max(best_score, 6.0)
        elif "bedrijven" in btype or "bedrijf" in btype:
            best_score = max(best_score, 5.0)
        elif "agrarisch" in btype:
            best_score = max(best_score, 3.0)

    return best_score


def _score_footprint_size(area_m2: float | None) -> float:
    """
    Light size contribution only.

    >5000m² → 5
    2000-5000 → 4
    1000-2000 → 3
    500-1000 → 2
    200-500 → 1
    <200 → 1
    None → 0
    """
    if area_m2 is None:
        return 0.0

    if area_m2 > 5000:
        return 5.0
    if area_m2 >= 2000:
        return 4.0
    if area_m2 >= 1000:
        return 3.0
    if area_m2 >= 500:
        return 2.0
    if area_m2 >= 200:
        return 1.0
    return 1.0


def _score_underutilization(
    vacancy_signal: str,
    area_m2: float | None,
    building_metrics: dict[str, float | None],
) -> float:
    """
    Dominant signal for unused area potential.

    Focus: vacant parcels/buildings + scale + planning envelope.
    """
    score = 0.0

    if vacancy_signal == "leeg_perceel":
        score += 20.0
    elif vacancy_signal == "leegstaand_pand":
        score += 18.0
    elif vacancy_signal == "onbekend":
        score += 6.0

    if area_m2 is not None:
        if area_m2 >= 3000:
            score += 8.0
        elif area_m2 >= 1500:
            score += 6.0
        elif area_m2 >= 750:
            score += 4.0
        elif area_m2 >= 300:
            score += 2.0

    far = building_metrics.get("max_floor_area_ratio")
    if far is not None:
        if far >= 2.0:
            score += 7.0
        elif far >= 1.2:
            score += 5.0
        elif far >= 0.8:
            score += 3.0

    return min(score, 30.0)
