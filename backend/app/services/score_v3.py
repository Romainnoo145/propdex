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
    percentage_of_category: float = 0.0  # gewicht/100 after registry normalization (P3)
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
    potentie_risico_balance: float = 0.7  # P2/P3: included in result for frontend M048


# Critical risk factors that get -10% penalty when missing
_CRITICAL_RISK_FACTORS = {"funderingsrisico", "bodemverontreiniging", "asbest"}


@dataclass
class FactorRegistryEntry:
    """Registry entry for a single scoring factor."""

    id: str
    category: Literal["potentie", "risico"]
    default_weight: int  # normalized so category sums to 100
    weight_by_projecttype: dict[str, int] | None  # None = use default_weight for all
    data_source: str  # human-readable provenance string


FACTOR_REGISTRY: dict[str, FactorRegistryEntry] = {
    # --- POTENTIE (9 factors, sum default_weight = 100) ---
    "vrije_grond": FactorRegistryEntry(
        id="vrije_grond",
        category="potentie",
        default_weight=13,
        weight_by_projecttype={
            "optoppen": 12,
        },
        data_source="BAG + Kadaster",
    ),
    "optoppotentie": FactorRegistryEntry(
        id="optoppotentie",
        category="potentie",
        default_weight=11,
        weight_by_projecttype={
            "optoppen": 16,
            "nieuwbouw_wonen": 7,
        },
        data_source="PLU WMS + 3D BAG",
    ),
    "bestemming": FactorRegistryEntry(
        id="bestemming",
        category="potentie",
        default_weight=13,
        weight_by_projecttype=None,
        data_source="Bestemmingsplan / Ruimtelijkeplannen.nl",
    ),
    "leegstand": FactorRegistryEntry(
        id="leegstand",
        category="potentie",
        default_weight=9,
        weight_by_projecttype=None,
        data_source="BAG",
    ),
    "funda_frictie": FactorRegistryEntry(
        id="funda_frictie",
        category="potentie",
        default_weight=5,
        weight_by_projecttype=None,
        data_source="Funda (pilot)",
    ),
    "perceelgrootte": FactorRegistryEntry(
        id="perceelgrootte",
        category="potentie",
        default_weight=13,
        weight_by_projecttype=None,
        data_source="Kadaster",
    ),
    "demografie": FactorRegistryEntry(
        id="demografie",
        category="potentie",
        default_weight=9,
        weight_by_projecttype=None,
        data_source="CBS StatLine",
    ),
    "vergunning_succeskans": FactorRegistryEntry(
        id="vergunning_succeskans",
        category="potentie",
        default_weight=15,
        weight_by_projecttype=None,
        data_source="Rechtspraak.nl",
    ),
    "woonvisie_match": FactorRegistryEntry(
        id="woonvisie_match",
        category="potentie",
        default_weight=12,
        weight_by_projecttype={
            "nieuwbouw_wonen": 16,
            "optoppen": 8,
        },
        data_source="Gemeentelijke woonvisie (LLM-extracted)",
    ),
    # --- RISICO (13 factors, sum default_weight = 100) ---
    "funderingsrisico": FactorRegistryEntry(
        id="funderingsrisico",
        category="risico",
        default_weight=16,
        weight_by_projecttype=None,
        data_source="PDOK Funderingsrisicogebieden + BAG",
    ),
    "asbest": FactorRegistryEntry(
        id="asbest",
        category="risico",
        default_weight=7,
        weight_by_projecttype=None,
        data_source="BAG",
    ),
    "bodemverontreiniging": FactorRegistryEntry(
        id="bodemverontreiniging",
        category="risico",
        default_weight=8,
        weight_by_projecttype=None,
        data_source="Bodemloket",
    ),
    "monument": FactorRegistryEntry(
        id="monument",
        category="risico",
        default_weight=6,
        weight_by_projecttype=None,
        data_source="RCE API + Bestemmingsplan",
    ),
    "bestemmingswijziging": FactorRegistryEntry(
        id="bestemmingswijziging",
        category="risico",
        default_weight=9,
        weight_by_projecttype=None,
        data_source="Bestemmingsplan / Ruimtelijkeplannen.nl",
    ),
    "constructieve_staat": FactorRegistryEntry(
        id="constructieve_staat",
        category="risico",
        default_weight=8,
        weight_by_projecttype=None,
        data_source="BAG + EP-Online",
    ),
    "juridisch_klimaat": FactorRegistryEntry(
        id="juridisch_klimaat",
        category="risico",
        default_weight=9,
        weight_by_projecttype=None,
        data_source="Rechtspraak.nl",
    ),
    "criminaliteit": FactorRegistryEntry(
        id="criminaliteit",
        category="risico",
        default_weight=7,
        weight_by_projecttype=None,
        data_source="CBS dataderden",
    ),
    "max_hoogte_bereikt": FactorRegistryEntry(
        id="max_hoogte_bereikt",
        category="risico",
        default_weight=6,
        weight_by_projecttype=None,
        data_source="PLU WMS + 3D BAG",
    ),
    "natura2000": FactorRegistryEntry(
        id="natura2000",
        category="risico",
        default_weight=6,
        weight_by_projecttype=None,
        data_source="PDOK Natura2000 WFS",
    ),
    "overstromingsrisico": FactorRegistryEntry(
        id="overstromingsrisico",
        category="risico",
        default_weight=7,
        weight_by_projecttype=None,
        data_source="Rijkswaterstaat Overstromingen WMS",
    ),
    "geluid": FactorRegistryEntry(
        id="geluid",
        category="risico",
        default_weight=6,
        weight_by_projecttype=None,
        data_source="RIVM Geluidbelasting Lden WMS",
    ),
    "luchtkwaliteit": FactorRegistryEntry(
        id="luchtkwaliteit",
        category="risico",
        default_weight=5,
        weight_by_projecttype=None,
        data_source="RIVM Luchtkwaliteit NSL WMS",
    ),
}

