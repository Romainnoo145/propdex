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

# M050/S03 D3: 3 new BRK risico-factors participate in runtime redistribution.
# compute_score_v3 (Plan 03-03) excludes these from category-sum when missing=True
# and rescales remaining 13 active risico-factors. NOT added to
# _CRITICAL_RISK_FACTORS — no -10% penalty when missing.
_SPARSE_REDISTRIBUTABLE_RISICO: frozenset[str] = frozenset({
    "hypotheek_risico",
    "eigendoms_complexiteit",
    "koopwaarde_trend",
})


# M048/Phase 7 GROUP-01: bron-groep voor frontend UI-pagination.
# Metadata-only — geen runtime scoring impact. Lookup via FACTOR_REGISTRY[key].bron.
Bron = Literal[
    "gemeente_beleid",
    "markt",
    "fysiek",
    "klimaat",
    "juridisch",
    "planologisch",
    "brk",  # M050/S03 — BRK Eigendom-driven risico factors
]


@dataclass
class FactorRegistryEntry:
    """Registry entry for a single scoring factor."""

    id: str
    category: Literal["potentie", "risico"]
    default_weight: int  # normalized so category sums to 100
    weight_by_projecttype: dict[str, int] | None  # None = use default_weight for all
    data_source: str  # human-readable provenance string
    bron: Bron  # M048/Phase 7 GROUP-01 — UI-only bron-groep for pagination


def _rebalance_risico_weights(
    current_weights: dict[str, int],
    target_sum: int = 80,
) -> dict[str, int]:
    """Integer rebalance via largest-remainder method (M050/S03 D2).

    Used during one-time pre-S03 → post-S03 registry migration to scale 13 existing
    risico-factor weights from sum=100 to sum=80, freeing 20 weight-units for the
    3 new BRK risico-factors. Public for reuse by future weight calibrations
    (M050/S03 Carry-2).

    Algorithm:
        1. raw = {k: w * target_sum / 100 for k, w in current_weights.items()}
        2. floor_weights = {k: int(raw[k]) for k in raw}
        3. remainders = {k: raw[k] - floor_weights[k] for k in raw}
        4. shortfall = target_sum - sum(floor_weights.values())
        5. Sort keys by (-remainder, key) — largest-remainder wins, ties broken
           alphabetically for determinism.
        6. Allocate +1 to the top `shortfall` keys.

    Args:
        current_weights: existing factor weights summing to 100.
        target_sum: post-rebalance sum (80 for S03).

    Returns:
        new_weights dict, integer-valued, summing to target_sum.

    Raises:
        AssertionError: if input weights do not sum to 100 OR
            output weights do not sum to target_sum (F6 invariant).
    """
    if not current_weights:
        return {}
    input_sum = sum(current_weights.values())
    assert input_sum == 100, (
        f"_rebalance_risico_weights input must sum to 100, got {input_sum}"
    )
    raw = {k: w * target_sum / 100 for k, w in current_weights.items()}
    floor_weights = {k: int(v) for k, v in raw.items()}
    remainders = {k: raw[k] - floor_weights[k] for k in raw}
    shortfall = target_sum - sum(floor_weights.values())
    # Sort by (-remainder, key) so largest remainder wins; alphabetical tie-break
    sorted_keys = sorted(remainders.keys(), key=lambda k: (-remainders[k], k))
    new_weights = dict(floor_weights)
    for k in sorted_keys[:shortfall]:
        new_weights[k] = new_weights[k] + 1
    output_sum = sum(new_weights.values())
    assert output_sum == target_sum, (
        f"_rebalance_risico_weights output sum {output_sum} != {target_sum} (F6)"
    )
    return new_weights


