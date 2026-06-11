"""Shared cascade-scoring service (M053/S10).

Single source of truth for loading woonvisie_match / beleidsalignement
cascade factor payloads from the extraction cache. Used by the scan
(area_scan Phase 6), the document rescore job, and the manual backfill
tool — so the three can never drift.

Cost: the AI extraction is document-level (cached once per gemeente doc);
the per-parcel work is pure compute_score_v3 — no Claude call per parcel.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import asdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import SCHEMA_VERSION
from app.ai.factors.beleidsalignement import OmgevingsvisiePayload
from app.ai.factors.woonvisie_match import WoonvisiePayload
from app.models.factor_extraction_cache import FactorExtractionCache
from app.services.cascade_enrichment_service import (
    get_omgevingsvisie_document,
    get_woonvisie_document,
)
from app.services.score_v3 import compute_score_v3

logger = logging.getLogger(__name__)

_CASCADE_SOURCES: tuple[tuple[str, Any, type[Any]], ...] = (
    ("woonvisie_match", get_woonvisie_document, WoonvisiePayload),
    ("beleidsalignement", get_omgevingsvisie_document, OmgevingsvisiePayload),
)


async def load_gemeente_cascade_payloads(
    session: AsyncSession,
    *,
    gemeente_code: str | None,
    organization_id: uuid.UUID | None,
) -> dict[str, Any]:
    """Load woonvisie + omgevingsvisie payloads for a gemeente from the
    extraction cache. Returns {factor_id: payload_model_instance}; absent
    factors are omitted. Reads from cache only — no Claude call.

    Args:
        session: active async SQLAlchemy session (read-only use).
        gemeente_code: entity_code stored in policy_documents (e.g. "GM0983").
            Pass None to get an empty result immediately.
        organization_id: UUID of the requesting organisation; used by
            get_woonvisie_document / get_omgevingsvisie_document to resolve
            org-scoped or global policy documents.

    Returns:
        Dict keyed by factor_id with validated Pydantic payload objects.
    """
    payloads: dict[str, Any] = {}
    if not gemeente_code or organization_id is None:
        return payloads

    for factor_id, get_doc, model_cls in _CASCADE_SOURCES:
        try:
            doc = await get_doc(
                session,
                gemeente_code=gemeente_code,
                organization_id=organization_id,
            )
            if doc is None:
                logger.info(
                    "cascade_scoring: no %s document for gemeente=%s org=%s",
                    factor_id,
                    gemeente_code,
                    organization_id,
                )
                continue

            cached = (
                await session.execute(
                    select(FactorExtractionCache)
                    .where(
                        FactorExtractionCache.policy_document_id == doc.id,
                        FactorExtractionCache.factor_id == factor_id,
                        FactorExtractionCache.schema_version == SCHEMA_VERSION,
                    )
                    .limit(1)
                )
            ).scalar_one_or_none()

            if cached is None:
                logger.info(
                    "cascade_scoring: no cached %s at schema=%s for doc=%s"
                    " — run rescore_cascade_job first to refresh the cache",
                    factor_id,
                    SCHEMA_VERSION,
                    doc.id,
                )
                continue

            payloads[factor_id] = model_cls.model_validate(cached.extracted_payload)
            logger.info(
                "cascade_scoring: loaded %s from cache doc=%s extracted_at=%s",
                factor_id,
                doc.id,
                cached.extracted_at,
            )
        except Exception:
            logger.exception(
                "cascade_scoring: failed loading %s for gemeente=%s org=%s",
                factor_id,
                gemeente_code,
                organization_id,
            )

    return payloads


# ---------------------------------------------------------------------------
# Task 2 — per-parcel builders (M053/S10)
# ---------------------------------------------------------------------------

# Flag-overlay keys mirrored from backfill_cascade_scores.py (canonical list).
# Order must match the backfill dict exactly to guarantee parity in Task 7.
_FLAG_OVERLAY_KEYS: tuple[str, ...] = (
    "vacancy_signal",
    "market_signals",
    "bodem",
    "bodemtype",
    "funderingsrisico",
    "energielabel",
    "vergunningen",
    "natura2000",
    "overstromingsrisico",
    "geluid",
    "luchtkwaliteit",
    "woz",
    "rijksmonument",
)


def build_parcel_data(
    parcel_cache: Any,
    flags: dict[str, Any],
    *,
    perimeter_m: float | None,
    wijk_naam: str | None,
) -> dict[str, Any]:
    """Build the compute_score_v3 input dict from a ParcelCache row + existing flags.

    Canonical builder matching area_scan Phase 6 and backfill_cascade_scores.py.
    All three callers must use this function so they can never drift.
    """
    pd: dict[str, Any] = {
        "parcel_id": str(parcel_cache.parcel_id),
        "area_m2": parcel_cache.area_m2,
        "perimeter_m": float(perimeter_m) if perimeter_m is not None else None,
        "has_pand": parcel_cache.has_pand,
        "bouwjaar": parcel_cache.bouwjaar,
        "pand_status": parcel_cache.pand_status,
        "bestemmingen": parcel_cache.bestemmingen,
        "wijk_naam": wijk_naam,
        "building_metrics": flags.get("building_metrics", {}),
    }
    for key in _FLAG_OVERLAY_KEYS:
        pd[key] = flags.get(key)
    return pd


def apply_cascade_score(
    scan_result: Any,
    *,
    parcel_data: dict[str, Any],
    nbhd_metrics: dict[str, Any] | None,
    cascade_payloads: dict[str, Any],
    custom_weights: dict[str, Any] | None = None,
    project_type: str = "onbepaald",
) -> bool:
    """Compute v3.0 (with cascade payloads) and write breakdown + scores onto
    scan_result.flags / scan_result.score.

    Write-back block mirrors backfill_cascade_scores.py exactly:
    - flags["scores"]          → {potentie, risico, overall}
    - flags["score_breakdown"] → {name: asdict(FactorResult), ...}
    - flags["score_model_version"] → "score-v3.0"
    - flags["category"]        → result.category
    - flags["factors"] / flags["subscores"] removed (legacy keys)

    Returns:
        True — always applied (caller can ignore or use for dirty-tracking).
    """
    result = compute_score_v3(
        parcel_data,
        nbhd_metrics,
        custom_weights=custom_weights,
        project_type=project_type,
        cascade_payloads=cascade_payloads,
    )

    flags = dict(scan_result.flags) if scan_result.flags else {}

    flags["scores"] = {
        "potentie": result.potentie_score,
        "risico": result.risico_score,
        "overall": result.overall,
    }
    flags["score_breakdown"] = {
        name: asdict(factor) for name, factor in result.score_breakdown.items()
    }
    flags["score_model_version"] = "score-v3.0"
    flags["category"] = result.category
    # Remove legacy keys that predate v3.0 write-back format
    flags.pop("factors", None)
    flags.pop("subscores", None)

    scan_result.flags = flags
    scan_result.score = max(0.0, min(100.0, result.overall))
    return True
