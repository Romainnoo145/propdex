"""CRUD endpoints for per-parcel document uploads."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.documents.schemas import DocumentListResponse, DocumentResponse
from app.middleware.rate_limit import limiter
from app.models.parcel_document import ParcelDocument
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])

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
}

ALLOWED_CONTENT_TYPES: set[str] = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@router.post(
    "/{parcel_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    parcel_id: str,
    document_type: str,
    file: UploadFile,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    """Upload a document for a parcel in a specific dossier category."""
    # Validate document_type
    if document_type not in VALID_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document_type '{document_type}'. Must be one of: {sorted(VALID_DOCUMENT_TYPES)}",
        )

    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file.content_type}' not allowed. Allowed: PDF, JPEG, PNG, WebP, DOCX, XLSX.",
        )

    # Read file bytes and validate size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size {len(file_bytes)} bytes exceeds maximum of {MAX_FILE_SIZE} bytes (25MB).",
        )

    doc = ParcelDocument(
        parcel_id=parcel_id,
        document_type=document_type,
        filename=file.filename or "unnamed",
        content_type=file.content_type,
        file_data=file_bytes,
        file_size=len(file_bytes),
        uploaded_by_user_id=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Trigger AI summarization for PDFs (non-blocking — failures are silent)
    try:
        from app.services.document_summarizer import summarize_document

        summary = await summarize_document(file_bytes, file.content_type or "", doc.filename)
        if summary:
            doc.ai_summary = summary
            await db.commit()
    except Exception:
        logger.debug("AI summarization skipped for %s", doc.filename)

    logger.info(
        "Document uploaded: parcel=%s type=%s file=%s size=%d user=%s",
        parcel_id,
        document_type,
        doc.filename,
        doc.file_size,
        current_user.id,
    )

    return DocumentResponse.model_validate(doc)


@router.get(
    "/{parcel_id}/documents",
    response_model=DocumentListResponse,
)
async def list_documents(
    parcel_id: str,
    document_type: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentListResponse:
    """List document metadata for a parcel (without file bytes)."""
    query = (
        select(ParcelDocument)
        .options(defer(ParcelDocument.file_data))
        .where(
            ParcelDocument.uploaded_by_user_id == current_user.id,
            ParcelDocument.parcel_id == parcel_id,
        )
        .order_by(ParcelDocument.created_at.desc())
    )

    if document_type is not None:
        query = query.where(ParcelDocument.document_type == document_type)

    result = await db.execute(query)
    documents = list(result.scalars().all())

    # Count query
    count_query = select(func.count(ParcelDocument.id)).where(
        ParcelDocument.uploaded_by_user_id == current_user.id,
        ParcelDocument.parcel_id == parcel_id,
    )
    if document_type is not None:
        count_query = count_query.where(ParcelDocument.document_type == document_type)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in documents],
        total=total,
    )


@router.get(
    "/{parcel_id}/documents/{document_id}",
)
async def download_document(
    parcel_id: str,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Download/preview a document file."""
    result = await db.execute(
        select(ParcelDocument).where(
            ParcelDocument.id == document_id,
            ParcelDocument.uploaded_by_user_id == current_user.id,
            ParcelDocument.parcel_id == parcel_id,
        )
    )
    doc = result.scalar_one_or_none()

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    return Response(
        content=doc.file_data,
        media_type=doc.content_type,
        headers={
            "Content-Disposition": f'inline; filename="{doc.filename}"',
        },
    )


@router.delete(
    "/{parcel_id}/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_document(
    parcel_id: str,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a document."""
    result = await db.execute(
        select(ParcelDocument).where(
            ParcelDocument.id == document_id,
            ParcelDocument.uploaded_by_user_id == current_user.id,
            ParcelDocument.parcel_id == parcel_id,
        )
    )
    doc = result.scalar_one_or_none()

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    await db.delete(doc)
    await db.commit()

    logger.info(
        "Document deleted: id=%s parcel=%s user=%s",
        document_id,
        parcel_id,
        current_user.id,
    )
