"""CRUD endpoints for per-parcel document uploads."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.documents import documents_service as svc
from app.documents.bundle_schemas import ParcelDocumentBundle
from app.documents.cascade_service import for_parcel as cascade_for_parcel
from app.documents.documents_service import VALID_DOCUMENT_TYPES  # noqa: F401 — re-export for tests
from app.documents.schemas import ChecklistStatusResponse, DocumentListResponse, DocumentResponse
from app.middleware.rate_limit import limiter
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])
parcels_router = APIRouter(prefix="/api/parcels", tags=["Documents"])


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
    file_bytes = await file.read()

    error = svc.validate_upload(document_type, file.content_type, len(file_bytes))
    if error:
        code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE if "exceeds" in error else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=error)

    doc = await svc.store_document(
        parcel_id=parcel_id,
        document_type=document_type,
        filename=file.filename or "unnamed",
        content_type=file.content_type or "application/octet-stream",
        file_bytes=file_bytes,
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        db=db,
    )

    await svc.try_ai_summarize(doc, file_bytes, file.content_type or "", db)

    logger.info(
        "Document uploaded: parcel=%s type=%s file=%s size=%d user=%s",
        parcel_id, document_type, doc.filename, doc.file_size, current_user.id,
    )
    return DocumentResponse.model_validate(doc)


@router.get("/{parcel_id}/documents", response_model=DocumentListResponse)
async def list_documents(
    parcel_id: str,
    document_type: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentListResponse:
    """List document metadata for a parcel (without file bytes)."""
    documents, total = await svc.list_documents(parcel_id, current_user.organization_id, document_type, db)
    return DocumentListResponse(documents=documents, total=total)


@router.get("/{parcel_id}/checklist-status", response_model=ChecklistStatusResponse)
async def get_checklist_status(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ChecklistStatusResponse:
    """Get checklist completion status for a parcel."""
    return await svc.get_checklist_status(parcel_id, current_user.id, db)


@router.get("/{parcel_id}/documents/{document_id}")
async def download_document(
    parcel_id: str,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Download/preview a document file."""
    doc = await svc.get_document_for_download(parcel_id, document_id, current_user.organization_id, db)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return Response(
        content=doc.file_data,
        media_type=doc.content_type,
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'},
    )


@router.delete("/{parcel_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    parcel_id: str,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a document."""
    if not await svc.delete_document(parcel_id, document_id, current_user.id, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")


@parcels_router.get(
    "/{parcel_id}/documents/bundle",
    response_model=ParcelDocumentBundle,
)
async def get_parcel_document_bundle(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ParcelDocumentBundle:
    """Return the unified document bundle for a parcel.

    Includes:
    - peer_docs: current organization's parcel_documents for this parcel
    - cascade_policy_docs: vendor-global policy documents cascading from
      landelijk (NL) → provincie → gemeente based on the parcel's location
      (resolved via parcel_cache.gemeente_code + gemeente_provincie_map).
    - checklist_links: explicit-link markers (currently empty — S04 wires
      this up with ChecklistProgress aggregation across users).
    """
    return await cascade_for_parcel(
        parcel_id=parcel_id,
        org_id=current_user.organization_id,
        db=db,
    )
