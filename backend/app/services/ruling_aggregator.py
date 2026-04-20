"""Aggregate jurisprudence rulings filtered by developer-relevant vergunningstypen.

M046/S01 RM-1 fix. Claude classifies each ruling into one of 9 categories via
app.ai.prompts (nieuwbouw | verbouw | dakopbouw | uitbreiding | sloop |
bestemmingswijziging | milieu | monumenten | overig). For developer-facing
scoring (vergunning_succeskans, juridisch_klimaat) only 4 categories are relevant:
nieuwbouw, sloop, bestemmingswijziging, uitbreiding. This module is the SINGLE
source of truth for that filter — all aggregation sites (router trigger, router
poll, claude_client analyze) must call aggregate_dev_type_rulings() to stay
consistent.

Semantics:
- NULL vergunningstype = niet-geclassificeerd, filtered out (niet als 'overig').
- < MIN_DEV_RULINGS_FOR_AGGREGATION dev-rulings → missing=True, scores None.
- On missing=True the factor functions return neutral 0.5 with explicit
  "beperkte data" toelichting (see score_v3_factors.score_vergunning_succeskans).
"""

from dataclasses import dataclass
from typing import Any

DEV_VERGUNNINGSTYPEN: frozenset[str] = frozenset(
    {"nieuwbouw", "sloop", "bestemmingswijziging", "uitbreiding"}
)
"""Developer-relevante vergunningstypen. De 4 types die een ontwikkelaar
daadwerkelijk aanvraagt. Bewust afwezig: verbouw (ambiguous — kan burger
of dev zijn), dakopbouw (burger), milieu (burger-klacht), monumenten
(beperkings-check niet dev-aanvraag), overig (te vaag), NULL (niet
geclassificeerd)."""

MIN_DEV_RULINGS_FOR_AGGREGATION: int = 5
"""Minimaal aantal dev-type rulings voordat aggregatie statistisch zinvol is.
Onder 5 rulings is sample size te klein voor betrouwbare percentage-uitkomst
(20%-stappen = minimale afrondings-resolutie)."""


@dataclass(frozen=True)
class DevTypeAggregation:
    """Result of aggregate_dev_type_rulings — immutable by design.

    succeskans/klimaat_score are None when missing=True; callers must check
    `missing` before trusting the scores.
    """

    succeskans: int | None
    klimaat_score: int | None
    ruling_count_dev_types: int
    ruling_count_total: int
    toegewezen_count: int
    afgewezen_count: int
    missing: bool
    reason: str | None


def aggregate_dev_type_rulings(
    ruling_analyses: list[dict[str, Any]],
) -> DevTypeAggregation:
    """Aggregate ruling outcomes filtered by developer-relevante vergunningstypen.

    Args:
        ruling_analyses: List of dicts (typically r.ai_analysis JSONB from
            RulingCache). Each dict should have 'uitkomst' and 'vergunningstype'
            keys. NULL/missing vergunningstype values are filtered out.

    Returns:
        DevTypeAggregation. When len(dev-filtered) < MIN_DEV_RULINGS_FOR_AGGREGATION
        the result has missing=True and succeskans/klimaat_score=None.

    Example:
        >>> rulings = [
        ...     {"uitkomst": "toegewezen", "vergunningstype": "nieuwbouw"},
        ...     {"uitkomst": "afgewezen", "vergunningstype": "dakopbouw"},
        ... ]
        >>> result = aggregate_dev_type_rulings(rulings)
        >>> result.missing  # 1 dev-ruling < 5 threshold
        True
    """
    total = len(ruling_analyses)

    dev_rulings = [
        r for r in ruling_analyses if r.get("vergunningstype") in DEV_VERGUNNINGSTYPEN
    ]
    dev_count = len(dev_rulings)

    if dev_count < MIN_DEV_RULINGS_FOR_AGGREGATION:
        return DevTypeAggregation(
            succeskans=None,
            klimaat_score=None,
            ruling_count_dev_types=dev_count,
            ruling_count_total=total,
            toegewezen_count=0,
            afgewezen_count=0,
            missing=True,
            reason="insufficient_dev_type_rulings",
        )

    toegewezen = sum(1 for r in dev_rulings if r.get("uitkomst") == "toegewezen")
    afgewezen = sum(1 for r in dev_rulings if r.get("uitkomst") == "afgewezen")

    succeskans = round(100 * toegewezen / dev_count)
    klimaat_score = 100 - round(100 * afgewezen / dev_count)

    return DevTypeAggregation(
        succeskans=succeskans,
        klimaat_score=klimaat_score,
        ruling_count_dev_types=dev_count,
        ruling_count_total=total,
        toegewezen_count=toegewezen,
        afgewezen_count=afgewezen,
        missing=False,
        reason=None,
    )
