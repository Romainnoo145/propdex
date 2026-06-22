"""Post-upload ARQ job enqueuing for policy documents.

Extracted from router.py to keep that file under 300 lines (CLAUDE.md rule).
"""
import logging
import uuid
from typing import Any

from app.jobs.rescore_cascade_job import CASCADE_RESCORE_SOURCE_KEYS

logger = logging.getLogger(__name__)


async def enqueue_post_upload_jobs(
    arq_pool: Any | None,
    *,
    document_id: uuid.UUID,
    source_key: str,
    content_type: str,
) -> None:
    """Enqueue (conditional) rescore job after a successful upload.

    - rescore_parcels_for_document: gated by source_key in CASCADE_RESCORE_SOURCE_KEYS.
    Enqueue is best-effort: failures are logged as warnings, never raised.
    """
    if content_type != "application/pdf":
        return

    if arq_pool is None:
        logger.warning(
            "ARQ pool not available — skipping post-upload jobs for document %s", document_id
        )
        return

    if source_key in CASCADE_RESCORE_SOURCE_KEYS:
        try:
            await arq_pool.enqueue_job(
                "rescore_parcels_for_document", document_id=str(document_id)
            )
            logger.info(
                "Enqueued rescore_parcels_for_document for document %s (source_key=%s)",
                document_id,
                source_key,
            )
        except Exception as enqueue_err:
            logger.warning(
                "Failed to enqueue rescore_parcels_for_document for %s: %s",
                document_id,
                enqueue_err,
            )
