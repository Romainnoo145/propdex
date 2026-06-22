"""Compute a document's extraction status from the cascade extraction cache.

The cascade extraction (extract_factor) reads a policy PDF once and caches the
typed payload in factor_extraction_cache, keyed by
(DOCUMENT_SENTINEL, policy_document_id, factor_id, SCHEMA_VERSION). This module
turns that into a per-document {status, extraction} for the API — no AI calls.
"""

import uuid
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.models.factor_extraction_cache import FactorExtractionCache

# source_key -> factor_id. Only these source_keys are cascade-extracted; any
# other source_key has no extraction and reports status "nvt".
CASCADE_SOURCE_FACTORS: dict[str, str] = {
    "woonvisie": "woonvisie_match",
    "omgevingsvisie": "beleidsalignement",
    "huisvestingsverordening": "splitsingsrisico",
    "parkeerbeleid": "parkeerdruk",
}


class ExtractionInfo(TypedDict):
    status: str  # "parsed" | "pending" | "nvt"
    extraction: dict[str, object] | None


async def get_extraction_map(
    db: AsyncSession,
    docs: list[tuple[uuid.UUID, str]],
) -> dict[uuid.UUID, ExtractionInfo]:
    """Return {doc_id: {status, extraction}} for the given (doc_id, source_key) pairs."""
    cascade_ids = [doc_id for doc_id, sk in docs if sk in CASCADE_SOURCE_FACTORS]

    cache: dict[uuid.UUID, dict[str, object]] = {}
    if cascade_ids:
        rows = (
            await db.execute(
                select(
                    FactorExtractionCache.policy_document_id,
                    FactorExtractionCache.extracted_payload,
                ).where(
                    FactorExtractionCache.parcel_id == DOCUMENT_SENTINEL,
                    FactorExtractionCache.schema_version == SCHEMA_VERSION,
                    FactorExtractionCache.policy_document_id.in_(cascade_ids),
                )
            )
        ).all()
        for doc_id, payload in rows:
            if payload is not None:
                cache[doc_id] = payload

    out: dict[uuid.UUID, ExtractionInfo] = {}
    for doc_id, source_key in docs:
        if source_key not in CASCADE_SOURCE_FACTORS:
            out[doc_id] = {"status": "nvt", "extraction": None}
        elif doc_id in cache:
            out[doc_id] = {"status": "parsed", "extraction": cache[doc_id]}
        else:
            out[doc_id] = {"status": "pending", "extraction": None}
    return out