# Sum-guard: verified at module load. Fails fast if registry is misconfigured.
_REGISTRY_POTENTIE_SUM = sum(
    e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "potentie"
)
_REGISTRY_RISICO_SUM = sum(
    e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "risico"
)
assert _REGISTRY_POTENTIE_SUM == 100, f"Potentie weights sum {_REGISTRY_POTENTIE_SUM} != 100"
assert _REGISTRY_RISICO_SUM == 100, f"Risico weights sum {_REGISTRY_RISICO_SUM} != 100"

# Raw max weights per category — derived from FACTOR_REGISTRY (== 100 post-P1 normalization)
_POTENTIE_MAX: int = _REGISTRY_POTENTIE_SUM  # == 100
_RISICO_MAX: int = _REGISTRY_RISICO_SUM  # == 100

# All supported project types for sum-guard validation
_ALL_PROJECT_TYPES = frozenset({
    "nieuwbouw_wonen",
    "transformatie_wonen",
    "optoppen",
    "splitsen",
    "commercieel_naar_wonen",
    "onbepaald",
})


def _verify_registry_sum_guard() -> None:
    """Verify weights sum to 100 per category for every projecttype."""
    for ptype in _ALL_PROJECT_TYPES:
        for cat in ("potentie", "risico"):
            total = sum(
                (e.weight_by_projecttype or {}).get(ptype, e.default_weight)
                for e in FACTOR_REGISTRY.values()
                if e.category == cat
            )
            assert total == 100, (
                f"Registry sum-guard failed: {cat} weights for '{ptype}' = {total} (expected 100)"
            )


_verify_registry_sum_guard()

# Default weights — single source of truth for presets and re-score job
DEFAULT_WEIGHTS: dict[str, Any] = {
    "potentie_weights": {
        "vrije_grond": 13,
        "optoppotentie": 11,
        "bestemming": 13,
        "leegstand": 9,
        "funda_frictie": 5,
        "perceelgrootte": 13,
        "demografie": 9,
        "vergunning_succeskans": 15,
        "woonvisie_match": 12,
    },
    "risico_weights": {
        "funderingsrisico": 16,
        "asbest": 7,
        "bodemverontreiniging": 8,
        "monument": 6,
        "bestemmingswijziging": 9,
        "constructieve_staat": 8,
        "juridisch_klimaat": 9,
        "criminaliteit": 7,
        "max_hoogte_bereikt": 6,
        "natura2000": 6,
        "overstromingsrisico": 7,
        "geluid": 6,
        "luchtkwaliteit": 5,
    },
    "potentie_risico_balance": 0.7,
    "score_threshold": 50,
}


def compute_score_v3(
    parcel_data: dict[str, Any],
    neighborhood_metrics: dict[str, Any] | None = None,
    custom_weights: dict[str, Any] | None = None,
    project_type: str = "onbepaald",
    cascade_payloads: dict[str, Any] | None = None,
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
        project_type: Project type for conditional weight overrides from
            FACTOR_REGISTRY. Defaults to "onbepaald" (neutral weights).

    Returns:
        ScoreV3Result with potentie/risico scores, overall (0-100), breakdown.
    """
    _cascade = cascade_payloads or {}

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
        score_woonvisie_match,
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

    # Apply registry weights for project_type (P1: normalized to 100 per category)
    for factor_name, factor in breakdown.items():
        entry = FACTOR_REGISTRY.get(factor_name)
        if entry is None:
            continue  # unknown factor — leave as-is
        # Determine effective weight for this project_type
        if (
            entry.weight_by_projecttype is not None
            and project_type in entry.weight_by_projecttype
        ):
            effective_weight = float(entry.weight_by_projecttype[project_type])
        else:
            effective_weight = float(entry.default_weight)
        factor.gewicht = effective_weight
        factor.bijdrage = round(factor.genormaliseerde_score * effective_weight, 4)
        factor.percentage_of_category = round(effective_weight / 100.0, 4)

    # Apply missing data strategy
    _apply_missing_data_strategy(breakdown)

    # Re-sync percentage_of_category after redistribution (gewicht may have changed)
    for factor in breakdown.values():
        factor.percentage_of_category = round(factor.gewicht / 100.0, 4)

    # Cascade factor: woonvisie_match (payload pre-extracted, may be None).
    # Added after redistribution so it doesn't interfere with missing-data strategy
    # for the 21 core factors. Weight=0 when missing (sparse factor P5).
    _wv_result = score_woonvisie_match(
        _cascade.get("woonvisie_match"),
        wijk_naam=parcel_data.get("wijk_naam"),
        project_type=project_type,
    )
    if not _wv_result.missing:
        _wv_entry = FACTOR_REGISTRY["woonvisie_match"]
        _wv_weight = float(
            (_wv_entry.weight_by_projecttype or {}).get(project_type, _wv_entry.default_weight)
        )
        _wv_result.gewicht = _wv_weight
        _wv_result.bijdrage = round(_wv_result.genormaliseerde_score * _wv_weight, 4)
        _wv_result.percentage_of_category = round(_wv_weight / 100.0, 4)
    breakdown["woonvisie_match"] = _wv_result

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
        potentie_risico_balance=balance,
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
