"""Document management business logic (extracted from router, M023/S02/T05)."""

import logging
import uuid
from functools import lru_cache

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer

from app.documents.schemas import ChecklistItemStatus, ChecklistStatusResponse, DocumentResponse
from app.models.parcel_document import ParcelDocument

logger = logging.getLogger(__name__)

# 25 MB max file size
MAX_FILE_SIZE = 25 * 1024 * 1024

VALID_DOCUMENT_TYPES: set[str] = {
    "bestemmingscheck",
    "perceeldata",
    "vergunninghistorie",
    "woz",
    "quickscan",
    "bodem",
    "fundering",
    "asbest",
    "bouwkundig",
    "energielabel",
    "bestemmingsplan",
    "milieuzones",
    "geluid",
    "stikstof",
    "kadaster",
    "eigendom",
    "erfpacht",
    "documenten",
    "correspondentie",
    "ideeen",
    "checklist",
    # Checklist auto-generated document types (M020)
    "wkb_precheck",
    "monumenten",
    "vergunningen",
    "risicoprofiel",
    "haalbaarheid",
    # Gemeente-level beleidsdocumenten (auto-ingested via KOOP SRU)
    "omgevingsvisie",
    "woonvisie",
    "welstandsnota",
    "parkeernormen",
    "grondbeleid",
    "huisvestingsverordening",
}

ALLOWED_CONTENT_TYPES: set[str] = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@lru_cache(maxsize=1)
def _parcel_documents_insert_sql(include_organization_id: bool) -> str:
    if include_organization_id:
        return """
            INSERT INTO parcel_documents (
                parcel_id, document_type, filename, content_type,
                file_data, file_size, uploaded_by_user_id, organization_id
            ) VALUES (
                :parcel_id, :document_type, :filename, :content_type,
                :file_data, :file_size, :uploaded_by_user_id, :organization_id
            )
            RETURNING id
        """
    return """
        INSERT INTO parcel_documents (
            parcel_id, document_type, filename, content_type,
            file_data, file_size, uploaded_by_user_id
        ) VALUES (
            :parcel_id, :document_type, :filename, :content_type,
            :file_data, :file_size, :uploaded_by_user_id
        )
        RETURNING id
    """


