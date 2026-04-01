"""Business logic for change monitoring endpoints."""

import logging
import uuid

from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.change_read_state import ChangeReadState
from app.models.change_record import ChangeRecord
from app.models.project import Project
from app.monitoring._helpers import (
    _build_address_from_components,
    _build_address_from_hints,
    _extract_huisnummer_from_address,
    _extract_match_hints,
    _find_parcel_by_address_hint,
)
from app.schemas.monitoring import (
    ChangeRecordListResponse,
    ChangeRecordResponse,
    MarkAllReadResponse,
    MatchedParcel,
    MatchedReport,
    ProjectUnreadCount,
    UnreadDetailResponse,
)
from app.services.bekendmaking_matcher import (
    find_changes_for_parcel,
    find_matching_parcels,
    find_matching_reports,
)
from app.services.category_classifier import classify_bekendmaking
from app.services.postcode_extractor import extract_postcodes

logger = logging.getLogger(__name__)


async def _change_read_states_has_org_column(db: AsyncSession) -> bool:
    """Return True when the legacy organization_id column is still present."""
    result = await db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'change_read_states'
                  AND column_name = 'organization_id'
            )
            """
        )
    )
    return bool(result.scalar())


async def _insert_change_read_rows(
    *,
    db: AsyncSession,
    rows: list[dict[str, uuid.UUID]],
    organization_id: uuid.UUID,
):
    """Insert read-state rows across both legacy and current schemas."""
    if await _change_read_states_has_org_column(db):
        legacy_rows = [
            {
                "organization_id": organization_id,
                "user_id": row["user_id"],
                "change_id": row["change_id"],
            }
            for row in rows
        ]
        return await db.execute(
            text(
                """
                INSERT INTO change_read_states (organization_id, user_id, change_id)
                VALUES (:organization_id, :user_id, :change_id)
                ON CONFLICT ON CONSTRAINT uq_change_read_states_user_change DO NOTHING
                """
            ),
            legacy_rows,
        )

    stmt = pg_insert(ChangeReadState).values(rows).on_conflict_do_nothing(
        constraint="uq_change_read_states_user_change",
    )
    return await db.execute(stmt)


def _resolve_effective_postcode(change: ChangeRecord) -> str | None:
    """Extract effective postcode from change record metadata or text fields."""
    if change.postcode:
        return change.postcode

    components = (change.metadata_json or {}).get("address_components")
    if isinstance(components, dict) and components.get("postcode"):
        return str(components["postcode"]).upper().replace(" ", "")

    for text_candidate in (change.address, change.title, change.source_url):
        if not text_candidate:
            continue
        extracted = extract_postcodes(text_candidate)
        if extracted:
            return extracted[0]

    return None


async def get_changes_list(
    *,
    db: AsyncSession,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    project_id: uuid.UUID | None,
    gemeente_naam: str | None,
    include_matches: bool,
    limit: int,
    offset: int,
) -> ChangeRecordListResponse:
    """Fetch paginated change records with optional match enrichment."""
    # Per-project path: verify project
    if project_id is not None:
        project_query = select(Project).where(
            Project.id == project_id,
            Project.organization_id == organization_id,
        )
        project_result = await db.execute(project_query)
        project = project_result.scalar_one_or_none()
        if project is None:
            return None  # Signal 404 to caller

    # Query change records
    changes_query = (
        select(ChangeRecord)
        .order_by(ChangeRecord.detected_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if project_id is not None:
        changes_query = changes_query.where(ChangeRecord.project_id == project_id)
    if gemeente_naam is not None:
        changes_query = changes_query.where(ChangeRecord.gemeente_naam == gemeente_naam)

    changes_result = await db.execute(changes_query)
    changes = changes_result.scalars().all()

    # Count total
    count_query = select(func.count(ChangeRecord.id)).where()
    if project_id is not None:
        count_query = count_query.where(ChangeRecord.project_id == project_id)
    if gemeente_naam is not None:
        count_query = count_query.where(ChangeRecord.gemeente_naam == gemeente_naam)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # For all-org feed, pre-load project names
    project_names: dict[uuid.UUID, str] = {}
    if project_id is None and changes:
        project_ids = {c.project_id for c in changes}
        names_query = select(Project.id, Project.name).where(Project.id.in_(project_ids))
        names_result = await db.execute(names_query)
        project_names = dict(names_result.all())

    # Build response with optional match enrichment
    change_responses: list[ChangeRecordResponse] = []
    for change in changes:
        matched_parcels = None
        matched_reports = None
        components = (change.metadata_json or {}).get("address_components")
        effective_postcode = _resolve_effective_postcode(change)

        effective_address = change.address or _build_address_from_components(
            components, effective_postcode
        )
        resolved_parcel_id = change.matched_parcel_id
        if resolved_parcel_id is None and include_matches:
            hints = _extract_match_hints(change, effective_postcode)
            if hints is not None:
                resolved_parcel_id = await _find_parcel_by_address_hint(
                    street=hints[0],
                    huisnummer=hints[1],
                    db=db,
                    postcode=hints[2],
                    city=hints[3],
                )
                if effective_address is None:
                    effective_address = _build_address_from_hints(
                        street=hints[0],
                        huisnummer=hints[1],
                        postcode=hints[2],
                        city=hints[3],
                        gemeente_naam=change.gemeente_naam,
                    )
        hints_for_ui = _extract_match_hints(change, effective_postcode)
        huisnummer_hint = (
            hints_for_ui[1]
            if hints_for_ui is not None
            else _extract_huisnummer_from_address(effective_address)
        )

        if include_matches and effective_postcode:
            try:
                parcel_matches = await find_matching_parcels(effective_postcode, db)
                report_matches = await find_matching_reports(
                    effective_postcode, user_id, db
                )
                if parcel_matches:
                    matched_parcels = [MatchedParcel(**m) for m in parcel_matches]
                if report_matches:
                    matched_reports = [MatchedReport(**m) for m in report_matches]
            except Exception:
                logger.exception(
                    "Failed to enrich matches for change %s (postcode=%s)",
                    change.id,
                    effective_postcode,
                )

        change_responses.append(
            ChangeRecordResponse(
                id=str(change.id),
                project_id=str(change.project_id),
                change_type=change.change_type,
                external_id=change.external_id,
                title=change.title,
                detected_at=change.detected_at.isoformat(),
                change_date=change.change_date.isoformat(),
                gemeente_naam=change.gemeente_naam,
                address=effective_address,
                source_url=change.source_url,
                postcode=effective_postcode,
                huisnummer_hint=huisnummer_hint,
                matched_parcel_id=(
                    str(resolved_parcel_id) if resolved_parcel_id else None
                ),
                matched_parcels=matched_parcels,
                matched_reports=matched_reports,
                project_name=project_names.get(change.project_id),
                category_label=classify_bekendmaking(
                    change.title, change.change_type
                ),
            )
        )

    # Collect read_change_ids for the current user from this page
    read_change_ids: list[str] | None = None
    if change_responses:
        response_change_uuids = [uuid.UUID(c.id) for c in change_responses]
        read_query = select(ChangeReadState.change_id).where(
            ChangeReadState.user_id == user_id,
            ChangeReadState.change_id.in_(response_change_uuids),
        )
        read_result = await db.execute(read_query)
        read_ids = read_result.scalars().all()
        read_change_ids = [str(cid) for cid in read_ids]

    has_more = (offset + limit) < total

    return ChangeRecordListResponse(
        changes=change_responses,
        total=total,
        read_change_ids=read_change_ids,
        has_more=has_more,
    )


async def get_parcel_changes(
    *,
    db: AsyncSession,
    parcel_id: uuid.UUID,
) -> list[ChangeRecordResponse]:
    """Get bekendmakingen matching a specific parcel's postcode."""
    records = await find_changes_for_parcel(parcel_id, db)

    return [
        ChangeRecordResponse(
            id=str(r.id),
            project_id=str(r.project_id),
            change_type=r.change_type,
            external_id=r.external_id,
            title=r.title,
            detected_at=r.detected_at.isoformat(),
            change_date=r.change_date.isoformat(),
            gemeente_naam=r.gemeente_naam,
            address=r.address,
            source_url=r.source_url,
            postcode=r.postcode,
            huisnummer_hint=_extract_huisnummer_from_address(r.address),
            matched_parcel_id=str(r.matched_parcel_id) if r.matched_parcel_id else None,
            category_label=classify_bekendmaking(r.title, r.change_type),
        )
        for r in records
    ]


