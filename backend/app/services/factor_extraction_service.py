"""Cache-aware wrapper around factor_extractor.extract_factor_live (M047/S04).

extract_factor() = check cache → if hit return; else call Claude → validate
→ write cache → return. Idempotent: second call with same (parcel_id,
policy_document_id, factor_id, SCHEMA_VERSION) returns cache-hit without
Claude-call.

Separation-of-concerns: factor_extractor.py knows nothing of DB or caching.
This service layer wraps it. S05 cascade ARQ job uses THIS function, not
extract_factor_live directly — cache is non-negotiable for batch work.
"""

import logging
import uuid
from datetime import datetime
from typing import TypeVar

from anthropic import AsyncAnthropic
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import (
    SCHEMA_VERSION,
    ExtractedFactor,
    FactorDefinition,
)
from app.ai.factor_extractor import extract_factor_live
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.policy_document import PolicyDocument

logger = logging.getLogger(__name__)

PayloadT = TypeVar("PayloadT", bound=BaseModel)


async def _get_cache_hit(
    db: AsyncSession,
    *,
    parcel_id: str,
    policy_document_id: uuid.UUID,
    factor_id: str,
) -> FactorExtractionCache | None:
    """Lookup cache by (parcel, doc, factor, current SCHEMA_VERSION)."""
    stmt = select(FactorExtractionCache).where(
        FactorExtractionCache.parcel_id == parcel_id,
        FactorExtractionCache.policy_document_id == policy_document_id,
        FactorExtractionCache.factor_id == factor_id,
        FactorExtractionCache.schema_version == SCHEMA_VERSION,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _write_cache(
    db: AsyncSession,
    *,
    parcel_id: str,
    policy_document_id: uuid.UUID,
    factor_id: str,
    extracted_payload: dict,
    extracted_at: datetime,
) -> None:
    """Atomic upsert via pg_insert.on_conflict_do_update.

    On conflict: bump cached_at + overwrite payload (for manual re-extraction
    of the same slot). Normal flow hits cache first so this path is rare.
    """
    insert_stmt = pg_insert(FactorExtractionCache).values(
        parcel_id=parcel_id,
        policy_document_id=policy_document_id,
        factor_id=factor_id,
        schema_version=SCHEMA_VERSION,
        extracted_payload=extracted_payload,
        extracted_at=extracted_at,
        cached_at=datetime.utcnow(),
    )
    upsert_stmt = insert_stmt.on_conflict_do_update(
        constraint="uq_factor_extraction_cache_key",
        set_={
            "extracted_payload": insert_stmt.excluded.extracted_payload,
            "extracted_at": insert_stmt.excluded.extracted_at,
            "cached_at": insert_stmt.excluded.cached_at,
        },
    )
    await db.execute(upsert_stmt)
    await db.commit()


async def extract_factor(
    db: AsyncSession,
    *,
    factor_def: FactorDefinition[PayloadT],
    parcel_id: str,
    policy_document: PolicyDocument,
    claude_client: AsyncAnthropic | None = None,
    force_refresh: bool = False,
) -> ExtractedFactor[PayloadT]:
    """Cache-aware extraction.

    force_refresh=True bypasses cache-read (still writes cache after call).
    Used in S05 when admin manually triggers re-extraction.
    """
    if not force_refresh:
        cached = await _get_cache_hit(
            db,
            parcel_id=parcel_id,
            policy_document_id=policy_document.id,
            factor_id=factor_def.factor_id,
        )
        if cached is not None:
            try:
                payload = factor_def.payload_model.model_validate(cached.extracted_payload)
                logger.debug(
                    "factor_extract cache hit: parcel=%s doc=%s factor=%s",
                    parcel_id,
                    policy_document.id,
                    factor_def.factor_id,
                )
                return ExtractedFactor[PayloadT](
                    factor_id=factor_def.factor_id,
                    parcel_id=parcel_id,
                    policy_document_id=str(policy_document.id),
                    payload=payload,
                    extracted_at=cached.extracted_at,
                    from_cache=True,
                    schema_version=cached.schema_version,
                )
            except Exception:
                logger.warning(
                    "factor_extract cache-payload revalidation failed "
                    "(treating as miss): parcel=%s doc=%s factor=%s",
                    parcel_id,
                    policy_document.id,
                    factor_def.factor_id,
                )

    result = await extract_factor_live(
        factor_def=factor_def,
        parcel_id=parcel_id,
        policy_document=policy_document,
        claude_client=claude_client,
    )

    try:
        await _write_cache(
            db,
            parcel_id=parcel_id,
            policy_document_id=policy_document.id,
            factor_id=factor_def.factor_id,
            extracted_payload=result.payload.model_dump(mode="json"),
            extracted_at=result.extracted_at,
        )
    except Exception:
        logger.exception(
            "factor_extract cache-write failed (non-fatal): parcel=%s doc=%s factor=%s",
            parcel_id,
            policy_document.id,
            factor_def.factor_id,
        )

    return result
