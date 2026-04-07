"""CRUD endpoints for policy document uploads (beleidsconfiguratie)."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_superuser
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.policy_documents import service as svc
from app.policy_documents.schemas import PolicyDocumentListResponse, PolicyDocumentResponse, PolicySummariesResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/policy-documents", tags=["PolicyDocuments"])


@router.post(
    "/{entity_type}/{entity_code}",
    response_model=PolicyDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def upload_policy_document(
    request: Request,
    entity_type: str,
    entity_code: str,
    source_key: str = Query(..., description="Data source key (e.g. welstandsnota, omgevingsvisie)"),
    file: UploadFile = ...,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> PolicyDocumentResponse:
    """Upload a policy document for an entity + data source. Superuser only."""
    file_bytes = await file.read()

    error = svc.validate_upload(entity_type, source_key, file.content_type, len(file_bytes))
    if error:
        code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE if "exceeds" in error else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=error)

    doc = await svc.store_document(
        entity_type=entity_type,
        entity_code=entity_code,
        source_key=source_key,
        filename=file.filename or "unnamed",
        content_type=file.content_type or "application/octet-stream",
        file_bytes=file_bytes,
        user_id=current_user.id,
        organization_id=current_user.organization_id,
        db=db,
    )

    logger.info(
        "Policy document uploaded: entity=%s/%s source=%s file=%s size=%d user=%s",
        entity_type, entity_code, source_key, doc.filename, doc.file_size, current_user.id,
    )

    # Enqueue AI summarization for PDF uploads
    if doc.content_type == "application/pdf":
        arq_pool = getattr(request.app.state, "arq_pool", None)
        if arq_pool is not None:
            try:
                await arq_pool.enqueue_job("document_summary_job", str(doc.id))
                logger.info("Enqueued document_summary_job for document %s", doc.id)
            except Exception as enqueue_err:
                logger.warning("Failed to enqueue document_summary_job for %s: %s", doc.id, enqueue_err)
        else:
            logger.warning("ARQ pool not available — skipping AI summary for document %s", doc.id)

    return PolicyDocumentResponse.model_validate(doc)


@router.get(
    "/summaries/{entity_type}/{entity_code}",
    response_model=PolicySummariesResponse,
)
async def get_policy_summaries(
    entity_type: str,
    entity_code: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PolicySummariesResponse:
    """Get AI summaries for all policy documents of an entity. Returns {source_key: ai_summary}."""
    summaries = await svc.get_summaries(
        entity_type=entity_type,
        entity_code=entity_code,
        organization_id=current_user.organization_id,
        db=db,
    )
    return PolicySummariesResponse(summaries=summaries)


@router.get(
    "/{entity_type}/{entity_code}",
    response_model=PolicyDocumentListResponse,
)
async def list_policy_documents(
    entity_type: str,
    entity_code: str,
    source_key: str | None = Query(None, description="Filter by data source key"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PolicyDocumentListResponse:
    """List policy documents for an entity, optionally filtered by source_key."""
    documents, total = await svc.list_documents(
        entity_type=entity_type,
        entity_code=entity_code,
        organization_id=current_user.organization_id,
        source_key=source_key,
        db=db,
    )
    return PolicyDocumentListResponse(
        documents=[PolicyDocumentResponse.model_validate(d) for d in documents],
        total=total,
    )


@router.get("/{entity_type}/{entity_code}/{document_id}")
async def download_policy_document(
    entity_type: str,
    entity_code: str,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Download a policy document file."""
    doc = await svc.get_document_for_download(document_id, current_user.organization_id, db)
    if doc is None or doc.entity_type != entity_type or doc.entity_code != entity_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return Response(
        content=doc.file_data,
        media_type=doc.content_type,
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'},
    )


@router.delete(
    "/{entity_type}/{entity_code}/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_policy_document(
    entity_type: str,
    entity_code: str,
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a policy document. Superuser only."""
    if not await svc.delete_document(document_id, current_user.organization_id, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
