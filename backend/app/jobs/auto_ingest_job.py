"""Weekly ARQ cron — auto-ingest CVDR policy documents for known gemeentes.

M045/S06 T07: iterates KNOWN_GEMEENTES_FOR_AUTO_INGEST and runs
ingest_gemeente_policies for each. Logs per-gemeente summary, never
raises (per-gemeente errors are caught and logged). Returns aggregate
stats for ARQ result inspection.
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.database import async_session_factory
from app.policy_documents.auto_ingest import (
    KNOWN_GEMEENTES_FOR_AUTO_INGEST,
    ingest_gemeente_policies,
)

logger = logging.getLogger(__name__)


async def weekly_policy_auto_ingest_job(ctx: dict[str, Any]) -> dict[str, Any]:
    """Iterate KNOWN_GEMEENTES_FOR_AUTO_INGEST and run auto-ingest for each.

    Each gemeente runs in its own try/except so a single failure doesn't
    abort the whole batch. Per-gemeente results are aggregated into the
    returned dict for ARQ result inspection.

    Args:
        ctx: ARQ context dict (unused — required by ARQ function signature).

    Returns:
        dict with keys:
            - gemeentes_processed (int): how many entries were attempted
            - results (dict[str, dict[str, int | None]]): per-gemeente_code summary
    """
    results: dict[str, dict[str, int | None]] = {}

    async with async_session_factory() as db:
        for entry in KNOWN_GEMEENTES_FOR_AUTO_INGEST:
            gemeente_code = entry["gemeente_code"]
            gemeente_naam = entry["gemeente_naam"]
            try:
                summary = await ingest_gemeente_policies(
                    gemeente_code=gemeente_code,
                    gemeente_naam=gemeente_naam,
                    db=db,
                )
                results[gemeente_code] = summary
                logger.info(
                    "Auto-ingest for %s (%s): %s",
                    gemeente_naam, gemeente_code, summary,
                )
            except Exception:
                logger.exception(
                    "Auto-ingest failed for %s (%s)",
                    gemeente_naam, gemeente_code,
                )
                results[gemeente_code] = {}

    return {
        "gemeentes_processed": len(KNOWN_GEMEENTES_FOR_AUTO_INGEST),
        "results": results,
    }
