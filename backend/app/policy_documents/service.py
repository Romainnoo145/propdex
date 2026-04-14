"""Service layer for policy document CRUD operations."""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.gemeente_provincie_map import GemeenteProvincieMap
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


async def _resolve_ancestor_chain_by_gemeente(
    gemeente_code: str,
    db: AsyncSession,
) -> dict[str, str]:
    """Resolve a gemeente_code directly into its {landelijk, provincie, gemeente} chain.

    Mirror of cascade_service._resolve_ancestor_chain, but accepts a gemeente_code
    directly (no parcel_id lookup). Used for surfaces without parcel context
    (gemeente card cascade section, rapport via woonplaats lookup).

    Returns a dict that always contains 'landelijk' and 'gemeente' keys, plus
    'provincie' if the gemeente is mapped to one in gemeente_provincie_map.
    """
    chain: dict[str, str] = {"landelijk": "NL", "gemeente": gemeente_code}
    stmt = select(GemeenteProvincieMap.provincie_code).where(
        GemeenteProvincieMap.gemeente_code == gemeente_code
    )
    provincie_code = (await db.execute(stmt)).scalar_one_or_none()
    if provincie_code:
        chain["provincie"] = provincie_code
    return chain


async def get_summaries(
    entity_type: str,
    entity_code: str,
    organization_id: uuid.UUID,  # noqa: ARG001 — kept for backwards compat, unused
    db: AsyncSession,
) -> dict[str, str]:
    """Return {source_key: ai_summary} for all cascade policy docs of a gemeente.

    M045/S03: was previously filtered by organization_id which returned empty
    results for customer orgs (only vendor-org owns policy_documents rows).
    Now cascade-aware with is_global filter — returns the full landelijk/
    provincie/gemeente chain. On source_key conflict across levels, most
    specific wins (gemeente > provincie > landelijk).

    The entity_type parameter is retained but only 'gemeente' is meaningfully
    supported. Non-gemeente callers receive an empty dict.
    """
    if entity_type != "gemeente":
        return {}

    chain = await _resolve_ancestor_chain_by_gemeente(entity_code, db)

    cascade_stmt = text("""
        SELECT DISTINCT ON (entity_type, entity_code, source_key)
            entity_type, source_key, ai_summary
        FROM policy_documents
        WHERE is_global = true
          AND ai_summary IS NOT NULL
          AND ai_summary != ''
          AND (
            (entity_type = 'landelijk' AND entity_code = :landelijk)
            OR (entity_type = 'provincie' AND entity_code = :provincie)
            OR (entity_type = 'gemeente'  AND entity_code = :gemeente)
          )
        ORDER BY entity_type, entity_code, source_key, version_number DESC
    """)
    params = {
        "landelijk": chain.get("landelijk"),
        "provincie": chain.get("provincie"),
        "gemeente": chain.get("gemeente"),
    }
    rows = (await db.execute(cascade_stmt, params)).mappings().all()

    # Precedence: gemeente > provincie > landelijk on same source_key conflict
    PRECEDENCE = {"gemeente": 3, "provincie": 2, "landelijk": 1}
    out: dict[str, str] = {}
    out_priority: dict[str, int] = {}
    for row in rows:
        source_key = row["source_key"]
        level = row["entity_type"]
        priority = PRECEDENCE[level]
        if source_key not in out or priority > out_priority[source_key]:
            out[source_key] = row["ai_summary"]
            out_priority[source_key] = priority
    return out





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