async def _parcel_documents_has_organization_column(db: AsyncSession) -> bool:
    result = await db.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'parcel_documents'
              AND column_name = 'organization_id'
            LIMIT 1
            """
        )
    )
    return result.scalar() is not None


def validate_upload(
    document_type: str,
    content_type: str | None,
    file_size: int,
) -> str | None:
    """Validate upload parameters. Returns error message or None."""
    if document_type not in VALID_DOCUMENT_TYPES:
        return f"Invalid document_type '{document_type}'. Must be one of: {sorted(VALID_DOCUMENT_TYPES)}"
    if content_type not in ALLOWED_CONTENT_TYPES:
        return f"File type '{content_type}' not allowed. Allowed: PDF, JPEG, PNG, WebP, DOCX, XLSX."
    if file_size > MAX_FILE_SIZE:
        return f"File size {file_size} bytes exceeds maximum of {MAX_FILE_SIZE} bytes (25MB)."
    return None


async def store_document(
    parcel_id: str,
    document_type: str,
    filename: str,
    content_type: str,
    file_bytes: bytes,
    user_id: uuid.UUID,
    organization_id: uuid.UUID | None,
    db: AsyncSession,
) -> ParcelDocument:
    """Insert document via raw SQL (migration-aware) and return ORM instance."""
    include_org = await _parcel_documents_has_organization_column(db)

    params: dict = {
        "parcel_id": parcel_id,
        "document_type": document_type,
        "filename": filename,
        "content_type": content_type,
        "file_data": file_bytes,
        "file_size": len(file_bytes),
        "uploaded_by_user_id": user_id,
    }
    if include_org:
        params["organization_id"] = organization_id

    inserted = await db.execute(text(_parcel_documents_insert_sql(include_org)), params)
    doc_id = inserted.scalar_one()
    await db.commit()

    result = await db.execute(select(ParcelDocument).where(ParcelDocument.id == doc_id))
    return result.scalar_one()


async def try_ai_summarize(doc: ParcelDocument, file_bytes: bytes, content_type: str, db: AsyncSession) -> None:
    """Attempt AI summarization for PDFs. Non-blocking — failures are silent."""
    try:
        from app.services.document_summarizer import summarize_document

        summary = await summarize_document(file_bytes, content_type, doc.filename)
        if summary:
            doc.ai_summary = summary
            await db.commit()
    except Exception:
        logger.debug("AI summarization skipped for %s", doc.filename)


async def list_documents(
    parcel_id: str,
    user_id: uuid.UUID,
    document_type: str | None,
    db: AsyncSession,
) -> tuple[list[DocumentResponse], int]:
    """List document metadata for a parcel (without file bytes)."""
    query = (
        select(ParcelDocument)
        .options(defer(ParcelDocument.file_data))
        .where(
            ParcelDocument.uploaded_by_user_id == user_id,
            ParcelDocument.parcel_id == parcel_id,
        )
        .order_by(ParcelDocument.created_at.desc())
    )
    if document_type is not None:
        query = query.where(ParcelDocument.document_type == document_type)

    result = await db.execute(query)
    documents = [DocumentResponse.model_validate(d) for d in result.scalars().all()]

    count_query = select(func.count(ParcelDocument.id)).where(
        ParcelDocument.uploaded_by_user_id == user_id,
        ParcelDocument.parcel_id == parcel_id,
    )
    if document_type is not None:
        count_query = count_query.where(ParcelDocument.document_type == document_type)
    total = (await db.execute(count_query)).scalar() or 0

    return documents, total


async def get_document_for_download(
    parcel_id: str,
    document_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> ParcelDocument | None:
    """Get full document (with file_data) for download."""
    result = await db.execute(
        select(ParcelDocument).where(
            ParcelDocument.id == document_id,
            ParcelDocument.uploaded_by_user_id == user_id,
            ParcelDocument.parcel_id == parcel_id,
        )
    )
    return result.scalar_one_or_none()


async def delete_document(
    parcel_id: str,
    document_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """Delete a document. Returns False if not found."""
    result = await db.execute(
        select(ParcelDocument).where(
            ParcelDocument.id == document_id,
            ParcelDocument.uploaded_by_user_id == user_id,
            ParcelDocument.parcel_id == parcel_id,
        )
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        return False

    await db.delete(doc)
    await db.commit()
    logger.info("Document deleted: id=%s parcel=%s user=%s", document_id, parcel_id, user_id)
    return True


async def get_checklist_status(
    parcel_id: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> ChecklistStatusResponse:
    """Get checklist completion status for a parcel.

    Maps generated checklist documents back to their checklist item IDs.
    Lazy generation: if no docs exist yet but parcel has a saved report,
    generates them on the fly (backfill for pre-M020 reports).
    """
    from app.reports.checklist_pdf import CHECKLIST_DOC_CONFIGS

    checklist_doc_types = set(CHECKLIST_DOC_CONFIGS.keys())
    query = (
        select(ParcelDocument)
        .options(defer(ParcelDocument.file_data))
        .where(
            ParcelDocument.uploaded_by_user_id == user_id,
            ParcelDocument.parcel_id == parcel_id,
            ParcelDocument.document_type.in_(checklist_doc_types),
        )
    )
    result = await db.execute(query)
    docs = list(result.scalars().all())

    # Lazy generation from saved report
    if not docs:
        try:
            from app.reports import service as report_service
            from app.reports.checklist_orchestrator import generate_checklist_documents

            report = await report_service.get_report_by_source_parcel(
                parcel_id=parcel_id, user_id=user_id, session=db,
            )
            if report and report.report_data:
                gen_result = await generate_checklist_documents(
                    report_data=report.report_data,
                    report_name=report.report_name,
                    parcel_id=parcel_id,
                    user_id=user_id,
                    db=db,
                )
                await db.commit()
                logger.info(
                    "Lazy-generated checklist docs for parcel=%s: generated=%d",
                    parcel_id, len(gen_result.generated),
                )
                result = await db.execute(query)
                docs = list(result.scalars().all())
        except Exception:
            logger.warning("Lazy checklist generation failed for parcel=%s", parcel_id, exc_info=True)

    # Build doc_type → document mapping (latest per type)
    doc_by_type: dict[str, ParcelDocument] = {}
    for doc in docs:
        if doc.document_type not in doc_by_type:
            doc_by_type[doc.document_type] = doc

    items: dict[str, ChecklistItemStatus] = {}
    for doc_type, config in CHECKLIST_DOC_CONFIGS.items():
        doc = doc_by_type.get(doc_type)
        for item_id in config.checklist_item_ids:
            if doc:
                items[item_id] = ChecklistItemStatus(
                    status="generated", document_id=doc.id,
                    document_type=doc_type, filename=doc.filename,
                )
            else:
                items[item_id] = ChecklistItemStatus(status="pending")

    generated_count = sum(1 for v in items.values() if v.status == "generated")
    return ChecklistStatusResponse(
        parcel_id=parcel_id, items=items,
        generated_count=generated_count, total_count=len(items),
    )
