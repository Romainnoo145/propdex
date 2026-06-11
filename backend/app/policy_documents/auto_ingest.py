"""Auto-ingest CVDR policy documents per gemeente — M045/S06.

This module fetches known policy document types (omgevingsvisie,
huisvestingsverordening) from KOOP SRU CVDR per gemeente, downloads the PDFs,
and writes them as `policy_documents` rows via the existing superadmin-gated
store_document codepath. Same is_global=true + version_number semantics as
manual admin uploads — every read path written in S02-S05 picks them up
without modification because policy_documents is the canonical store.

Idempotency: a row with the same CVDR identifier is detected via filename
prefix (`{identifier}__{source_key}.pdf`) and skipped on re-runs. When the
CVDR identifier changes (republication), a new version is written via the
existing _next_version_number logic in policy_documents.service.
"""

from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.policy_document import PolicyDocument
from app.models.user import User
from app.policy_documents.service import store_document
from app.services.koop_sru_client import download_cvdr_pdf, search_policy_document

if TYPE_CHECKING:
    from arq.connections import ArqRedis

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Registries
# ---------------------------------------------------------------------------

AUTO_INGESTIBLE_DOCUMENTS: dict[str, str] = {
    "omgevingsvisie": "omgevingsvisie",
    "huisvestingsverordening": "huisvestingsverordening",
}
"""CVDR title search terms → source_key written to policy_documents.

Add more entries here as CVDR coverage improves (welstandsnota, woonvisie,
parkeernormen, etc). Each entry triggers one SRU lookup + PDF download per
gemeente per ingest run.
"""


KNOWN_GEMEENTES_FOR_AUTO_INGEST: list[dict[str, str]] = [
    {"gemeente_code": "GM0983", "gemeente_naam": "Venlo"},
    {"gemeente_code": "GM0363", "gemeente_naam": "Amsterdam"},
    {"gemeente_code": "GM0344", "gemeente_naam": "Utrecht"},
    {"gemeente_code": "GM0518", "gemeente_naam": "'s-Gravenhage"},
    {"gemeente_code": "GM0599", "gemeente_naam": "Rotterdam"},
]
"""Hardcoded seed list for the weekly ARQ cron in S06 T07. Extend as more
gemeentes onboard. A real code↔name mapping table is a follow-up.
"""


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


