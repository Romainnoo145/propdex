"""Score v3.0 Engine — Dual-subscore model: Potentie + Risico.

Replaces v2.1's 5-factor vacancy-heavy model with 21 factors integrating
all data sources accumulated since v10.0. Backend scoring only — frontend
types updated separately.

Usage:
    result = compute_score_v3(parcel_data, neighborhood_metrics)
    # result.potentie_score: 0-100
    # result.risico_score: 0-100
    # result.overall: potentie × (1 - risico_discount), 0-100
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass
class FactorResult:
    """Single factor scoring result with narrative."""

    waarde: Any
    genormaliseerde_score: float  # 0-1
    gewicht: float
    bijdrage: float  # score * gewicht
    categorie: Literal["potentie", "risico"]
    toelichting_kort: str
    toelichting_lang: str
    data_bronnen: list[str] = field(default_factory=list)
    missing: bool = False
    # M046/S01 RM-1: structured access naar dev-type filtering metadata
    # voor factoren die op jurisprudence-aggregation leunen. Nullable
    # — alleen gevuld voor vergunnings_succeskans + juridisch_klimaat.
    # Surface in frontend expanded view (M046/S06 OBS-2).
    succeskans_missing: bool | None = None
    succeskans_reason: str | None = None
    dev_type_ruling_count: int | None = None
    total_ruling_count: int | None = None


@dataclass
class ScoreV3Result:
    """Complete Score v3.0 output."""

    potentie_score: float  # 0-100
    risico_score: float  # 0-100
    overall: float  # potentie × (1 - risico_discount), 0-100
    category: str  # Hoog / Gemiddeld / Laag
    score_breakdown: dict[str, FactorResult] = field(default_factory=dict)
    model_version: str = "score-v3.0"
    missing_factor_count: int = 0


# Raw max weights per category
_POTENTIE_MAX = 80  # sum of 8 potentie gewichten
_RISICO_MAX = 87  # sum of 13 risico gewichten (67 + 5+6+5+4 for env factors)

# Critical risk factors that get -10% penalty when missing
_CRITICAL_RISK_FACTORS = {"funderingsrisico", "bodemverontreiniging", "asbest"}

# Default weights — single source of truth for presets and re-score job
DEFAULT_WEIGHTS: dict[str, Any] = {
    "potentie_weights": {
        "vrije_grond": 12,
        "optoppotentie": 10,
        "bestemming": 12,
        "leegstand": 8,
        "funda_frictie": 5,
        "perceelgrootte": 12,
        "demografie": 8,
        "vergunning_succeskans": 13,
    },
    "risico_weights": {
        "funderingsrisico": 15,
        "asbest": 6,
        "bodemverontreiniging": 7,
        "monument": 5,
        "bestemmingswijziging": 8,
        "constructieve_staat": 7,
        "juridisch_klimaat": 8,
        "criminaliteit": 6,
        "max_hoogte_bereikt": 5,
        "natura2000": 5,
        "overstromingsrisico": 6,
        "geluid": 5,
        "luchtkwaliteit": 4,
    },
    "potentie_risico_balance": 0.7,
    "score_threshold": 50,
}


def compute_score_v3(
    parcel_data: dict[str, Any],
    neighborhood_metrics: dict[str, Any] | None = None,
    custom_weights: dict[str, Any] | None = None,
) -> ScoreV3Result:
    """Compute Score v3.0 with dual Potentie + Risico subscores.

    Args:
        parcel_data: flags_dict-style data from scan_results (area_m2,
            has_pand, bouwjaar, bestemmingen, building_metrics,
            vacancy_signal, market_signals, bodem, bodemtype,
            funderingsrisico, energielabel, vergunningen,
            natura2000, overstromingsrisico, geluid, luchtkwaliteit).
        neighborhood_metrics: CBS wijk data from area_scans
            (demografie, inkomen, huishoudens, criminaliteit,
            juridisch_klimaat).
        custom_weights: Optional per-org weight overrides with keys
            'potentie_weights', 'risico_weights', 'potentie_risico_balance'.

    Returns:
        ScoreV3Result with potentie/risico scores, overall (0-100), breakdown.
    """
    # Import here to avoid circular import (factors imports FactorResult)
    from app.services.score_v3_factors import (
        score_asbest,
        score_bestemming,
        score_bestemmingswijziging,
        score_bodemverontreiniging,
        score_constructieve_staat,
        score_criminaliteit,
        score_demografie,
        score_funda_frictie,
        score_funderingsrisico,
        score_geluid,
        score_juridisch_klimaat,
        score_leegstand,
        score_luchtkwaliteit,
        score_max_hoogte_bereikt,
        score_monument,
        score_natura2000,
        score_optoppotentie,
        score_overstromingsrisico,
        score_perceelgrootte,
        score_vergunning_succeskans,
        score_vrije_grond,
    )

    # Compute all 21 factors
    breakdown: dict[str, FactorResult] = {
        # Potentie (8)
        "vrije_grond": score_vrije_grond(parcel_data),
        "optoppotentie": score_optoppotentie(parcel_data),
        "bestemming": score_bestemming(parcel_data),
        "leegstand": score_leegstand(parcel_data),
        "funda_frictie": score_funda_frictie(parcel_data),
        "perceelgrootte": score_perceelgrootte(parcel_data),
        "demografie": score_demografie(neighborhood_metrics),
        "vergunning_succeskans": score_vergunning_succeskans(neighborhood_metrics),
        # Risico (13)
        "funderingsrisico": score_funderingsrisico(parcel_data),
        "asbest": score_asbest(parcel_data),
        "bodemverontreiniging": score_bodemverontreiniging(parcel_data),
        "monument": score_monument(parcel_data),
        "bestemmingswijziging": score_bestemmingswijziging(parcel_data),
        "constructieve_staat": score_constructieve_staat(parcel_data),
        "juridisch_klimaat": score_juridisch_klimaat(neighborhood_metrics),
        "criminaliteit": score_criminaliteit(neighborhood_metrics),
        "max_hoogte_bereikt": score_max_hoogte_bereikt(parcel_data),
        "natura2000": score_natura2000(parcel_data),
        "overstromingsrisico": score_overstromingsrisico(parcel_data),
        "geluid": score_geluid(parcel_data),
        "luchtkwaliteit": score_luchtkwaliteit(parcel_data),
    }

    # Apply missing data strategy
    _apply_missing_data_strategy(breakdown)

    # Apply custom weights if provided
    if custom_weights:
        _apply_custom_weights(breakdown, custom_weights)

    # Calculate subscores
    potentie_factors = {k: v for k, v in breakdown.items() if v.categorie == "potentie"}
    risico_factors = {k: v for k, v in breakdown.items() if v.categorie == "risico"}

    raw_potentie = sum(f.bijdrage for f in potentie_factors.values())
    raw_risico = sum(f.bijdrage for f in risico_factors.values())

    potentie_score = (raw_potentie / _POTENTIE_MAX) * 100
    risico_score = (raw_risico / _RISICO_MAX) * 100

    potentie_score = max(0.0, min(100.0, round(potentie_score, 1)))
    risico_score = max(0.0, min(100.0, round(risico_score, 1)))

    # Discount model: overall = potentie × (1 - risico_discount)
    balance = float((custom_weights or {}).get("potentie_risico_balance", 0.7))
    _MAX_DISCOUNT = 0.5
    risico_discount = min(_MAX_DISCOUNT, (risico_score / 100.0) * (1.0 - balance))
    overall = round(potentie_score * (1.0 - risico_discount), 1)
    overall = max(0.0, min(100.0, overall))

    if overall > 60:
        category = "Hoog"
    elif overall > 30:
        category = "Gemiddeld"
    else:
        category = "Laag"

    missing_count = sum(1 for f in breakdown.values() if f.missing)

    return ScoreV3Result(
        potentie_score=potentie_score,
        risico_score=risico_score,
        overall=overall,
        category=category,
        score_breakdown=breakdown,
        model_version="score-v3.0",
        missing_factor_count=missing_count,
    )


def _apply_custom_weights(
    breakdown: dict[str, FactorResult],
    custom_weights: dict[str, Any],
) -> None:
    """Apply per-org weight overrides to factor breakdown.

    Mutates FactorResult objects in-place. Only updates bijdrage —
    genormaliseerde_score is never affected.
    """
    potentie_w = custom_weights.get("potentie_weights") or {}
    risico_w = custom_weights.get("risico_weights") or {}
    for name, factor in breakdown.items():
        weight_map = potentie_w if factor.categorie == "potentie" else risico_w
        if name in weight_map:
            new_weight = float(weight_map[name])
            factor.gewicht = new_weight
            factor.bijdrage = round(factor.genormaliseerde_score * new_weight, 4)


def _apply_missing_data_strategy(breakdown: dict[str, FactorResult]) -> None:
    """Apply missing data handling: neutral defaults, critical penalties,
    and weight redistribution when >20% factors missing per category.

    Mutates FactorResult objects in-place.
    """
    # 1. Critical risk factor penalty: add 10% of max factor score
    for name, factor in breakdown.items():
        if factor.missing and name in _CRITICAL_RISK_FACTORS:
            penalty = 0.1  # 10% of normalized max (1.0)
            factor.genormaliseerde_score = min(1.0, factor.genormaliseerde_score + penalty)
            factor.bijdrage = round(factor.genormaliseerde_score * factor.gewicht, 4)

    # 2. Weight redistribution when >20% missing per category
    for cat in ("potentie", "risico"):
        cat_factors = {k: v for k, v in breakdown.items() if v.categorie == cat}
        missing = [k for k, v in cat_factors.items() if v.missing]
        present = [k for k, v in cat_factors.items() if not v.missing]

        if len(cat_factors) == 0:
            continue

        missing_ratio = len(missing) / len(cat_factors)
        if missing_ratio <= 0.2 or not present:
            continue

        # Redistribute missing weights proportionally to present factors
        total_missing_weight = sum(cat_factors[k].gewicht for k in missing)
        total_present_weight = sum(cat_factors[k].gewicht for k in present)

        if total_present_weight <= 0:
            continue

        for k in present:
            factor = breakdown[k]
            extra = total_missing_weight * (factor.gewicht / total_present_weight)
            factor.gewicht = round(factor.gewicht + extra, 4)
            factor.bijdrage = round(factor.genormaliseerde_score * factor.gewicht, 4)

        # Zero out missing factor contributions (their weight redistributed)
        for k in missing:
            factor = breakdown[k]
            factor.gewicht = 0
            factor.bijdrage = 0
