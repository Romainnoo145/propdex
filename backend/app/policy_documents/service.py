"""Service layer for policy document CRUD operations."""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.policy_document import PolicyDocument

logger = logging.getLogger(__name__)

VALID_ENTITY_TYPES = {"gemeente", "provincie", "landelijk"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "image/jpeg",
    "image/png",
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB


def validate_upload(
    entity_type: str,
    source_key: str,
    content_type: str | None,
    file_size: int,
) -> str | None:
    """Validate upload parameters. Returns error message or None."""
    if entity_type not in VALID_ENTITY_TYPES:
        return f"Invalid entity_type: {entity_type}. Must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}"
    if not source_key or len(source_key) > 50:
        return "source_key is required and must be <= 50 characters"
    if content_type not in ALLOWED_CONTENT_TYPES:
        return f"Unsupported file type: {content_type}. Allowed: PDF, DOCX, XLSX, JPEG, PNG"
    if file_size > MAX_FILE_SIZE:
        return f"File size ({file_size:,} bytes) exceeds maximum of {MAX_FILE_SIZE:,} bytes (25MB)"
    if file_size == 0:
        return "File is empty"
    return None


def _assert_vendor_org(organization_id: uuid.UUID) -> None:
    """Enforce that only the Propdex vendor organization can write policy_documents.

    M045/S01 T07 introduces cross-org visibility for policy_documents via
    is_global=true. Only the vendor org (Klarifai) can upload — customer
    orgs get HTTP 403. In development/test environments where
    VENDOR_ORG_ID is None, this guard is a no-op.
    """
    if settings.VENDOR_ORG_ID is None:
        # Dev/test: no vendor org configured, skip the guard
        return
    if organization_id != settings.VENDOR_ORG_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only vendor admins can upload policy documents",
        )


async def _next_version_number(
    entity_type: str,
    entity_code: str,
    source_key: str,
    db: AsyncSession,
) -> int:
    """Return MAX(version_number) + 1 for the given source triple.

    M045/S01 T07 versioning: re-uploading a document for the same
    (entity_type, entity_code, source_key) triple creates a new row with
    an incremented version_number instead of overwriting the previous
    version. The cascade query in S02 uses DISTINCT ON to return only
    the latest version per triple.
    """
    stmt = select(func.coalesce(func.max(PolicyDocument.version_number), 0)).where(
        PolicyDocument.entity_type == entity_type,
        PolicyDocument.entity_code == entity_code,
        PolicyDocument.source_key == source_key,
    )
    current_max = (await db.execute(stmt)).scalar_one()
    return int(current_max) + 1


async def store_document(
    *,
    entity_type: str,
    entity_code: str,
    source_key: str,
    filename: str,
    content_type: str,
    file_bytes: bytes,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    db: AsyncSession,
) -> PolicyDocument:
    """Store a policy document in the database.

    M045/S01 T07: enforces vendor-org-only writes and auto-increments
    version_number for re-uploads. Sets is_global=True unconditionally
    since only the vendor org reaches this point.
    """
    _assert_vendor_org(organization_id)

    version_number = await _next_version_number(
        entity_type=entity_type,
        entity_code=entity_code,
        source_key=source_key,
        db=db,
    )

    doc = PolicyDocument(
        entity_type=entity_type,
        entity_code=entity_code,
        source_key=source_key,
        filename=filename,
        content_type=content_type,
        file_data=file_bytes,
        file_size=len(file_bytes),
        uploaded_by_user_id=user_id,
        organization_id=organization_id,
        is_global=True,
        version_number=version_number,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def list_documents(
    entity_type: str,
    entity_code: str,
    organization_id: uuid.UUID,
    source_key: str | None,
    db: AsyncSession,
) -> tuple[list[PolicyDocument], int]:
    """List policy documents for an entity, optionally filtered by source_key."""
    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.organization_id == organization_id,
            PolicyDocument.entity_type == entity_type,
            PolicyDocument.entity_code == entity_code,
        )
        .order_by(PolicyDocument.created_at.desc())
    )
    count_stmt = (
        select(func.count())
        .select_from(PolicyDocument)
        .where(
            PolicyDocument.organization_id == organization_id,
            PolicyDocument.entity_type == entity_type,
            PolicyDocument.entity_code == entity_code,
        )
    )

    if source_key:
        stmt = stmt.where(PolicyDocument.source_key == source_key)
        count_stmt = count_stmt.where(PolicyDocument.source_key == source_key)

    result = await db.execute(stmt)
    docs = list(result.scalars().all())
    total = (await db.execute(count_stmt)).scalar_one()
    return docs, total


async def get_summaries(
    entity_type: str,
    entity_code: str,
    organization_id: uuid.UUID,
    db: AsyncSession,
) -> dict[str, str]:
    """Return {source_key: ai_summary} for all docs with non-null summaries."""
    stmt = (
        select(PolicyDocument.source_key, PolicyDocument.ai_summary)
        .where(
            PolicyDocument.organization_id == organization_id,
            PolicyDocument.entity_type == entity_type,
            PolicyDocument.entity_code == entity_code,
            PolicyDocument.ai_summary.isnot(None),
            PolicyDocument.ai_summary != "",
        )
        .order_by(PolicyDocument.created_at.desc())
    )
    result = await db.execute(stmt)
    # Latest document per source_key wins (ordered desc, first seen kept)
    summaries: dict[str, str] = {}
    for source_key, ai_summary in result.all():
        if source_key not in summaries:
            summaries[source_key] = ai_summary
    return summaries





async def get_document_for_download(
    document_id: uuid.UUID,
    organization_id: uuid.UUID,
    db: AsyncSession,
) -> PolicyDocument | None:
    """Get a document with file bytes for download."""
    stmt = select(PolicyDocument).where(
        PolicyDocument.id == document_id,
        PolicyDocument.organization_id == organization_id,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_document(
    document_id: uuid.UUID,
    organization_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """Delete a policy document. Returns True if found and deleted.

    M045/S01 T07: only the vendor org can delete policy_documents.
    Customer orgs get HTTP 403 before the lookup even runs.
    """
    _assert_vendor_org(organization_id)
    doc = await get_document_for_download(document_id, organization_id, db)
    if doc is None:
        return False
    await db.delete(doc)
    await db.commit()
    return True