FACTOR_REGISTRY: dict[str, FactorRegistryEntry] = {
    # --- POTENTIE (10 factors, sum default_weight = 100) ---
    "vrije_grond": FactorRegistryEntry(
        id="vrije_grond",
        category="potentie",
        default_weight=13,
        weight_by_projecttype={
            "optoppen": 12,
        },
        data_source="BAG + Kadaster",
        bron="fysiek",
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
        bron="fysiek",
    ),
    "bestemming": FactorRegistryEntry(
        id="bestemming",
        category="potentie",
        default_weight=11,  # was 13, rebalanced by M053/S01
        weight_by_projecttype=None,
        data_source="Bestemmingsplan / Ruimtelijkeplannen.nl",
        bron="gemeente_beleid",
    ),
    "leegstand": FactorRegistryEntry(
        id="leegstand",
        category="potentie",
        default_weight=7,  # was 9, rebalanced by M053/S01
        weight_by_projecttype=None,
        data_source="BAG",
        bron="fysiek",
    ),
    "funda_frictie": FactorRegistryEntry(
        id="funda_frictie",
        category="potentie",
        default_weight=4,  # was 5, rebalanced by M053/S01
        weight_by_projecttype=None,
        data_source="Funda (pilot)",
        bron="markt",
    ),
    "perceelgrootte": FactorRegistryEntry(
        id="perceelgrootte",
        category="potentie",
        default_weight=11,  # was 13, rebalanced by M053/S01
        weight_by_projecttype=None,
        data_source="Kadaster",
        bron="fysiek",
    ),
    "demografie": FactorRegistryEntry(
        id="demografie",
        category="potentie",
        default_weight=8,  # was 9, rebalanced by M053/S01
        weight_by_projecttype=None,
        data_source="CBS StatLine",
        bron="markt",
    ),
    "vergunning_succeskans": FactorRegistryEntry(
        id="vergunning_succeskans",
        category="potentie",
        default_weight=13,  # was 15, rebalanced by M053/S01
        weight_by_projecttype=None,
        data_source="Rechtspraak.nl",
        bron="gemeente_beleid",
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
        bron="gemeente_beleid",
    ),
    "beleidsalignement": FactorRegistryEntry(
        id="beleidsalignement",
        category="potentie",
        default_weight=10,
        weight_by_projecttype=None,  # constant — projecttype-fit lives in the score, not the weight
        data_source="Gemeentelijke omgevingsvisie (LLM-extracted)",
        bron="gemeente_beleid",
    ),
    # --- RISICO (18 factors, sum default_weight = 100) ---
    # M050/S03 D2: 13 existing factors rebalanced via _rebalance_risico_weights
    # (largest-remainder, target_sum=80) freeing 20 weight-units for 3 new BRK factors.
    # M053/S12: 16 existing factors re-rebalanced (target_sum=93) freeing 7 units
    # for splitsingsrisico (gemeente_beleid). Pre-M050 sub-sum=75, BRK sub-sum=18.
    # M054/S02: 16 core factors re-rebalanced (largest-remainder, target_sum=86)
    # freeing 7 more units for parkeerdruk (gemeente_beleid). Both cascade-gated
    # risico factors (splitsingsrisico 7 + parkeerdruk 7 = 14) are reserved from
    # the risico-100 pool, so the in-breakdown core sums to 86.
    "funderingsrisico": FactorRegistryEntry(
        id="funderingsrisico",
        category="risico",
        default_weight=11,  # 16 (M050/S03) -> 12 (M053/S12) -> 11 (M054/S02)
        weight_by_projecttype=None,
        data_source="PDOK Funderingsrisicogebieden + BAG",
        bron="fysiek",
    ),
    "asbest": FactorRegistryEntry(
        id="asbest",
        category="risico",
        default_weight=5,  # 7 (M050/S03) -> 6 -> 5 (M054/S02)
        weight_by_projecttype=None,
        data_source="BAG",
        bron="fysiek",
    ),
    "bodemverontreiniging": FactorRegistryEntry(
        id="bodemverontreiniging",
        category="risico",
        default_weight=5,  # 8 (M050/S03) -> 6 -> 5 (M054/S02)
        weight_by_projecttype=None,
        data_source="Bodemloket",
        bron="fysiek",
    ),
    "monument": FactorRegistryEntry(
        id="monument",
        category="risico",
        default_weight=5,  # was 6, rebalanced by M050/S03 D2
        weight_by_projecttype=None,
        data_source="RCE API + Bestemmingsplan",
        bron="juridisch",
    ),
    "bestemmingswijziging": FactorRegistryEntry(
        id="bestemmingswijziging",
        category="risico",
        default_weight=5,  # 9 (M050/S03) -> 6 (M053/S12) -> 5 (M054/S02)
        weight_by_projecttype=None,
        data_source="Bestemmingsplan / Ruimtelijkeplannen.nl",
        bron="planologisch",
    ),
    "constructieve_staat": FactorRegistryEntry(
        id="constructieve_staat",
        category="risico",
        default_weight=5,  # was 8 (M050/S03), 6->5 rebalanced by M053/S12
        weight_by_projecttype=None,
        data_source="BAG + EP-Online",
        bron="fysiek",
    ),
    "juridisch_klimaat": FactorRegistryEntry(
        id="juridisch_klimaat",
        category="risico",
        default_weight=5,  # 9 (M050/S03) -> 6 (M053/S12) -> 5 (M054/S02)
        weight_by_projecttype=None,
        data_source="Rechtspraak.nl",
        bron="juridisch",
    ),
    "criminaliteit": FactorRegistryEntry(
        id="criminaliteit",
        category="risico",
        default_weight=5,  # was 7 (M050/S03), 6->5 rebalanced by M053/S12
        weight_by_projecttype=None,
        data_source="CBS dataderden",
        bron="markt",  # closest fit — sociaal would require expanding enum
    ),
    "max_hoogte_bereikt": FactorRegistryEntry(
        id="max_hoogte_bereikt",
        category="risico",
        default_weight=5,  # was 6, rebalanced by M050/S03 D2
        weight_by_projecttype=None,
        data_source="PLU WMS + 3D BAG",
        bron="fysiek",
    ),
    "natura2000": FactorRegistryEntry(
        id="natura2000",
        category="risico",
        default_weight=5,  # was 6, rebalanced by M050/S03 D2
        weight_by_projecttype=None,
        data_source="PDOK Natura2000 WFS",
        bron="klimaat",
    ),
    "overstromingsrisico": FactorRegistryEntry(
        id="overstromingsrisico",
        category="risico",
        default_weight=4,  # 7 (M050/S03) -> 5 -> 4 (M054/S02)
        weight_by_projecttype=None,
        data_source="Rijkswaterstaat Overstromingen WMS",
        bron="klimaat",
    ),
    "geluid": FactorRegistryEntry(
        id="geluid",
        category="risico",
        default_weight=5,  # was 6, rebalanced by M050/S03 D2
        weight_by_projecttype=None,
        data_source="RIVM Geluidbelasting Lden WMS",
        bron="klimaat",
    ),
    "luchtkwaliteit": FactorRegistryEntry(
        id="luchtkwaliteit",
        category="risico",
        default_weight=4,  # was 5, rebalanced by M050/S03 D2
        weight_by_projecttype=None,
        data_source="RIVM Luchtkwaliteit NSL WMS",
        bron="klimaat",
    ),
    # --- M050/S03 BRK-driven risico factors (sum=20) ---
    "hypotheek_risico": FactorRegistryEntry(
        id="hypotheek_risico",
        category="risico",
        default_weight=8,  # 10 -> 9 (M053/S12) -> 8 (M054/S02)
        weight_by_projecttype=None,
        data_source="BRK Eigendom (Kadaster)",
        bron="brk",
    ),
    "eigendoms_complexiteit": FactorRegistryEntry(
        id="eigendoms_complexiteit",
        category="risico",
        default_weight=5,  # was 6, 6->5 rebalanced by M053/S12
        weight_by_projecttype=None,
        data_source="BRK Eigendom (Kadaster)",
        bron="brk",
    ),
    "koopwaarde_trend": FactorRegistryEntry(
        id="koopwaarde_trend",
        category="risico",
        default_weight=4,
        weight_by_projecttype=None,
        data_source="BRK Eigendom (Kadaster)",
        bron="brk",
    ),
    # --- M053/S12 splitsingsrisico (risico cascade — Huisvestingsverordening) ---
    "splitsingsrisico": FactorRegistryEntry(
        id="splitsingsrisico",
        category="risico",
        default_weight=7,
        weight_by_projecttype=None,
        data_source="Gemeentelijke huisvestingsverordening (LLM-extracted)",
        bron="gemeente_beleid",
    ),
    # --- M054/S02 parkeerdruk (risico cascade — Nota parkeernormen) ---
    "parkeerdruk": FactorRegistryEntry(
        id="parkeerdruk",
        category="risico",
        default_weight=7,
        weight_by_projecttype=None,  # constant — projecttype-fit lives in the score, not the weight
        data_source="Gemeentelijke Nota parkeernormen (LLM-extracted)",
        bron="gemeente_beleid",
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
        # M050/S03 D2: rebalanced (largest-remainder, sum=80) + 3 new BRK factors (sum=20).
        "funderingsrisico": 13,
        "asbest": 6,
        "bodemverontreiniging": 6,
        "monument": 5,
        "bestemmingswijziging": 7,
        "constructieve_staat": 6,
        "juridisch_klimaat": 7,
        "criminaliteit": 6,
        "max_hoogte_bereikt": 5,
        "natura2000": 5,
        "overstromingsrisico": 5,
        "geluid": 5,
        "luchtkwaliteit": 4,
        # M050/S03 — 3 new BRK risico-factors
        "hypotheek_risico": 10,
        "eigendoms_complexiteit": 6,
        "koopwaarde_trend": 4,
    },
    "potentie_risico_balance": 0.7,
    "score_threshold": 50,
}

