"""Use-case specific scoring — optoppen, splitsen, transformatie, nieuwbouw.

Computes 4 use-case scores from an existing score_v3 breakdown by
re-weighting the stored genormaliseerde_score values. No new factor
computation needed — just different weight profiles applied to the
same underlying data.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class UseCaseScore:
    """Score for a specific development use case."""

    use_case: str
    label: str  # Dutch display name
    score: float  # 0-100
    category: str  # Hoog / Gemiddeld / Laag
    top_factors: list[str]  # top 3 contributing factor names
    description: str  # one-line Dutch explanation


# ── Use-case weight presets ──────────────────────────────────────
# Each preset emphasizes factors relevant to that development strategy.
# Weights are relative — they get normalized against max per category.

USE_CASE_PRESETS: dict[str, dict[str, Any]] = {
    "optoppen": {
        "label": "Optoppen",
        "description": "Extra verdieping(en) op bestaand pand",
        "potentie_weights": {
            "vrije_grond": 2,
            "optoppotentie": 25,  # dominant factor
            "bestemming": 10,
            "leegstand": 3,
            "funda_frictie": 2,
            "perceelgrootte": 5,
            "demografie": 8,
            "vergunning_succeskans": 15,
        },
        "risico_weights": {
            "funderingsrisico": 20,  # critical for optoppen
            "asbest": 5,
            "bodemverontreiniging": 3,
            "monument": 10,  # monuments hard to optoppen
            "bestemmingswijziging": 8,
            "constructieve_staat": 15,  # structure must support extra floors
            "juridisch_klimaat": 8,
            "criminaliteit": 3,
            "max_hoogte_bereikt": 20,  # dominant risk — already at max height?
            "natura2000": 2,
            "overstromingsrisico": 3,
            "geluid": 3,
            "luchtkwaliteit": 2,
        },
        "potentie_risico_balance": 0.6,
    },
    "splitsen": {
        "label": "Splitsen",
        "description": "Woning splitsen in meerdere eenheden",
        "potentie_weights": {
            "vrije_grond": 3,
            "optoppotentie": 3,
            "bestemming": 12,
            "leegstand": 5,
            "funda_frictie": 8,  # market demand matters
            "perceelgrootte": 20,  # need sufficient m²
            "demografie": 12,  # urban demand
            "vergunning_succeskans": 18,  # huisvestingsverordening!
        },
        "risico_weights": {
            "funderingsrisico": 10,
            "asbest": 8,
            "bodemverontreiniging": 4,
            "monument": 12,  # monuments hard to split
            "bestemmingswijziging": 12,  # may need bestemmingswijziging
            "constructieve_staat": 10,
            "juridisch_klimaat": 10,
            "criminaliteit": 5,
            "max_hoogte_bereikt": 2,
            "natura2000": 3,
            "overstromingsrisico": 4,
            "geluid": 5,
            "luchtkwaliteit": 3,
        },
        "potentie_risico_balance": 0.65,
    },
    "transformatie": {
        "label": "Transformatie",
        "description": "Herbestemming van niet-wonen naar wonen",
        "potentie_weights": {
            "vrije_grond": 5,
            "optoppotentie": 8,
            "bestemming": 20,  # current non-residential bestemming = opportunity
            "leegstand": 15,  # vacancy signals opportunity
            "funda_frictie": 5,
            "perceelgrootte": 12,
            "demografie": 8,
            "vergunning_succeskans": 15,
        },
        "risico_weights": {
            "funderingsrisico": 12,
            "asbest": 8,  # old commercial = asbestos risk
            "bodemverontreiniging": 10,  # industrial history
            "monument": 8,
            "bestemmingswijziging": 15,  # MUST change bestemming
            "constructieve_staat": 10,
            "juridisch_klimaat": 8,
            "criminaliteit": 5,
            "max_hoogte_bereikt": 3,
            "natura2000": 4,
            "overstromingsrisico": 5,
            "geluid": 6,  # noise matters for residential
            "luchtkwaliteit": 5,
        },
        "potentie_risico_balance": 0.6,
    },
    "nieuwbouw": {
        "label": "Nieuwbouw",
        "description": "Sloop en nieuwbouw op de locatie",
        "potentie_weights": {
            "vrije_grond": 22,  # dominant — need space
            "optoppotentie": 2,
            "bestemming": 15,
            "leegstand": 8,
            "funda_frictie": 5,
            "perceelgrootte": 20,  # dominant — need large parcel
            "demografie": 8,
            "vergunning_succeskans": 12,
        },
        "risico_weights": {
            "funderingsrisico": 8,  # new foundation anyway
            "asbest": 6,  # sloop risk
            "bodemverontreiniging": 12,  # must remediate
            "monument": 15,  # can't demolish monument
            "bestemmingswijziging": 10,
            "constructieve_staat": 3,  # doesn't matter — demolishing
            "juridisch_klimaat": 8,
            "criminaliteit": 4,
            "max_hoogte_bereikt": 5,
            "natura2000": 8,
            "overstromingsrisico": 7,
            "geluid": 6,
            "luchtkwaliteit": 5,
        },
        "potentie_risico_balance": 0.65,
    },
}


def _categorize(score: float) -> str:
    """Map 0-100 score to Dutch category."""
    if score >= 70:
        return "Hoog"
    if score >= 40:
        return "Gemiddeld"
    return "Laag"


def compute_use_case_scores(
    score_breakdown: dict[str, dict[str, Any]],
) -> dict[str, UseCaseScore]:
    """Compute 4 use-case scores from an existing score_v3 breakdown.

    Reads genormaliseerde_score from each factor in the breakdown,
    applies use-case-specific weights, and computes potentie/risico/overall
    per use case.

    Args:
        score_breakdown: Dict of factor_name → {genormaliseerde_score, categorie, ...}
            as stored in scan_results.flags["score_breakdown"]

    Returns:
        Dict of use_case_id → UseCaseScore
    """
    if not score_breakdown:
        return {}

    results: dict[str, UseCaseScore] = {}

    for uc_id, preset in USE_CASE_PRESETS.items():
        pot_weights: dict[str, int] = preset["potentie_weights"]
        risk_weights: dict[str, int] = preset["risico_weights"]
        balance: float = preset["potentie_risico_balance"]

        pot_max = sum(pot_weights.values())
        risk_max = sum(risk_weights.values())

        pot_sum = 0.0
        risk_sum = 0.0
        contributions: list[tuple[str, float]] = []

        for factor_name, factor_data in score_breakdown.items():
            if not isinstance(factor_data, dict):
                continue
            norm_score = factor_data.get("genormaliseerde_score", 0.0)
            cat = factor_data.get("categorie", "potentie")

            if cat == "potentie":
                weight = pot_weights.get(factor_name, 0)
                contribution = norm_score * weight
                pot_sum += contribution
                contributions.append((factor_name, contribution))
            else:
                weight = risk_weights.get(factor_name, 0)
                contribution = norm_score * weight
                risk_sum += contribution
                contributions.append((factor_name, -contribution))  # negative = risk

        # Normalize to 0-100
        potentie = (pot_sum / pot_max * 100) if pot_max > 0 else 0
        risico = (risk_sum / risk_max * 100) if risk_max > 0 else 0

        # Apply balance
        discount = min(0.5, risico / 100 * (1 - balance))
        overall = potentie * (1 - discount)
        overall = max(0, min(100, overall))

        # Top 3 contributing factors (by absolute contribution)
        contributions.sort(key=lambda x: abs(x[1]), reverse=True)
        top_factors = [name for name, _ in contributions[:3]]

        results[uc_id] = UseCaseScore(
            use_case=uc_id,
            label=preset["label"],
            score=round(overall, 1),
            category=_categorize(overall),
            top_factors=top_factors,
            description=preset["description"],
        )

    return results
