"""Monitoring API endpoints for change detection and notifications."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.change_record import ChangeRecord
from app.models.project import Project
from app.models.user import User
from app.models.user_notification_state import UserNotificationState
from app.schemas.monitoring import (
    ChangeRecordListResponse,
    ChangeRecordResponse,
    MatchedParcel,
    MatchedReport,
    ProjectUnreadCount,
    UnreadDetailResponse,
)
from app.schemas.project import ProjectListResponse, ProjectResponse
from app.services.bekendmaking_matcher import (
    find_changes_for_parcel,
    find_matching_parcels,
    find_matching_reports,
)
from app.services.category_classifier import classify_bekendmaking

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("/changes", response_model=ChangeRecordListResponse)
@limiter.limit("60/minute")
async def get_changes(
    request: Request,
    project_id: uuid.UUID | None = Query(None),
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
            .where(ChangeRecord.organization_id == organization_id)
            .order_by(ChangeRecord.detected_at.desc())
            .limit(limit)
            .offset(offset)
        )
        if project_id is not None:
            changes_query = changes_query.where(
                ChangeRecord.project_id == project_id
            )

        changes_result = await db.execute(changes_query)
        changes = changes_result.scalars().all()

        # Count total
        count_query = select(func.count(ChangeRecord.id)).where(
            ChangeRecord.organization_id == organization_id,
        )
        if project_id is not None:
            count_query = count_query.where(
                ChangeRecord.project_id == project_id
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
                    organization_id=organization_id,
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

            if include_matches and change.postcode:
                parcel_matches = await find_matching_parcels(
                    change.postcode, organization_id, db
                )
                report_matches = await find_matching_reports(
                    change.postcode, organization_id, db
                )
                if parcel_matches:
                    matched_parcels = [
                        MatchedParcel(**m) for m in parcel_matches
                    ]
                if report_matches:
                    matched_reports = [
                        MatchedReport(**m) for m in report_matches
                    ]

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
                    address=change.address,
                    source_url=change.source_url,
                    postcode=change.postcode,
                    matched_parcel_id=str(change.matched_parcel_id) if change.matched_parcel_id else None,
                    matched_parcels=matched_parcels,
                    matched_reports=matched_reports,
                    project_name=project_names.get(change.project_id),
                    category_label=classify_bekendmaking(
                        change.title, change.change_type
                    ),
                )
            )

        return ChangeRecordListResponse(changes=change_responses, total=total)

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
        records = await find_changes_for_parcel(parcel_id, organization_id, db)

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
        notification_subquery = (
            select(
                UserNotificationState.project_id,
                UserNotificationState.last_viewed_at,
            )
            .where(UserNotificationState.user_id == current_user.id)
            .subquery()
        )

        from sqlalchemy import case

        unread_count_expr = func.count(
            case(
                (
                    notification_subquery.c.last_viewed_at.is_(None),
                    ChangeRecord.id,
                ),
                (
                    ChangeRecord.detected_at > notification_subquery.c.last_viewed_at,
                    ChangeRecord.id,
                ),
                else_=None,
            )
        )

        query = (
            select(
                Project.id,
                unread_count_expr.label("unread_count"),
            )
            .select_from(Project)
            .outerjoin(
                ChangeRecord,
                (ChangeRecord.project_id == Project.id)
                & (ChangeRecord.organization_id == organization_id),
            )
            .outerjoin(
                notification_subquery,
                notification_subquery.c.project_id == Project.id,
            )
            .where(
                Project.organization_id == organization_id,
                Project.is_monitored == True,  # noqa: E712
            )
            .group_by(Project.id)
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


@router.post("/viewed/{project_id}")
@limiter.limit("60/minute")
async def mark_viewed(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Mark a project as viewed by the current user.

    Upserts UserNotificationState, clearing the unread badge.
    """
    try:
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

        notification_query = select(UserNotificationState).where(
            UserNotificationState.user_id == current_user.id,
            UserNotificationState.project_id == project_id,
        )
        notification_result = await db.execute(notification_query)
        notification_state = notification_result.scalar_one_or_none()

        if notification_state is None:
            notification_state = UserNotificationState(
                organization_id=organization_id,
                user_id=current_user.id,
                project_id=project_id,
                last_viewed_at=datetime.utcnow(),
            )
            db.add(notification_state)
        else:
            notification_state.last_viewed_at = datetime.utcnow()

        await db.flush()
        await db.commit()

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark project as viewed",
        ) from e


@router.get("/projects", response_model=ProjectListResponse)
@limiter.limit("60/minute")
async def get_monitored_projects(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectListResponse:
    """
    Get hierarchical list of monitored projects with unread counts.
    """
    try:
        projects_query = (
            select(Project)
            .where(
                Project.organization_id == organization_id,
                Project.is_monitored == True,  # noqa: E712
            )
            .order_by(Project.name)
        )
        projects_result = await db.execute(projects_query)
        projects = projects_result.scalars().all()

        project_responses = []
        for project in projects:
            notification_query = select(UserNotificationState).where(
                UserNotificationState.user_id == current_user.id,
                UserNotificationState.project_id == project.id,
            )
            notification_result = await db.execute(notification_query)
            notification_state = notification_result.scalar_one_or_none()

            if notification_state is None:
                count_query = select(func.count(ChangeRecord.id)).where(
                    ChangeRecord.project_id == project.id,
                    ChangeRecord.organization_id == organization_id,
                )
            else:
                count_query = select(func.count(ChangeRecord.id)).where(
                    ChangeRecord.project_id == project.id,
                    ChangeRecord.organization_id == organization_id,
                    ChangeRecord.detected_at > notification_state.last_viewed_at,
                )

            count_result = await db.execute(count_query)
            unread_count = count_result.scalar() or 0

            project_response = ProjectResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                created_at=project.created_at,
                updated_at=project.updated_at,
                report_count=0,
                parent_id=str(project.parent_id) if project.parent_id else None,
                gemeente_code=project.gemeente_code,
                wijk_naam=project.wijk_naam,
                is_monitored=project.is_monitored,
                unread_count=unread_count,
                children=[],
            )

            project_responses.append(project_response)

        children_by_parent: dict[uuid.UUID, list[ProjectResponse]] = {}
        root_projects: list[ProjectResponse] = []

        for proj_resp in project_responses:
            if proj_resp.parent_id is not None:
                parent_uuid = uuid.UUID(proj_resp.parent_id)
                children_by_parent.setdefault(parent_uuid, []).append(proj_resp)
            else:
                root_projects.append(proj_resp)

        for root in root_projects:
            root.children = children_by_parent.get(root.id, [])

        return ProjectListResponse(
            projects=root_projects,
            total=len(root_projects),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get monitored projects",
        ) from e
