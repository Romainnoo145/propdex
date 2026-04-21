"""ARQ job: rescore_parcels_for_document — M047/S05 GAP-5.

When a PolicyDocument (woonvisie) is updated via admin upload or weekly
auto-ingest, all parcels in the document's gemeente are re-processed using
the factor_extraction_service (cache-aware: no Claude call if payload unchanged).

Primary value: cascade factor payloads are refreshed in the extraction cache,
so subsequent full re-scans pick up fresh data immediately from cache. Score
flags are updated with cascade metadata to signal freshness to downstream
consumers.

Idempotency: extract_factor uses force_refresh=False (default). Cache keyed on
(parcel_id, policy_document_id, factor_id, SCHEMA_VERSION). Unchanged document
version → same key → cache hit → no Claude call. Second run is effectively
a no-op in terms of Claude API usage.

Multi-tenant: PolicyDocument lookup filters on organization_id. Parcel data in
parcel_cache is shared (no org filter) — tenant isolation is at the document
level. Each org's document has its own extraction cache entries.
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.jobs.rescore_weights import _rescore_from_breakdown
from app.models.parcel_cache import ParcelCache
from app.models.policy_document import PolicyDocument
from app.models.scan_result import ScanResult
from app.services.cascade_enrichment_service import (
    get_affected_parcel_ids,
    get_cascade_payloads,
)

logger = logging.getLogger(__name__)

RESCORE_CONCURRENCY = 5
_EVENT_LOG_PATH = "/tmp/rescore_events.jsonl"


def _append_event_log(entry: dict[str, Any]) -> None:
    """Append a JSON line to the rescore event log."""
    try:
        with open(_EVENT_LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry) + "\n")
    except Exception as exc:
        logger.warning("Failed to append rescore event log: %s", exc)


async def _process_parcel(
    db: AsyncSession,
    parcel_id_str: str,
    doc: PolicyDocument,
    sem: asyncio.Semaphore,
) -> bool:
    """Process a single parcel for cascade rescoring.

    Fetches cascade payloads for the parcel, looks up its ScanResult, and
    updates the flags with cascade metadata if the ScanResult is score-v3.0.

    Returns True if the ScanResult was updated (flags changed), False otherwise.

    Note on scoring approach: get_cascade_payloads triggers extract_factor calls
    which refresh the extraction cache (cache-aware, no Claude call if cached).
    The score_breakdown update via _rescore_from_breakdown recomputes potentie/
    risico/overall from EXISTING genormaliseerde_score values in the breakdown
    (the woonvisie_match factor score itself is embedded in the breakdown from
    the original scan). The cascade payload refresh ensures subsequent full
    re-scans compute the factor from fresh cache. We mark flags with
    cascade_rescored_at to signal freshness to downstream consumers.
    """
    async with sem:
        cascade_payloads = await get_cascade_payloads(
            db,
            parcel_id=parcel_id_str,
            gemeente_code=doc.entity_code,
            organization_id=doc.organization_id,
        )

        if not cascade_payloads:
            return False

        # Look up ScanResult via JOIN on ParcelCache
        stmt = (
            select(ScanResult)
            .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
            .where(ParcelCache.parcel_id == parcel_id_str)
        )
        result = await db.execute(stmt)
        sr = result.scalar_one_or_none()

        if sr is None or sr.flags is None:
            return False

        flags = sr.flags
        if flags.get("score_model_version") != "score-v3.0":
            return False

        # Mark cascade payload refresh in flags
        updated_flags = dict(flags)
        updated_flags["cascade_rescored_at"] = datetime.utcnow().isoformat()
        updated_flags["woonvisie_cascade_payload"] = dict.fromkeys(cascade_payloads, True)

        # Recompute scores from existing breakdown (reflects current weights)
        scores = _rescore_from_breakdown(updated_flags, custom_weights={}, balance=0.7)
        if scores is not None:
            pot_score, ris_score, new_overall = scores
            updated_flags["scores"] = {
                "potentie_score": pot_score,
                "risico_score": ris_score,
                "overall": new_overall,
            }
            sr.score = new_overall

        sr.flags = updated_flags
        return True


async def rescore_parcels_for_document(ctx: dict[str, Any], *, document_id: str) -> dict[str, Any]:
    """ARQ job: re-score all parcels in a document's gemeente.

    Creates its own DB engine (worker pattern). Loads the PolicyDocument,
    fetches affected parcel IDs, and processes each parcel behind a semaphore
    for controlled concurrency.

    Args:
        ctx: ARQ context dict (may contain redis pool).
        document_id: UUID string of the PolicyDocument that triggered rescoring.

    Returns:
        Summary dict with status, affected count, processed count, error count,
        and duration in milliseconds.
    """
    t_start = time.monotonic()
    doc_uuid = uuid.UUID(document_id)

    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        echo=False,
    )
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    processed_count = 0
    error_count = 0

    try:
        async with session_factory() as session:
            # Load document to get organization_id for tenant scoping
            doc_stmt = select(PolicyDocument).where(PolicyDocument.id == doc_uuid)
            doc_result = await session.execute(doc_stmt)
            doc = doc_result.scalar_one_or_none()

            if doc is None:
                logger.warning("rescore_parcels_for_document: document not found id=%s", document_id)
                return {"status": "skipped", "reason": "not_found", "document_id": document_id}

            # Get all parcel IDs in the document's gemeente
            parcel_ids = await get_affected_parcel_ids(
                session,
                document_id=doc_uuid,
                organization_id=doc.organization_id,
            )

            if not parcel_ids:
                logger.info(
                    "rescore_parcels_for_document: no parcels for document %s (gemeente=%s)",
                    document_id, doc.entity_code,
                )
                return {"status": "skipped", "reason": "no_parcels", "document_id": document_id}

            logger.info(
                "rescore_parcels_for_document: processing %d parcels for document %s (gemeente=%s)",
                len(parcel_ids), document_id, doc.entity_code,
            )

            sem = asyncio.Semaphore(RESCORE_CONCURRENCY)
            flush_counter = 0

            for parcel_id_str in parcel_ids:
                try:
                    updated = await _process_parcel(session, parcel_id_str, doc, sem)
                    if updated:
                        processed_count += 1
                        flush_counter += 1

                    # Flush in batches of 50 to avoid large in-memory accumulation
                    if flush_counter >= 50:
                        await session.flush()
                        flush_counter = 0

                except Exception as exc:
                    logger.warning(
                        "rescore_parcels_for_document: parcel %s failed: %s",
                        parcel_id_str, exc,
                    )
                    error_count += 1

            await session.commit()

    finally:
        await engine.dispose()

    duration_ms = int((time.monotonic() - t_start) * 1000)

    event_entry = {
        "doc_id": document_id,
        "affected_parcel_count": len(parcel_ids) if "parcel_ids" in dir() else 0,
        "duration_ms": duration_ms,
        "error_count": error_count,
        "timestamp": datetime.utcnow().isoformat(),
    }
    _append_event_log(event_entry)

    logger.info(
        "rescore_parcels_for_document complete: doc=%s affected=%d processed=%d errors=%d duration=%dms",
        document_id,
        event_entry["affected_parcel_count"],
        processed_count,
        error_count,
        duration_ms,
    )

    return {
        "status": "complete",
        "document_id": document_id,
        "affected": event_entry["affected_parcel_count"],
        "processed": processed_count,
        "errors": error_count,
        "duration_ms": duration_ms,
    }
