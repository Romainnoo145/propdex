"""Build neighborhood_metrics['juridisch_klimaat'] payload for score_v3 consumption.

Wraps ruling_aggregator.aggregate_dev_type_rulings() into the payload shape
expected by score_vergunning_succeskans and score_juridisch_klimaat.

Intended usage: called from scan pipeline (area_scan.py or future gemeente-level
enrichment) to populate scan.neighborhood_metrics['juridisch_klimaat'] before
score_v3 computation. Not yet wired in S01 — M046/S02+ or M047 integration.

Multi-tenant: RulingCache is org-agnostic (public jurisprudence data — see
RulingCache model docstring). No organization_id filter required.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ruling_cache import RulingCache
from app.services.ruling_aggregator import aggregate_dev_type_rulings


async def build_juridisch_klimaat_payload(
    db: AsyncSession, gemeente_naam: str
) -> dict[str, Any] | None:
    """Fetch analyzed rulings for a gemeente, aggregate with dev-type filter.

    Returns None when no rulings exist for the gemeente — caller should omit
    the 'juridisch_klimaat' key from neighborhood_metrics in that case, which
    triggers the factor's primary missing path (empty-jk branch).

    Returns dict with keys consumed by score_v3_factors:
        approval_rate: float (0.0-1.0) — dev-filtered succeskans as fraction,
            0.5 neutral when missing=True.
        ruling_count: int — total rulings in RulingCache for this gemeente.
        ruling_count_dev_types: int — rulings matching developer filter.
        missing: bool — True when below MIN_DEV_RULINGS_FOR_AGGREGATION.
        reason: str | None — "insufficient_dev_type_rulings" when missing.
    """
    stmt = (
        select(RulingCache)
        .where(
            (RulingCache.gemeente_query == gemeente_naam)
            | (RulingCache.extracted_gemeente == gemeente_naam)
        )
        .where(RulingCache.ai_analysis.isnot(None))
    )
    result = await db.execute(stmt)
    rulings = result.scalars().all()

    if not rulings:
        return None

    ruling_analyses = [r.ai_analysis for r in rulings if r.ai_analysis]
    agg = aggregate_dev_type_rulings(ruling_analyses)

    return {
        "approval_rate": (agg.succeskans / 100.0) if agg.succeskans is not None else 0.5,
        "ruling_count": agg.ruling_count_total,
        "ruling_count_dev_types": agg.ruling_count_dev_types,
        "missing": agg.missing,
        "reason": agg.reason,
    }