# Cascade beleidsfactoren whose weight is decided by compute_score_v3's verdict logic
# (woonvisie_match = always context-only/0; beleidsalignement = weight only when
# verdict 'kansrijk'; splitsingsrisico = weight only when the regeling actually touches
# this parcel — van_toepassing / mogelijk_van_toepassing / vergunningstelsel_voorraad;
# parkeerdruk = weight only when verdict 'verhoogd' — een reëel parkeer-ontwikkelrisico).
# No weight path — custom-weight overrides (_apply_custom_weights) nor the rescore_weights
# recompute — may override the verdict gate for these.
CASCADE_GATED_FACTORS: frozenset[str] = frozenset(
    {"woonvisie_match", "beleidsalignement", "splitsingsrisico", "parkeerdruk"}
)

# Risico cascade factors are appended AFTER redistribution (verdict-gated), so their
# default_weight is reserved from the risico-100 pool. The in-breakdown risico factors
# (the ones D3/missing-redistribution actually operate on) therefore sum to this target.
# M054/S02: both splitsingsrisico (7) + parkeerdruk (7) are reserved, so the target
# moved 93 -> 86 automatically (no hand-edited table — derived from the registry).
_CASCADE_GATED_RISICO_WEIGHT: int = sum(
    e.default_weight for k, e in FACTOR_REGISTRY.items()
    if e.category == "risico" and k in CASCADE_GATED_FACTORS
)
_RISICO_REDISTRIBUTION_TARGET: int = _RISICO_MAX - _CASCADE_GATED_RISICO_WEIGHT  # == 86


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
        score_beleidsalignement,
        score_bestemming,
        score_bestemmingswijziging,
        score_bodemverontreiniging,
        score_constructieve_staat,
        score_criminaliteit,
        score_demografie,
        score_eigendoms_complexiteit,  # M050/S03
        score_funda_frictie,
        score_funderingsrisico,
        score_geluid,
        score_hypotheek_risico,  # M050/S03
        score_juridisch_klimaat,
        score_koopwaarde_trend,  # M050/S03
        score_leegstand,
        score_luchtkwaliteit,
        score_max_hoogte_bereikt,
        score_monument,
        score_natura2000,
        score_optoppotentie,
        score_overstromingsrisico,
        score_parkeerdruk,  # M054/S02
        score_perceelgrootte,
        score_splitsingsrisico,
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
        # M050/S03 — 3 new BRK risico factors (D3 sparse-redistributable)
        "hypotheek_risico": score_hypotheek_risico(parcel_data),
        "eigendoms_complexiteit": score_eigendoms_complexiteit(parcel_data),
        "koopwaarde_trend": score_koopwaarde_trend(parcel_data),
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

    # M050/S03 D3 — sparse-data runtime redistribution for 3 new BRK risico factors.
    # When any of {hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend} is
    # missing (brk_records=[] or factor-specific input None), exclude its
    # default_weight from the risico-category total (100) and rescale gewicht +
    # bijdrage of non-missing risico factors proportionally so they sum back to 100.
    # Missing BRK factors stay in breakdown with missing=True (frontend cards can
    # show 'BRK-data nodig'); their bijdrage stays 0 — only non-missing risico
    # factors receive the rescale multiplier.
    #
    # NOTE: only fires when the existing `_apply_missing_data_strategy` did NOT
    # already zero-out the BRK factor weights (which happens above the 20% missing
    # threshold). When `_apply_missing_data_strategy` ran, the non-missing risico
    # gewicht already sums to ~100 — running D3 on top would over-inflate (×1.25).
    # Detect by checking whether the missing BRK factor still has its
    # default_weight (i.e. `_apply_missing_data_strategy` did NOT touch it).
    missing_brk_keys = {
        k for k in _SPARSE_REDISTRIBUTABLE_RISICO
        if k in breakdown
        and breakdown[k].missing
        and breakdown[k].gewicht == float(FACTOR_REGISTRY[k].default_weight)
    }
    if missing_brk_keys:
        missing_weight = sum(
            FACTOR_REGISTRY[k].default_weight for k in missing_brk_keys
        )
        # Redistribution target is 93, not 100: splitsingsrisico's weight (7) is
        # verdict-gated and appended AFTER this block, so it's reserved from the pool.
        active_weight = _RISICO_REDISTRIBUTION_TARGET - missing_weight
        if active_weight > 0:
            scale = float(_RISICO_REDISTRIBUTION_TARGET) / active_weight
            for k, factor in breakdown.items():
                if (
                    factor.categorie == "risico"
                    and k not in missing_brk_keys
                    and not factor.missing
                ):
                    factor.gewicht = round(factor.gewicht * scale, 4)
                    factor.bijdrage = round(
                        factor.genormaliseerde_score * factor.gewicht, 4
                    )
                    factor.percentage_of_category = round(factor.gewicht / 100.0, 4)
            # Also zero the bijdrage of the BRK-missing factors (parity with
            # _apply_missing_data_strategy: missing factors should have bijdrage 0).
            for k in missing_brk_keys:
                factor = breakdown[k]
                factor.gewicht = 0.0
                factor.bijdrage = 0.0
                factor.percentage_of_category = 0.0

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

    # Cascade factor: beleidsalignement (Omgevingsvisie — M053/S01). Same sparse
    # treatment as woonvisie_match: appended after redistribution, weight=0 when missing.
    _ba_result = score_beleidsalignement(
        _cascade.get("beleidsalignement"),
        wijk_naam=parcel_data.get("wijk_naam"),
        project_type=project_type,
    )
    # M053: only let beleidsalignement MOVE the score where the gemeente actively steers
    # development (verdict 'kansrijk' = centraal/transformatie + hoog prioriteit). Neutraal
    # (woongebied/dorp) and strijdig (werklocatie/landschap) stay context-only — shown in
    # popup/card but weight 0 — so coarse gebied-zoning doesn't colour the whole map.
    _ba_waarde = _ba_result.waarde if isinstance(_ba_result.waarde, dict) else {}
    _ba_kansrijk = _ba_waarde.get("verdict") == "kansrijk"
    if not _ba_result.missing and _ba_kansrijk:
        _ba_entry = FACTOR_REGISTRY["beleidsalignement"]
        _ba_weight = float(
            (_ba_entry.weight_by_projecttype or {}).get(project_type, _ba_entry.default_weight)
        )
        _ba_result.gewicht = _ba_weight
        _ba_result.bijdrage = round(_ba_result.genormaliseerde_score * _ba_weight, 4)
        _ba_result.percentage_of_category = round(_ba_weight / 100.0, 4)
    breakdown["beleidsalignement"] = _ba_result

    # Cascade factor: splitsingsrisico (Huisvestingsverordening — M053/S12). Risico
    # cascade, same sparse/appended-after-redistribution treatment as beleidsalignement.
    # Its weight (7) is held in reserve from the risico-100 pool (the 16 core risico
    # factors sum to 86 since M054/S02); it is only applied when the regeling actually
    # touches this parcel (van_toepassing / mogelijk_van_toepassing /
    # vergunningstelsel_voorraad), so "geen regeling / buiten gebied / boven WOZ-grens"
    # stay context-only (weight 0) and don't colour the map.
    _sr_woz = parcel_data.get("woz")
    _sr_result = score_splitsingsrisico(
        _cascade.get("splitsingsrisico"),
        buurt_code=parcel_data.get("buurt_code"),
        woz_waarde=_sr_woz.get("meest_recente_waarde") if isinstance(_sr_woz, dict) else None,
        has_pand=parcel_data.get("has_pand"),
    )
    _sr_waarde = _sr_result.waarde if isinstance(_sr_result.waarde, dict) else {}
    _sr_actief = _sr_waarde.get("verdict") in {
        "van_toepassing", "mogelijk_van_toepassing", "vergunningstelsel_voorraad",
    }
    if not _sr_result.missing and _sr_actief:
        _sr_entry = FACTOR_REGISTRY["splitsingsrisico"]
        _sr_weight = float(
            (_sr_entry.weight_by_projecttype or {}).get(project_type, _sr_entry.default_weight)
        )
        _sr_result.gewicht = _sr_weight
        _sr_result.bijdrage = round(_sr_result.genormaliseerde_score * _sr_weight, 4)
        _sr_result.percentage_of_category = round(_sr_weight / 100.0, 4)
    breakdown["splitsingsrisico"] = _sr_result

    # Cascade factor: parkeerdruk (Nota parkeernormen — M054/S02). Risico cascade,
    # same sparse/appended-after-redistribution treatment as splitsingsrisico. Its
    # weight (7) is held in reserve from the risico-100 pool; it is only applied when
    # the parkeereis is a reëel ontwikkelrisico (verdict 'verhoogd'), so "geen nota /
    # geen match / laag" stay context-only (weight 0) and don't colour the map.
    _pk_result = score_parkeerdruk(
        _cascade.get("parkeerdruk"),
        bestemmingen=parcel_data.get("bestemmingen"),
        area_m2=parcel_data.get("area_m2"),
        projecttype=project_type,
    )
    _pk_waarde = _pk_result.waarde if isinstance(_pk_result.waarde, dict) else {}
    _pk_verhoogd = _pk_waarde.get("verdict") == "verhoogd"
    if not _pk_result.missing and _pk_verhoogd:
        _pk_entry = FACTOR_REGISTRY["parkeerdruk"]
        _pk_weight = float(
            (_pk_entry.weight_by_projecttype or {}).get(project_type, _pk_entry.default_weight)
        )
        _pk_result.gewicht = _pk_weight
        _pk_result.bijdrage = round(_pk_result.genormaliseerde_score * _pk_weight, 4)
        _pk_result.percentage_of_category = round(_pk_weight / 100.0, 4)
    breakdown["parkeerdruk"] = _pk_result

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
        # Verdict-gated cascade factors (woonvisie_match, beleidsalignement) get their
        # weight from compute_score_v3's verdict logic — a stray org custom weight must
        # NOT bypass the verdict gate. Skip them.
        if name in CASCADE_GATED_FACTORS:
            continue
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