async def _already_ingested(
    *,
    entity_code: str,
    source_key: str,
    identifier: str,
    db: AsyncSession,
) -> bool:
    """Return True if any policy_documents row with this CVDR identifier exists.

    Idempotency convention: filename starts with "{identifier}__" for any
    auto-ingested row. Checks ALL versions for the (entity_type, entity_code,
    source_key) triple — not just the latest — because a manual upload may
    have created a newer version on top of an auto-ingested one.
    """
    prefix = f"{identifier}__"
    stmt = (
        select(PolicyDocument.id)
        .where(
            PolicyDocument.entity_type == "gemeente",
            PolicyDocument.entity_code == entity_code,
            PolicyDocument.source_key == source_key,
            PolicyDocument.filename.like(f"{prefix}%"),
        )
        .limit(1)
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    return row is not None


async def _get_vendor_user_id(db: AsyncSession) -> uuid.UUID:
    """Return any active user_id from the vendor organization.

    store_document requires a non-null uploaded_by_user_id (FK to users.id).
    For auto-ingested rows we use any vendor user — there is no per-document
    attribution since the upload is automated. Future work: introduce a
    dedicated SYSTEM_USER_ID setting for clearer audit trails.

    Raises RuntimeError if no active vendor user exists; the caller is
    responsible for catching this and surfacing it sensibly.
    """
    if settings.VENDOR_ORG_ID is None:
        raise RuntimeError(
            "VENDOR_ORG_ID is not configured. Auto-ingest requires a vendor "
            "organization to attribute uploads to."
        )

    stmt = (
        select(User.id)
        .where(
            User.organization_id == settings.VENDOR_ORG_ID,
            User.is_active.is_(True),
        )
        .limit(1)
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise RuntimeError(
            "No active vendor-org user found for auto-ingest. "
            "Seed at least one User row with organization_id=VENDOR_ORG_ID "
            "and is_active=true."
        )
    return row


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def ingest_gemeente_policies(
    gemeente_code: str,
    gemeente_naam: str,
    db: AsyncSession,
    arq_pool: ArqRedis | None = None,
) -> dict[str, int | None | list[str]]:
    """Auto-ingest all known CVDR-fetchable policy documents for a gemeente.

    For each entry in AUTO_INGESTIBLE_DOCUMENTS:
      1. Search KOOP SRU CVDR for that title under this gemeente_naam.
      2. Skip if no result.
      3. Skip if a policy_documents row with this exact CVDR identifier
         already exists (idempotency via filename prefix).
      4. Download the PDF bytes from CVDR.
      5. Skip if the download fails.
      6. Write a new policy_documents row via store_document (vendor-guarded,
         auto-increments version_number, sets is_global=true).

    Args:
        gemeente_code: GM-prefixed CBS code (e.g. "GM0983") — used as
            policy_documents.entity_code.
        gemeente_naam: Display name (e.g. "Venlo") — used as the SRU
            creator= search field.
        db: Async SQLAlchemy session.
        arq_pool: Optional ARQ Redis pool for enqueueing document_summary_job
            after each successful store_document call. When None (default),
            no summarization is enqueued — backwards-compatible with existing
            callers.

    Returns:
        Summary dict keyed by source_key:
        - int → version_number written (newly ingested)
        - None → not found, already ingested, or download failed

        Also contains a special key:
        - "stored_document_ids" → list[str] of UUID strings for newly stored docs
          (M047/S05: used by caller to enqueue rescore_parcels_for_document)

        The caller (endpoint or ARQ job) decides how to log/surface this.

    Notes:
        - In dev/test where settings.VENDOR_ORG_ID is None, returns a dict
          of all-None values without making any external calls. This avoids
          accidentally hitting KOOP SRU from local dev runs.
        - Errors during search/download are swallowed by the underlying
          helpers (they return None). Errors during _get_vendor_user_id or
          store_document propagate to the caller.
    """
    if settings.VENDOR_ORG_ID is None:
        logger.info(
            "VENDOR_ORG_ID not configured — skipping auto-ingest for %s",
            gemeente_naam,
        )
        result_empty: dict[str, int | list[str] | None] = dict.fromkeys(
            AUTO_INGESTIBLE_DOCUMENTS.values(), None
        )
        result_empty["stored_document_ids"] = []
        return result_empty

    summary: dict[str, int | list[str] | None] = {}
    stored_document_ids: list[str] = []
    vendor_user_id: uuid.UUID | None = None  # Lazy lookup — only if we'll write

    for cvdr_title, source_key in AUTO_INGESTIBLE_DOCUMENTS.items():
        # 1. Search CVDR for this title under this gemeente
        result = await search_policy_document(cvdr_title, gemeente_naam)
        if result is None:
            logger.info(
                "No CVDR result for %s in %s", cvdr_title, gemeente_naam
            )
            summary[source_key] = None
            continue

        # 2. Idempotency: skip if we've already ingested this exact identifier
        if await _already_ingested(
            entity_code=gemeente_code,
            source_key=source_key,
            identifier=result.identifier,
            db=db,
        ):
            logger.info(
                "Already ingested %s for %s (identifier=%s)",
                source_key,
                gemeente_naam,
                result.identifier,
            )
            summary[source_key] = None
            continue

        # 3. Download the PDF
        pdf_bytes = await download_cvdr_pdf(result.identifier)
        if pdf_bytes is None:
            logger.warning(
                "PDF download failed for %s (identifier=%s)",
                source_key,
                result.identifier,
            )
            summary[source_key] = None
            continue

        # 4. Look up a vendor user if we haven't already (lazy)
        if vendor_user_id is None:
            vendor_user_id = await _get_vendor_user_id(db)

        # 5. Write via store_document — vendor guard + version increment
        filename = f"{result.identifier}__{source_key}.pdf"
        doc = await store_document(
            entity_type="gemeente",
            entity_code=gemeente_code,
            source_key=source_key,
            filename=filename,
            content_type="application/pdf",
            file_bytes=pdf_bytes,
            user_id=vendor_user_id,
            organization_id=settings.VENDOR_ORG_ID,
            db=db,
        )
        logger.info(
            "Ingested %s for %s as version %d (identifier=%s)",
            source_key,
            gemeente_naam,
            doc.version_number,
            result.identifier,
        )

        # M045/S03: enqueue AI summary job for the auto-ingested PDF
        if arq_pool is not None and doc.content_type == "application/pdf":
            try:
                await arq_pool.enqueue_job("document_summary_job", str(doc.id))
                logger.info(
                    "Enqueued document_summary_job for auto-ingested %s (%s)",
                    source_key, doc.id,
                )
            except Exception as enqueue_err:
                logger.warning(
                    "Failed to enqueue document_summary_job for %s: %s",
                    doc.id, enqueue_err,
                )

        # M047/S05: track stored doc IDs so caller can enqueue rescore
        stored_document_ids.append(str(doc.id))
        summary[source_key] = doc.version_number

    summary["stored_document_ids"] = stored_document_ids
    return summary
