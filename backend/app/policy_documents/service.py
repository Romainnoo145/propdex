"""Service layer for policy document CRUD operations."""

import logging
import uuid
from datetime import datetime
from typing import cast

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.policy_document import PolicyDocument
from app.models.user import User
from app.policy_documents.admin_schemas import (
    AdminGemeenteEntry,
    AdminPolicyOverviewResponse,
    AdminPolicyOverviewRow,
    AdminPolicyOverviewTotals,
    AdminPolicyVersionRow,
    AdminPolicyVersionsResponse,
)
from app.policy_documents.extraction_status import get_extraction_map
from app.policy_documents.source_keys import (
    get_source_key_label,
    is_valid_source_key,
)

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
    if not is_valid_source_key(entity_type, source_key):
        return f"source_key '{source_key}' is niet toegestaan voor niveau '{entity_type}'"
    if content_type not in ALLOWED_CONTENT_TYPES:
        return f"Unsupported file type: {content_type}. Allowed: PDF, DOCX, XLSX, JPEG, PNG"
    if file_size > MAX_FILE_SIZE:
        return f"File size ({file_size:,} bytes) exceeds maximum of {MAX_FILE_SIZE:,} bytes (25MB)"
    if file_size == 0:
        return "File is empty"
    return None



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

    M045/S01 T07: auto-increments version_number for re-uploads.
    Sets is_global=True unconditionally since only superadmins reach this point.
    """
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
) -> dict[str, list[dict[str, object]]]:
    """Return {source_key: randvoorwaarden} for cascade policy docs of a gemeente.

    Reads the latest doc per (entity_type, entity_code, source_key) triple
    via DISTINCT ON, then looks up extracted randvoorwaarden from the cascade
    extraction cache. Only docs with status 'parsed' and a non-empty
    randvoorwaarden list are included.

    On source_key conflict across levels, most specific wins:
    gemeente > provincie > landelijk.

    The entity_type parameter is retained but only 'gemeente' is meaningfully
    supported. Non-gemeente callers receive an empty dict.
    """
    if entity_type != "gemeente":
        return {}

    chain = await _resolve_ancestor_chain_by_gemeente(entity_code, db)

    cascade_stmt = text("""
        SELECT DISTINCT ON (entity_type, entity_code, source_key)
            id, entity_type, source_key
        FROM policy_documents
        WHERE is_global = true
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

    if not rows:
        return {}

    doc_pairs = [(row["id"], row["source_key"]) for row in rows]
    extraction_map = await get_extraction_map(db, doc_pairs)

    # Precedence: gemeente > provincie > landelijk on same source_key conflict
    PRECEDENCE = {"gemeente": 3, "provincie": 2, "landelijk": 1}
    out: dict[str, list[dict[str, object]]] = {}
    out_priority: dict[str, int] = {}
    for row in rows:
        source_key = row["source_key"]
        level = row["entity_type"]
        doc_id = row["id"]
        priority = PRECEDENCE[level]
        info = extraction_map.get(doc_id)
        if info is None or info["status"] != "parsed":
            continue
        extraction = info["extraction"]
        if not extraction:
            continue
        randvoorwaarden = extraction.get("randvoorwaarden")
        if not randvoorwaarden:
            continue
        if source_key not in out or priority > out_priority[source_key]:
            out[source_key] = cast(list[dict[str, object]], randvoorwaarden)
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
    db: AsyncSession,
) -> bool:
    """Delete a policy document by id. Returns True if found and deleted.

    Superadmin-only — enforced at the router level via get_current_superuser.
    Policy documents are global (is_global=true), so the lookup is org-agnostic:
    any superadmin may delete a global doc regardless of their own organization.
    """
    stmt = select(PolicyDocument).where(PolicyDocument.id == document_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if doc is None:
        return False
    await db.delete(doc)
    await db.commit()
    return True


# ---------------------------------------------------------------------------
# M045/S05: Admin overview (vendor-only policy document catalog)
# ---------------------------------------------------------------------------

# Provincie lookup — CBS PV codes → names. Seeded from the fixed set of 12 NL
# provinces. NOT queried from DB because there is no provincie table (only
# gemeente_provincie_map, which maps code → code).
_PROVINCIE_NAMES: dict[str, str] = {
    "PV20": "Groningen",
    "PV21": "Fryslân",
    "PV22": "Drenthe",
    "PV23": "Overijssel",
    "PV24": "Flevoland",
    "PV25": "Gelderland",
    "PV26": "Utrecht",
    "PV27": "Noord-Holland",
    "PV28": "Zuid-Holland",
    "PV29": "Zeeland",
    "PV30": "Noord-Brabant",
    "PV31": "Limburg",
}


def _is_auto_ingested(filename: str) -> bool:
    """True iff filename matches S06 KOOP/CVDR auto-ingest prefix."""
    return filename.startswith("koop-cvdr-")


async def _gemeente_name_map(db: AsyncSession) -> dict[str, str]:
    """Deprecated re-export — use app.services.gemeente_name_lookup.get_gemeente_name_map.

    Thin wrapper kept for M045 callers that import this function directly.
    M049/S02 extracted the real implementation to the shared module.
    """
    from app.services.gemeente_name_lookup import get_gemeente_name_map

    return await get_gemeente_name_map(db)


def _resolve_entity_display_name(
    entity_type: str,
    entity_code: str,
    gemeente_names: dict[str, str],
) -> str:
    """Resolve human-readable name for an (entity_type, entity_code) pair.

    - 'landelijk' → always 'Nederland'
    - 'provincie' → _PROVINCIE_NAMES lookup (unknown PV codes fall back to entity_code)
    - 'gemeente' → best-effort gemeente_names map (sourced from area_scans);
      falls back to entity_code when the gemeente has never been scanned.
    """
    if entity_type == "landelijk":
        return "Nederland"
    if entity_type == "provincie":
        return _PROVINCIE_NAMES.get(entity_code, entity_code)
    if entity_type == "gemeente":
        return gemeente_names.get(entity_code, entity_code)
    return entity_code


async def fetch_admin_overview(db: AsyncSession) -> AdminPolicyOverviewResponse:
    """Return admin overview grouped by cascade level. Latest version per slot.

    M045/S05 T03. Vendor-only data fetch (caller enforces the vendor guard).

    Strategy:
      1. DISTINCT ON (entity_type, entity_code, source_key) picks the newest
         version per slot (Postgres-specific, matches S02 cascade_service).
      2. A separate count subquery provides total-versions-per-slot.
      3. Uploader name comes from an INNER JOIN with users.
      4. Display names are resolved in-process from two cheap lookups:
         hardcoded provincie dict + one-shot area_scans name map.
      5. In-process grouping by entity_type (landelijk / provincie / gemeente).
    """
    # 1. DISTINCT ON latest versions (CTE)
    latest_cte = (
        select(
            PolicyDocument.id.label("latest_id"),
            PolicyDocument.entity_type,
            PolicyDocument.entity_code,
            PolicyDocument.source_key,
            PolicyDocument.version_number.label("latest_version_number"),
            PolicyDocument.filename.label("latest_filename"),
            PolicyDocument.created_at.label("latest_uploaded_at"),
            PolicyDocument.uploaded_by_user_id.label("uploaded_by_user_id"),
        )
        .distinct(
            PolicyDocument.entity_type,
            PolicyDocument.entity_code,
            PolicyDocument.source_key,
        )
        .where(PolicyDocument.is_global.is_(True))
        .order_by(
            PolicyDocument.entity_type,
            PolicyDocument.entity_code,
            PolicyDocument.source_key,
            PolicyDocument.version_number.desc(),
        )
        .cte("latest_policy_docs")
    )

    # 2. Count subquery — versions per slot
    count_subq = (
        select(
            PolicyDocument.entity_type.label("entity_type"),
            PolicyDocument.entity_code.label("entity_code"),
            PolicyDocument.source_key.label("source_key"),
            func.count(PolicyDocument.id).label("version_count"),
        )
        .where(PolicyDocument.is_global.is_(True))
        .group_by(
            PolicyDocument.entity_type,
            PolicyDocument.entity_code,
            PolicyDocument.source_key,
        )
        .subquery()
    )

    # 3. Join latest with user + version count
    stmt = (
        select(
            latest_cte.c.latest_id,
            latest_cte.c.entity_type,
            latest_cte.c.entity_code,
            latest_cte.c.source_key,
            latest_cte.c.latest_version_number,
            latest_cte.c.latest_filename,
            latest_cte.c.latest_uploaded_at,
            User.full_name,
            User.email,
            count_subq.c.version_count,
        )
        .join(User, User.id == latest_cte.c.uploaded_by_user_id)
        .join(
            count_subq,
            (count_subq.c.entity_type == latest_cte.c.entity_type)
            & (count_subq.c.entity_code == latest_cte.c.entity_code)
            & (count_subq.c.source_key == latest_cte.c.source_key),
        )
    )

    rows = (await db.execute(stmt)).all()

    # Resolve gemeente names once (cheap single query), not per row.
    gemeente_names = await _gemeente_name_map(db)

    buckets: dict[str, list[AdminPolicyOverviewRow]] = {
        "landelijk": [],
        "provincie": [],
        "gemeente": [],
    }
    latest_any: datetime | None = None

    for row in rows:
        display_name = _resolve_entity_display_name(
            row.entity_type, row.entity_code, gemeente_names,
        )
        source_label = (
            get_source_key_label(row.entity_type, row.source_key)
            or row.source_key
        )
        uploader_name = row.full_name or row.email

        admin_row = AdminPolicyOverviewRow(
            entity_type=row.entity_type,
            entity_code=row.entity_code,
            entity_display_name=display_name,
            source_key=row.source_key,
            source_key_label=source_label,
            latest_version_id=row.latest_id,
            latest_version_number=row.latest_version_number,
            latest_filename=row.latest_filename,
            latest_uploaded_at=row.latest_uploaded_at,
            latest_uploader_name=uploader_name,
            version_count=row.version_count,
            auto_ingest=_is_auto_ingested(row.latest_filename),
        )
        if row.entity_type in buckets:
            buckets[row.entity_type].append(admin_row)

        if latest_any is None or row.latest_uploaded_at > latest_any:
            latest_any = row.latest_uploaded_at

    gemeente_count = len({r.entity_code for r in buckets["gemeente"]})
    totals = AdminPolicyOverviewTotals(
        total_docs=sum(
            r.version_count
            for r in (
                buckets["landelijk"] + buckets["provincie"] + buckets["gemeente"]
            )
        ),
        total_gemeenten=gemeente_count,
        latest_upload_at=latest_any,
    )

    return AdminPolicyOverviewResponse(
        landelijk=buckets["landelijk"],
        provinciaal=buckets["provincie"],
        gemeentelijk=buckets["gemeente"],
        totals=totals,
    )


async def fetch_admin_versions(
    entity_type: str,
    entity_code: str,
    source_key: str,
    db: AsyncSession,
) -> AdminPolicyVersionsResponse:
    """Return all versions of a single (entity_type, entity_code, source_key) slot.

    Newest first. Used by the admin UI when a row is expanded.
    """
    stmt = (
        select(
            PolicyDocument.id,
            PolicyDocument.version_number,
            PolicyDocument.filename,
            PolicyDocument.file_size,
            PolicyDocument.content_type,
            PolicyDocument.created_at,
            User.full_name,
            User.email,
        )
        .join(User, User.id == PolicyDocument.uploaded_by_user_id)
        .where(
            PolicyDocument.entity_type == entity_type,
            PolicyDocument.entity_code == entity_code,
            PolicyDocument.source_key == source_key,
            PolicyDocument.is_global.is_(True),
        )
        .order_by(PolicyDocument.version_number.desc())
    )

    rows = (await db.execute(stmt)).all()
    versions = [
        AdminPolicyVersionRow(
            id=r.id,
            version_number=r.version_number,
            filename=r.filename,
            file_size=r.file_size,
            content_type=r.content_type,
            uploaded_at=r.created_at,
            uploader_name=r.full_name or r.email,
        )
        for r in rows
    ]

    source_label = get_source_key_label(entity_type, source_key) or source_key

    return AdminPolicyVersionsResponse(
        entity_type=entity_type,
        entity_code=entity_code,
        source_key=source_key,
        source_key_label=source_label,
        versions=versions,
    )


async def fetch_admin_gemeenten(db: AsyncSession) -> list[AdminGemeenteEntry]:
    """Return all 342 gemeenten for the admin upload dropdown.

    Names are resolved opportunistically from area_scans (same approach as
    fetch_admin_overview). Gemeenten never scanned fall back to the raw
    GM-code as their display name. Sorted by display name.
    """
    stmt = select(
        GemeenteProvincieMap.gemeente_code,
        GemeenteProvincieMap.provincie_code,
    )
    rows = (await db.execute(stmt)).all()

    gemeente_names = await _gemeente_name_map(db)

    entries = [
        AdminGemeenteEntry(
            code=row.gemeente_code,
            naam=gemeente_names.get(row.gemeente_code, row.gemeente_code),
            provincie_code=row.provincie_code,
        )
        for row in rows
    ]
    entries.sort(key=lambda e: e.naam.lower())
    return entries
