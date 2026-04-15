"""Cascade policy resolution helpers for the M045 document bundle query.

Resolves a kadaster parcel_id into its ancestor chain:
  landelijk (NL) → provincie (PV##) → gemeente (GM####)

Used by the for_parcel() service (T03) to fetch policy documents at each
level of the Dutch geographic hierarchy.
"""

from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.bundle_schemas import (
    CascadePolicyDocs,
    ChecklistCheck,
    ChecklistItemLinks,
    ChecklistLinkedDocument,
    ChecklistLinksBundle,
    ParcelDocumentBundle,
    ParcelDocumentRead,
    PolicyDocumentRead,
)
from app.models.checklist_progress import ChecklistProgress
from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.parcel_cache import ParcelCache
from app.models.parcel_document import ParcelDocument
from app.models.user import User


async def _resolve_ancestor_chain(parcel_id: str, db: AsyncSession) -> dict[str, str]:
    """Resolve a parcel_id into its {landelijk, provincie, gemeente} ancestor chain.

    Uses parcel_cache.gemeente_code (GM-prefixed) + gemeente_provincie_map lookup.
    Returns {landelijk: 'NL'} only if parcel not found or gemeente_code is null.

    Args:
        parcel_id: Kadaster identifier string (e.g. "HTT02-A-1234" or
            "NL.IMKAD.xxx"), NOT a UUID. Matches parcel_cache.parcel_id.
        db: SQLAlchemy async session.

    Returns:
        dict with keys 'landelijk' (always present), 'gemeente' and 'provincie'
        (present when resolved).
    """
    stmt = select(ParcelCache.gemeente_code).where(ParcelCache.parcel_id == parcel_id)
    gemeente_code = (await db.execute(stmt)).scalar_one_or_none()
    if gemeente_code is None:
        return {"landelijk": "NL"}
    chain: dict[str, str] = {"landelijk": "NL", "gemeente": gemeente_code}
    provincie_stmt = select(GemeenteProvincieMap.provincie_code).where(
        GemeenteProvincieMap.gemeente_code == gemeente_code
    )
    provincie_code = (await db.execute(provincie_stmt)).scalar_one_or_none()
    if provincie_code:
        chain["provincie"] = provincie_code
    return chain


async def _aggregate_checklist_links(
    parcel_id: str,
    organization_id: UUID,
    db: AsyncSession,
) -> ChecklistLinksBundle:
    """Aggregate checklist_progress rows across all users in the org.

    DB model is user-scoped but M045 read-path surfaces team attribution.
    Returns a ChecklistLinksBundle with all 4 use cases always present
    (empty dicts when no activity on that use_case).

    Note on timestamps: ChecklistProgress only stores a row-level
    updated_at, not per-item. So "Alice checked opt-03 on 12 apr" means
    "Alice's optoppen-progress row was last modified on 12 apr and
    currently contains opt-03". Good enough for UX attribution.
    """
    stmt = (
        select(
            ChecklistProgress.use_case,
            ChecklistProgress.checked_items,
            ChecklistProgress.uploaded_documents,
            ChecklistProgress.updated_at,
            User.id.label("user_id"),
            User.full_name,
            User.email,
        )
        .join(User, User.id == ChecklistProgress.user_id)
        .where(
            ChecklistProgress.parcel_id == parcel_id,
            User.organization_id == organization_id,
        )
    )
    rows = (await db.execute(stmt)).all()

    bundle = ChecklistLinksBundle()  # all 4 use_case keys default to {}
    for row in rows:
        use_case_dict = getattr(bundle, row.use_case, None)
        if use_case_dict is None:
            continue  # defensive: unknown/legacy use_case value
        display_name = row.full_name or row.email
        check = ChecklistCheck(
            user_id=row.user_id,
            user_name=display_name,
            updated_at=row.updated_at,
        )
        for item_id in (row.checked_items or []):
            links = use_case_dict.setdefault(item_id, ChecklistItemLinks())
            links.checked_by.append(check)
        for item_id, document_id in (row.uploaded_documents or {}).items():
            links = use_case_dict.setdefault(item_id, ChecklistItemLinks())
            links.linked_documents.append(
                ChecklistLinkedDocument(
                    document_id=UUID(document_id) if isinstance(document_id, str) else document_id,
                    user_id=row.user_id,
                    user_name=display_name,
                    updated_at=row.updated_at,
                )
            )
    return bundle