async def get_unread_counts(
    *,
    db: AsyncSession,
    user_id: uuid.UUID,
) -> UnreadDetailResponse:
    """Get unread change counts for a user."""
    read_subquery = (
        select(ChangeReadState.change_id)
        .where(ChangeReadState.user_id == user_id)
        .subquery()
    )

    query = (
        select(
            ChangeRecord.project_id,
            func.count(ChangeRecord.id).label("unread_count"),
        )
        .outerjoin(
            read_subquery,
            read_subquery.c.change_id == ChangeRecord.id,
        )
        .where(read_subquery.c.change_id.is_(None))
        .group_by(ChangeRecord.project_id)
    )

    result = await db.execute(query)
    rows = result.all()

    per_project_counts: list[ProjectUnreadCount] = []
    total_unread = 0

    for project_id, unread_count in rows:
        if unread_count > 0:
            per_project_counts.append(
                ProjectUnreadCount(
                    project_id=str(project_id),
                    unread_count=unread_count,
                )
            )
            total_unread += unread_count

    return UnreadDetailResponse(
        total_unread=total_unread,
        projects_with_changes=len(per_project_counts),
        per_project=per_project_counts,
    )


async def mark_all_changes_read(
    *,
    db: AsyncSession,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    project_id: uuid.UUID | None,
) -> MarkAllReadResponse | None:
    """Mark all changes as read. Returns None if project_id given but not found."""
    if project_id is not None:
        project_check = select(Project.id).where(
            Project.id == project_id,
            Project.organization_id == organization_id,
        )
        project_result = await db.execute(project_check)
        if project_result.scalar_one_or_none() is None:
            return None  # Signal 404 to caller

    changes_query = select(ChangeRecord.id).where()
    if project_id is not None:
        changes_query = changes_query.where(ChangeRecord.project_id == project_id)

    changes_result = await db.execute(changes_query)
    change_ids = changes_result.scalars().all()

    if not change_ids:
        return MarkAllReadResponse(status="ok", marked_count=0)

    rows = [{"user_id": user_id, "change_id": cid} for cid in change_ids]
    result = await _insert_change_read_rows(
        db=db, rows=rows, organization_id=organization_id
    )
    await db.flush()
    await db.commit()

    marked_count = result.rowcount if result.rowcount >= 0 else len(rows)
    return MarkAllReadResponse(status="ok", marked_count=marked_count)


async def mark_single_change_read(
    *,
    db: AsyncSession,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    change_id: uuid.UUID,
) -> bool:
    """Mark a single change as read. Returns False if change not found."""
    change_query = select(ChangeRecord.id).where(ChangeRecord.id == change_id)
    change_result = await db.execute(change_query)
    if change_result.scalar_one_or_none() is None:
        return False

    await _insert_change_read_rows(
        db=db,
        rows=[{"user_id": user_id, "change_id": change_id}],
        organization_id=organization_id,
    )
    await db.flush()
    await db.commit()
    return True


async def mark_single_change_unread(
    *,
    db: AsyncSession,
    user_id: uuid.UUID,
    change_id: uuid.UUID,
) -> None:
    """Mark a single change as unread by removing the read-state row."""
    stmt = delete(ChangeReadState).where(
        ChangeReadState.user_id == user_id,
        ChangeReadState.change_id == change_id,
    )
    await db.execute(stmt)
    await db.flush()
    await db.commit()
