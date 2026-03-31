"""Checklist document auto-generation orchestrator.

After a property report is created, this module generates all applicable
checklist PDFs and persists them as ParcelDocument rows. Each document type
is generated independently — a failure in one does not block others.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.reports.checklist_pdf import (
    CHECKLIST_DOC_CONFIGS,
    generate_checklist_pdf,
    get_available_docs,
)

logger = logging.getLogger(__name__)


@dataclass
class ChecklistGenerationResult:
    """Summary of a checklist document generation run."""

    generated: list[str] = field(default_factory=list)
    failed: list[dict[str, str]] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    total_bytes: int = 0


async def _insert_parcel_document(
    db: AsyncSession,
    parcel_id: str,
    document_type: str,
    filename: str,
    file_data: bytes,
    user_id: uuid.UUID,
) -> uuid.UUID:
    """Insert a ParcelDocument row via raw SQL (same pattern as documents router)."""
    result = await db.execute(
        text(
            """
            INSERT INTO parcel_documents (
                parcel_id, document_type, filename, content_type,
                file_data, file_size, uploaded_by_user_id
            ) VALUES (
                :parcel_id, :document_type, :filename, :content_type,
                :file_data, :file_size, :uploaded_by_user_id
            )
            RETURNING id
            """
        ),
        {
            "parcel_id": parcel_id,
            "document_type": document_type,
            "filename": filename,
            "content_type": "application/pdf",
            "file_data": file_data,
            "file_size": len(file_data),
            "uploaded_by_user_id": str(user_id),
        },
    )
    return result.scalar_one()


async def generate_checklist_documents(
    report_data: dict[str, Any],
    report_name: str,
    parcel_id: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> ChecklistGenerationResult:
    """Generate and persist all applicable checklist PDFs for a report.

    Determines which document types have sufficient data, generates each PDF
    via ``asyncio.to_thread`` (WeasyPrint is CPU-bound), and inserts each as
    a ``ParcelDocument`` row.

    Each document type is independent — a failure in one does not block others.

    Args:
        report_data: PropertyReportResponse as a dict.
        report_name: Human-readable address/report name for the PDF header.
        parcel_id: Kadaster parcel identifier.
        user_id: ID of the user who owns these documents.
        db: Async database session.

    Returns:
        ChecklistGenerationResult with generated/failed/skipped lists.
    """
    result = ChecklistGenerationResult()

    available = get_available_docs(report_data)
    all_types = set(CHECKLIST_DOC_CONFIGS.keys())
    skipped_types = all_types - set(available)
    result.skipped = sorted(skipped_types)

    if not available:
        logger.info(
            "checklist_orchestrator: no docs available for parcel=%s (all %d types skipped)",
            parcel_id,
            len(all_types),
        )
        return result

    for doc_type in available:
        try:
            config = CHECKLIST_DOC_CONFIGS[doc_type]
            pdf_bytes = await asyncio.to_thread(
                generate_checklist_pdf, doc_type, report_data, report_name
            )

            filename = f"{config.title.replace(' ', '_').lower()}_{parcel_id}.pdf"

            await _insert_parcel_document(
                db=db,
                parcel_id=parcel_id,
                document_type=doc_type,
                filename=filename,
                file_data=pdf_bytes,
                user_id=user_id,
            )

            result.generated.append(doc_type)
            result.total_bytes += len(pdf_bytes)

        except Exception as exc:
            logger.warning(
                "checklist_orchestrator: failed to generate %s for parcel=%s: %s",
                doc_type,
                parcel_id,
                exc,
            )
            result.failed.append({"doc_type": doc_type, "error": str(exc)})

    await db.flush()

    logger.info(
        "checklist_orchestrator: parcel=%s generated=%d failed=%d skipped=%d total_bytes=%d",
        parcel_id,
        len(result.generated),
        len(result.failed),
        len(result.skipped),
        result.total_bytes,
    )

    return result