async def for_parcel(
    parcel_id: str,
    org_id: UUID,
    db: AsyncSession,
) -> ParcelDocumentBundle:
    """Return the complete document bundle for a parcel.

    Includes:
    - peer_docs: the organization's parcel_documents for this parcel (org-scoped)
    - cascade_policy_docs: vendor global policy documents cascading down from
      landelijk (NL) to provincie to gemeente based on the parcel's location
      (resolved via parcel_cache.gemeente_code + gemeente_provincie_map).
      DISTINCT ON returns only the latest version per (entity_type, entity_code,
      source_key) triple and filters out is_global=false rows.
    - checklist_links: ChecklistLinksBundle with per-item org-wide attribution
      (populated by _aggregate_checklist_links).

    Args:
        parcel_id: Kadaster parcel identifier (e.g. "HTT02-A-1234").
        org_id: Organization UUID for peer_docs scoping.
        db: Async SQLAlchemy session.

    Returns:
        ParcelDocumentBundle with peer_docs, cascade_policy_docs, checklist_links.
    """
    # 1. Resolve ancestor chain
    chain = await _resolve_ancestor_chain(parcel_id, db)

    # 2. Cascade query with DISTINCT ON + version_number DESC ordering.
    #    Raw SQL because SQLAlchemy 2.x ORM DISTINCT ON support is limited.
    #    Named parameters for safety.
    cascade_stmt = text("""
        SELECT DISTINCT ON (entity_type, entity_code, source_key)
            id,
            entity_type,
            entity_code,
            source_key,
            filename,
            content_type,
            file_size,
            created_at,
            version_number,
            ai_summary
        FROM policy_documents
        -- When a chain level is absent (e.g. parcel in a gemeente without a provincie
        -- mapping), the corresponding param is None. `col = NULL` in PostgreSQL
        -- evaluates to NULL (not TRUE), so the OR branch contributes no rows — intended.
        WHERE is_global = true
          AND (
            (entity_type = 'landelijk' AND entity_code = :landelijk)
            OR (entity_type = 'provincie' AND entity_code = :provincie)
            OR (entity_type = 'gemeente'  AND entity_code = :gemeente)
          )
        ORDER BY entity_type, entity_code, source_key, version_number DESC
    """)
    cascade_params = {
        "landelijk": chain.get("landelijk"),
        "provincie": chain.get("provincie"),  # None when absent — matches nothing
        "gemeente": chain.get("gemeente"),  # None when absent — matches nothing
    }
    cascade_result = await db.execute(cascade_stmt, cascade_params)
    cascade_rows = cascade_result.mappings().all()

    # 3. Group by entity_type
    cascade_grouped = CascadePolicyDocs()
    for row in cascade_rows:
        dto = PolicyDocumentRead.model_validate(dict(row))
        if row["entity_type"] == "landelijk":
            cascade_grouped.landelijk.append(dto)
        elif row["entity_type"] == "provincie":
            cascade_grouped.provincie.append(dto)
        elif row["entity_type"] == "gemeente":
            cascade_grouped.gemeente.append(dto)

    # 4. Peer_docs query — org-scoped parcel_documents for this parcel
    peer_stmt = (
        select(ParcelDocument)
        .where(
            ParcelDocument.parcel_id == parcel_id,
            ParcelDocument.organization_id == org_id,
        )
        .order_by(ParcelDocument.created_at.desc())
    )
    peer_result = await db.execute(peer_stmt)
    peer_docs = [
        ParcelDocumentRead.model_validate(doc)
        for doc in peer_result.scalars().all()
    ]

    # 5. Checklist links — org-wide attribution via ChecklistProgress aggregation
    checklist_links = await _aggregate_checklist_links(parcel_id, org_id, db)

    return ParcelDocumentBundle(
        peer_docs=peer_docs,
        cascade_policy_docs=cascade_grouped,
        checklist_links=checklist_links,
    )
