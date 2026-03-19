"""Change CRUD endpoints for monitoring."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.change_read_state import ChangeReadState
from app.models.change_record import ChangeRecord
from app.models.project import Project
from app.models.user import User
from app.models.user_notification_state import UserNotificationState
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

from datetime import datetime

router = APIRouter(tags=["monitoring"])


@router.get("/changes", response_model=ChangeRecordListResponse)
@limiter.limit("60/minute")
async def get_changes(
    request: Request,
    project_id: uuid.UUID | None = Query(None),
    gemeente_naam: str | None = Query(None),
    include_matches: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ChangeRecordListResponse:
    """
    Get change history, optionally filtered by project.

    When project_id is provided: returns changes for that project and updates
    the user's last_viewed_at (existing behavior).

    When project_id is omitted: returns all organization changes across all
    projects, with project_name included for feed context. No notification
    side-effect (mark-as-viewed stays per-project via POST /viewed/{id}).

    When include_matches=true, each change record with a postcode will include
    matched_parcels and matched_reports from the organization's data.
    """
    try:
        # Per-project path: verify project + mark as viewed
        if project_id is not None:
            project_query = select(Project).where(
                Project.id == project_id,
                Project.organization_id == organization_id,
            )
            project_result = await db.execute(project_query)
            project = project_result.scalar_one_or_none()

            if project is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Project not found",
                )

        # Query change records
        changes_query = (
            select(ChangeRecord)
            .order_by(ChangeRecord.detected_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if project_id is not None:
            changes_query = changes_query.where(
                ChangeRecord.project_id == project_id
            )
        if gemeente_naam is not None:
            changes_query = changes_query.where(
                ChangeRecord.gemeente_naam == gemeente_naam
            )

        changes_result = await db.execute(changes_query)
        changes = changes_result.scalars().all()

        # Count total
        count_query = select(func.count(ChangeRecord.id)).where(
        )
        if project_id is not None:
            count_query = count_query.where(
                ChangeRecord.project_id == project_id
            )
        if gemeente_naam is not None:
            count_query = count_query.where(
                ChangeRecord.gemeente_naam == gemeente_naam
            )
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0

        # Side effect: Update last_viewed_at only for per-project requests
        if project_id is not None:
            notification_query = select(UserNotificationState).where(
                UserNotificationState.user_id == current_user.id,
                UserNotificationState.project_id == project_id,
            )
            notification_result = await db.execute(notification_query)
            notification_state = notification_result.scalar_one_or_none()

            if notification_state is None:
                notification_state = UserNotificationState(
                    user_id=current_user.id,
                    project_id=project_id,
                    last_viewed_at=datetime.utcnow(),
                )
                db.add(notification_state)
            else:
                notification_state.last_viewed_at = datetime.utcnow()

            await db.flush()
            await db.commit()

        # For all-org feed, pre-load project names
        project_names: dict[uuid.UUID, str] = {}
        if project_id is None and changes:
            project_ids = {c.project_id for c in changes}
            names_query = select(Project.id, Project.name).where(
                Project.id.in_(project_ids)
            )
            names_result = await db.execute(names_query)
            project_names = dict(names_result.all())

        # Build response with optional match enrichment
        change_responses: list[ChangeRecordResponse] = []
        for change in changes:
            matched_parcels = None
            matched_reports = None
            components = (change.metadata_json or {}).get("address_components")
            effective_postcode = change.postcode

            if not effective_postcode:
                if isinstance(components, dict) and components.get("postcode"):
                    effective_postcode = str(components["postcode"]).upper().replace(" ", "")
                else:
                    for text_candidate in (
                        change.address,
                        change.title,
                        change.source_url,
                    ):
                        if not text_candidate:
                            continue
                        extracted = extract_postcodes(text_candidate)
                        if extracted:
                            effective_postcode = extracted[0]
                            break

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
            huisnummer_hint = hints_for_ui[1] if hints_for_ui is not None else _extract_huisnummer_from_address(effective_address)

            if include_matches and effective_postcode:
                parcel_matches = await find_matching_parcels(
                    effective_postcode, db
                )
                report_matches = await find_matching_reports(
                    effective_postcode, current_user.id, db
                )
                if parcel_matches:
                    matched_parcels = [MatchedParcel(**m) for m in parcel_matches]
                if report_matches:
                    matched_reports = [MatchedReport(**m) for m in report_matches]

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
                    matched_parcel_id=str(resolved_parcel_id) if resolved_parcel_id else None,
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
                ChangeReadState.user_id == current_user.id,
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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get change history",
        ) from e


@router.get(
    "/changes-for-parcel/{parcel_id}",
    response_model=list[ChangeRecordResponse],
)
@limiter.limit("60/minute")
async def get_changes_for_parcel(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> list[ChangeRecordResponse]:
    """
    Get bekendmakingen matching a specific parcel's postcode.

    Extracts postcode from the parcel's address and finds ChangeRecords
    with the same postcode. Multi-tenant isolated.
    """
    try:
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

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get changes for parcel",
        ) from e


@router.get("/unread", response_model=UnreadDetailResponse)
@limiter.limit("120/minute")
async def get_unread(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> UnreadDetailResponse:
    """
    Get unread change counts for current user.

    Returns total unread count and per-project breakdown.
    """
    try:
        # Per-change read state: a change is unread if NO matching row exists
        # in change_read_states for (user_id, change_id).
        # LEFT JOIN against change_read_states; crs.id IS NULL means unread.
        read_subquery = (
            select(ChangeReadState.change_id)
            .where(ChangeReadState.user_id == current_user.id)
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
            .where(
                read_subquery.c.change_id.is_(None),
            )
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

        projects_with_changes = len(per_project_counts)

        return UnreadDetailResponse(
            total_unread=total_unread,
            projects_with_changes=projects_with_changes,
            per_project=per_project_counts,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get unread counts",
        ) from e


@router.post("/changes/read-all", response_model=MarkAllReadResponse)
@limiter.limit("30/minute")
async def mark_all_read(
    request: Request,
    project_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> MarkAllReadResponse:
    """
    Mark all changes as read for the current user.

    If project_id is provided: marks all changes for that project as read.
    If project_id is omitted: marks all changes across the organization as read.

    Uses ON CONFLICT DO NOTHING for idempotency (safe to call multiple times).
    """
    try:
        changes_query = select(ChangeRecord.id).where(
        )
        if project_id is not None:
            # Verify project belongs to organization
            project_check = select(Project.id).where(
                Project.id == project_id,
                Project.organization_id == organization_id,
            )
            project_result = await db.execute(project_check)
            if project_result.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Project not found",
                )
            changes_query = changes_query.where(
                ChangeRecord.project_id == project_id
            )

        changes_result = await db.execute(changes_query)
        change_ids = changes_result.scalars().all()

        if not change_ids:
            return MarkAllReadResponse(status="ok", marked_count=0)

        # Bulk insert with ON CONFLICT DO NOTHING for idempotency
        rows = [
            {
                "user_id": current_user.id,
                "change_id": cid,
            }
            for cid in change_ids
        ]
        stmt = pg_insert(ChangeReadState).values(rows).on_conflict_do_nothing(
            index_elements=None,
            constraint="uq_change_read_states_user_change",
        )
        result = await db.execute(stmt)
        await db.flush()
        await db.commit()

        marked_count = result.rowcount if result.rowcount >= 0 else len(rows)

        return MarkAllReadResponse(status="ok", marked_count=marked_count)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark all changes as read",
        ) from e


@router.post("/changes/{change_id}/read")
@limiter.limit("60/minute")
async def mark_change_read(
    request: Request,
    change_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Mark a single change as read for the current user.

    Idempotent: safe to call multiple times (ON CONFLICT DO NOTHING).
    """
    try:
        change_query = select(ChangeRecord.id).where(
            ChangeRecord.id == change_id,
        )
        change_result = await db.execute(change_query)
        if change_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Change not found",
            )

        stmt = (
            pg_insert(ChangeReadState)
            .values(
                user_id=current_user.id,
                change_id=change_id,
            )
            .on_conflict_do_nothing(
                constraint="uq_change_read_states_user_change",
            )
        )
        await db.execute(stmt)
        await db.flush()
        await db.commit()

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark change as read",
        ) from e


@router.delete("/changes/{change_id}/read")
@limiter.limit("60/minute")
async def mark_change_unread(
    request: Request,
    change_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Mark a single change as unread for the current user.

    Removes the ChangeReadState row if it exists. Idempotent (no error if not found).
    """
    try:
        from sqlalchemy import delete

        stmt = delete(ChangeReadState).where(
            ChangeReadState.user_id == current_user.id,
            ChangeReadState.change_id == change_id,
        )
        await db.execute(stmt)
        await db.flush()
        await db.commit()

        return {"status": "ok"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark change as unread",
        ) from e
