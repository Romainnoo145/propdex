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
