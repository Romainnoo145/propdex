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
    "vacancy_subscore_weight": 0.70,
    "buildability_subscore_weight": 0.30,
}

# Qualification thresholds
QUALIFICATION_THRESHOLD = 40.0
MAX_QUALIFYING = 150


@dataclass
class ScoreBreakdown:
    """Score breakdown with category label and per-factor contributions."""

    total_score: float  # 0-100
    vacancy_subscore: float  # 0-100
    buildability_subscore: float  # 0-100
    category: str  # High, Medium, Low
    factors: dict[str, float]  # factor_name → contribution
    model_version: str  # scoring model version for reproducibility


@dataclass
class OpportunityInsights:
    """Non-score diagnostics used to explain why a parcel is interesting."""

    vacancy_signal: str  # leeg_perceel | leegstaand_pand | in_gebruik | onbekend
    signals: list[str]
    building_metrics: dict[str, float | None]


@dataclass
class VacancyConfidenceAssessment:
    """Vacancy confidence output for explainable ranking support."""

    confidence: float  # 0-1
    reasons: list[str]  # top 3 strongest contributing reasons
    factors: dict[str, float]  # contribution per factor (+/-)
    model_version: str  # model identifier for reproducibility


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

    vacancy_raw = factors["pand_status_signal"] + factors["underutilization"]
    buildability_raw = (
        factors["zoning_value"]
        + factors["footprint_size"]
        + factors["building_age"]
    )
    vacancy_subscore = _normalize_subscore(vacancy_raw, max_value=70.0)
    buildability_subscore = _normalize_subscore(buildability_raw, max_value=30.0)

    weighted_total = (
        SCORING_WEIGHTS["vacancy_subscore_weight"] * vacancy_subscore
        + SCORING_WEIGHTS["buildability_subscore_weight"] * buildability_subscore
    )
    total_score, guardrail_delta = _apply_vacancy_guardrail(weighted_total, vacancy_signal)
    factors["vacancy_subscore"] = vacancy_subscore
    factors["buildability_subscore"] = buildability_subscore
    factors["vacancy_guardrail"] = guardrail_delta
    total_score = max(0.0, min(100.0, total_score))

    if total_score >= 62:
        category = "High"
    elif total_score >= 38:
        category = "Medium"
    else:
        category = "Low"

    return ScoreBreakdown(
        total_score=total_score,
        vacancy_subscore=vacancy_subscore,
        buildability_subscore=buildability_subscore,
        category=category,
        factors=factors,
        model_version="opportunity-score-v2.1",
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


def compute_vacancy_confidence(
    parcel_data,
    permit_activity: dict[str, Any] | None = None,
    listing_signal: dict[str, Any] | None = None,
) -> VacancyConfidenceAssessment:
    """
    Compute vacancy confidence (0-1) with transparent top reasons.

    Model purpose:
    - prioritize parcels likely to be empty/underused,
    - while keeping behavior explainable for users and sales workflows.

    Inputs:
    - BAG parcel/building data (always present in scans)
    - Permit activity summary (optional, from change_records aggregates)
    - Listing signal (optional, from enrichment data when available)
    """
    has_pand = bool(getattr(parcel_data, "has_pand", True))
    pand_status = (getattr(parcel_data, "pand_status", None) or "").strip()
    bouwjaar = getattr(parcel_data, "bouwjaar", None)
    area_m2 = getattr(parcel_data, "area_m2", None)
    bestemmingen = getattr(parcel_data, "bestemmingen", None)

    vacancy_signal = _classify_vacancy_signal(has_pand, pand_status)
    building_metrics = extract_building_metrics(bestemmingen)

    confidence = 0.50
    factor_contributions: dict[str, float] = {}
    reason_contributions: list[tuple[str, float, str]] = []

    def _apply_factor(key: str, delta: float, reason: str) -> None:
        nonlocal confidence
        if delta == 0:
            return
        confidence += delta
        factor_contributions[key] = round(delta, 3)
        reason_contributions.append((key, delta, reason))

    # HARD vacancy baseline from BAG
    if vacancy_signal == "leeg_perceel":
        _apply_factor("vacancy_signal", 0.34, "HARD: Geen pand geregistreerd op perceel")
    elif vacancy_signal == "leegstaand_pand":
        _apply_factor("vacancy_signal", 0.24, "HARD: Pandstatus duidt op leegstand/buiten gebruik")
    elif vacancy_signal == "in_gebruik":
        _apply_factor("vacancy_signal", -0.30, "HARD: Pandstatus staat op in gebruik")

    # PROXY scale/planruimte indicators
    if area_m2 is not None:
        if area_m2 >= 1500:
            _apply_factor("area_scale", 0.08, "PROXY: Groot perceel ondersteunt herontwikkeling")
        elif area_m2 >= 750:
            _apply_factor("area_scale", 0.05, "PROXY: Perceelgrootte biedt uitbreidingsruimte")

    far = building_metrics.get("max_floor_area_ratio")
    bebouwingspct = building_metrics.get("max_bebouwingspercentage")

    if far is not None:
        if far >= 1.8:
            _apply_factor("zoning_far", 0.09, "PROXY: Hoge FAR geeft extra planruimte")
        elif far >= 1.2:
            _apply_factor("zoning_far", 0.06, "PROXY: FAR ondersteunt verdichting")
        elif far >= 0.8:
            _apply_factor("zoning_far", 0.03, "PROXY: Beperkte maar bruikbare FAR-ruimte")

    if bebouwingspct is not None:
        if bebouwingspct <= 60:
            _apply_factor(
                "zoning_coverage",
                0.05,
                "PROXY: Relatief lage bebouwingsgraad laat onbenutte ruimte zien",
            )
        elif bebouwingspct >= 85:
            _apply_factor(
                "zoning_coverage",
                -0.04,
                "PROXY: Hoge bebouwingsgraad beperkt extra bouwruimte",
            )

    if bouwjaar is not None and has_pand:
        if bouwjaar < 1970:
            _apply_factor("building_age", 0.04, "PROXY: Oudere bebouwing correleert met transformatiekans")
        elif bouwjaar >= 2010:
            _apply_factor("building_age", -0.03, "PROXY: Recente bebouwing wijst op actueel gebruik")

    # PROXY permit behavior
    permit = permit_activity or {}
    permit_180d = _to_non_negative_int(permit.get("permit_count_180d"))
    permit_365d = _to_non_negative_int(permit.get("permit_count_365d"))
    demolition_365d = _to_non_negative_int(permit.get("demolition_count_365d"))
    granted_365d = _to_non_negative_int(permit.get("granted_count_365d"))

    if permit_180d == 0 and permit_365d == 0:
        _apply_factor(
            "permit_quiet",
            0.06,
            "PROXY: Geen recente vergunningactiviteit op dit perceel",
        )
    elif permit_180d >= 3:
        _apply_factor(
            "permit_quiet",
            -0.08,
            "PROXY: Veel recente vergunningactiviteit wijst op actief gebruik",
        )
    elif permit_180d >= 1:
        _apply_factor(
            "permit_quiet",
            -0.03,
            "PROXY: Er is recente vergunningactiviteit",
        )

    if demolition_365d >= 1:
        _apply_factor(
            "permit_demolition",
            0.10,
            "PROXY: Sloop-gerelateerde vergunningen verhogen herontwikkelpotentie",
        )

    if granted_365d >= 2:
        _apply_factor(
            "permit_granted",
            -0.05,
            "PROXY: Meerdere recent verleende vergunningen duiden op lopende ontwikkeling",
        )

    # PROXY listing friction (when external listing source is available)
    listing = listing_signal or {}
    listing_duration = _to_non_negative_int(
        listing.get("listing_duration_days")
        or listing.get("days_on_market")
        or listing.get("listing_days_on_market")
    )
    price_change_count = _to_non_negative_int(
        listing.get("price_change_count")
        or listing.get("listing_price_change_count")
    )

    if listing_duration >= 180:
        _apply_factor(
            "listing_duration",
            0.08,
            "PROXY: Langdurige listing kan wijzen op frictie/verkoopdruk",
        )
    elif listing_duration >= 90:
        _apply_factor(
            "listing_duration",
            0.04,
            "PROXY: Listing staat al langere tijd open",
        )
    elif 0 < listing_duration <= 30:
        _apply_factor(
            "listing_duration",
            -0.03,
            "PROXY: Zeer recente listing, nog weinig frictiesignaal",
        )

    if price_change_count >= 2:
        _apply_factor(
            "listing_price_change",
            0.05,
            "PROXY: Meerdere prijsaanpassingen duiden op marktfrictie",
        )

    confidence = max(0.0, min(1.0, confidence))
    reasons = [
        reason
        for _, _, reason in sorted(
            reason_contributions,
            key=lambda item: abs(item[1]),
            reverse=True,
        )[:3]
    ]

    return VacancyConfidenceAssessment(
        confidence=round(confidence, 3),
        reasons=reasons,
        factors=factor_contributions,
        model_version="vacancy-confidence-v1",
    )


def _score_pand_status(has_pand: bool, pand_status: str) -> float:
    """
    Score based on BAG status with strong vacancy emphasis.

    Leeg perceel (geen pand) → 40
    Sloop/niet in gebruik/buiten gebruik → 34-37
    Bouw/verbouw traject → 18-22
    In gebruik → 4 (laag, maar niet hard nul)
    Unknown/empty → 10
    """
    if not has_pand:
        return 40.0

    status_lower = pand_status.lower().strip() if pand_status else ""

    if not status_lower:
        return 10.0

    if "sloop" in status_lower or "niet in gebruik" in status_lower:
        return 37.0
    if "buiten gebruik" in status_lower:
        return 34.0
    if "bouwvergunning" in status_lower:
        return 22.0
    if "verbouw" in status_lower:
        return 18.0
    if "bouw gestart" in status_lower:
        return 20.0
    if "in gebruik" in status_lower:
        return 4.0

    return 10.0


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
        adjusted = min(adjusted, 66.0)
    elif vacancy_signal == "leegstaand_pand":
        adjusted = max(adjusted, 52.0)
    elif vacancy_signal == "leeg_perceel":
        adjusted = max(adjusted, 60.0)

    return adjusted, adjusted - base_score


def _normalize_subscore(value: float, max_value: float) -> float:
    """Normalize raw factor total to a 0-100 subscore."""
    if max_value <= 0:
        return 0.0
    normalized = (value / max_value) * 100.0
    return round(max(0.0, min(100.0, normalized)), 1)


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


def extract_building_metrics(bestemmingen: list | None) -> dict[str, float | int | None]:
    """
    Extract zoning build metrics (if present) from bestemmingen payload.

    Returns max values discovered across overlapping bestemmingen.
    Always returns all four keys: max_bebouwingspercentage, max_floor_area_ratio,
    max_bouwhoogte, max_bouwlagen (values may be None).
    """
    max_bebouwingspercentage: float | None = None
    max_far: float | None = None
    max_bouwhoogte: float | None = None
    max_bouwlagen: int | None = None

    if not bestemmingen:
        return {
            "max_bebouwingspercentage": None,
            "max_floor_area_ratio": None,
            "max_bouwhoogte": None,
            "max_bouwlagen": None,
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

        # Pass through PLU WMS-extracted bouwhoogte if present
        bh = bestemming.get("max_bouwhoogte")
        if isinstance(bh, (int, float)) and 2.0 <= bh <= 100.0:
            max_bouwhoogte = float(bh) if max_bouwhoogte is None else max(max_bouwhoogte, float(bh))

        # Pass through PLU WMS-extracted bouwlagen if present
        bl = bestemming.get("max_bouwlagen")
        if isinstance(bl, int) and 1 < bl <= 50:
            max_bouwlagen = bl if max_bouwlagen is None else max(max_bouwlagen, bl)
        elif isinstance(bl, float) and 1 < bl <= 50:
            bl_int = int(round(bl))
            max_bouwlagen = bl_int if max_bouwlagen is None else max(max_bouwlagen, bl_int)

    return {
        "max_bebouwingspercentage": max_bebouwingspercentage,
        "max_floor_area_ratio": max_far,
        "max_bouwhoogte": max_bouwhoogte,
        "max_bouwlagen": max_bouwlagen,
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


def _to_non_negative_int(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, float):
        if value != value:  # NaN guard
            return 0
        return max(0, int(value))
    if isinstance(value, str):
        cleaned = value.strip().replace(",", ".")
        if not cleaned:
            return 0
        try:
            return max(0, int(float(cleaned)))
        except ValueError:
            return 0
    return 0


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
    score = {
        "leeg_perceel": 14.0,
        "leegstaand_pand": 12.0,
        "onbekend": 6.0,
        "in_gebruik": 2.0,
    }.get(vacancy_signal, 4.0)

    if area_m2 is not None:
        if area_m2 >= 5000:
            score += 9.0
        elif area_m2 >= 2500:
            score += 7.0
        elif area_m2 >= 1200:
            score += 5.0
        elif area_m2 >= 600:
            score += 3.0
        elif area_m2 >= 250:
            score += 1.5

    far = building_metrics.get("max_floor_area_ratio")
    if far is not None:
        if far >= 2.5:
            score += 7.0
        elif far >= 1.8:
            score += 5.5
        elif far >= 1.2:
            score += 4.0
        elif far >= 0.8:
            score += 2.0

    bebouwingspct = building_metrics.get("max_bebouwingspercentage")
    if bebouwingspct is not None:
        if bebouwingspct <= 45:
            score += 6.0
        elif bebouwingspct <= 60:
            score += 4.5
        elif bebouwingspct <= 75:
            score += 2.5
        elif bebouwingspct >= 90:
            score -= 1.5

    # Keep vacancy as dominant signal, but avoid hard 0/1 behavior for in-use assets.
    if vacancy_signal == "in_gebruik":
        score *= 0.55
    elif vacancy_signal == "onbekend":
        score *= 0.80

    return min(max(score, 0.0), 30.0)
