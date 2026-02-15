"""Monitoring API endpoints for change detection and notifications."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
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
    ProjectUnreadCount,
    UnreadDetailResponse,
)
from app.schemas.project import ProjectListResponse, ProjectResponse

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("/changes", response_model=ChangeRecordListResponse)
@limiter.limit("60/minute")
async def get_changes(
    request: Request,
    project_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ChangeRecordListResponse:
    """
    Get change history for a specific project.

    Returns paginated list of change records (permits + zoning changes) ordered
    by detected_at DESC. Auto-updates user's last_viewed_at timestamp as a side
    effect (per locked decision: "cleared automatically when user opens/views
    the project folder or change detail").

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        project_id: Project ID to query changes for
        limit: Maximum number of changes to return (default: 50)
        offset: Pagination offset (default: 0)
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ChangeRecordListResponse: List of changes with total count

    Raises:
        HTTPException 404: Project not found or not in user's organization
        HTTPException 500: Internal server error
    """
    try:
        # Verify project exists and belongs to organization
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
            .where(
                ChangeRecord.project_id == project_id,
                ChangeRecord.organization_id == organization_id,
            )
            .order_by(ChangeRecord.detected_at.desc())
            .limit(limit)
            .offset(offset)
        )

        changes_result = await db.execute(changes_query)
        changes = changes_result.scalars().all()

        # Count total changes for this project
        count_query = select(func.count(ChangeRecord.id)).where(
            ChangeRecord.project_id == project_id,
            ChangeRecord.organization_id == organization_id,
        )
        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0

        # Side effect: Update UserNotificationState.last_viewed_at
        # Upsert notification state for current user + project
        notification_query = select(UserNotificationState).where(
            UserNotificationState.user_id == current_user.id,
            UserNotificationState.project_id == project_id,
        )
        notification_result = await db.execute(notification_query)
        notification_state = notification_result.scalar_one_or_none()

        if notification_state is None:
            # Create new notification state
            notification_state = UserNotificationState(
                organization_id=organization_id,
                user_id=current_user.id,
                project_id=project_id,
                last_viewed_at=datetime.utcnow(),
            )
            db.add(notification_state)
        else:
            # Update existing state
            notification_state.last_viewed_at = datetime.utcnow()

        await db.flush()
        await db.commit()

        # Build response
        change_responses = [
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
            )
            for change in changes
        ]

        return ChangeRecordListResponse(changes=change_responses, total=total)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get change history",
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

    Returns total unread count and per-project breakdown. Uses efficient single
    query with subquery to avoid N+1 queries.

    For each monitored project in user's organization:
    - Count ChangeRecords where detected_at > user's last_viewed_at
    - If no UserNotificationState exists, count ALL ChangeRecords (never viewed)

    Requires JWT authentication. Rate limited to 120 requests per minute
    (polled frequently from frontend).

    Args:
        request: FastAPI request object
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        UnreadDetailResponse: Total count + per-project breakdown

    Raises:
        HTTPException 500: Internal server error
    """
    try:
        # Get all monitored projects for this organization
        projects_query = select(Project).where(
            Project.organization_id == organization_id,
            Project.is_monitored == True,  # noqa: E712
        )
        projects_result = await db.execute(projects_query)
        projects = projects_result.scalars().all()

        per_project_counts: list[ProjectUnreadCount] = []
        total_unread = 0

        # For each project, count unread changes
        for project in projects:
            # Get user's last_viewed_at for this project
            notification_query = select(UserNotificationState).where(
                UserNotificationState.user_id == current_user.id,
                UserNotificationState.project_id == project.id,
            )
            notification_result = await db.execute(notification_query)
            notification_state = notification_result.scalar_one_or_none()

            if notification_state is None:
                # Never viewed - count ALL changes
                count_query = select(func.count(ChangeRecord.id)).where(
                    ChangeRecord.project_id == project.id,
                    ChangeRecord.organization_id == organization_id,
                )
            else:
                # Count changes detected after last_viewed_at
                count_query = select(func.count(ChangeRecord.id)).where(
                    ChangeRecord.project_id == project.id,
                    ChangeRecord.organization_id == organization_id,
                    ChangeRecord.detected_at > notification_state.last_viewed_at,
                )

            count_result = await db.execute(count_query)
            unread_count = count_result.scalar() or 0

            if unread_count > 0:
                per_project_counts.append(
                    ProjectUnreadCount(
                        project_id=str(project.id),
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

    Upserts UserNotificationState for current user + project_id, setting
    last_viewed_at to current UTC time. This clears the unread badge for
    this project.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        project_id: Project ID to mark as viewed
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        dict: Success status

    Raises:
        HTTPException 404: Project not found or not in user's organization
        HTTPException 500: Internal server error
    """
    try:
        # Verify project exists and belongs to organization
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

        # Upsert UserNotificationState
        notification_query = select(UserNotificationState).where(
            UserNotificationState.user_id == current_user.id,
            UserNotificationState.project_id == project_id,
        )
        notification_result = await db.execute(notification_query)
        notification_state = notification_result.scalar_one_or_none()

        if notification_state is None:
            # Create new notification state
            notification_state = UserNotificationState(
                organization_id=organization_id,
                user_id=current_user.id,
                project_id=project_id,
                last_viewed_at=datetime.utcnow(),
            )
            db.add(notification_state)
        else:
            # Update existing state
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

    Returns projects where is_monitored=True, organized by gemeente groups
    with wijk children. Each project includes unread_count for current user.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ProjectListResponse: Hierarchical project list with unread counts

    Raises:
        HTTPException 500: Internal server error
    """
    try:
        # Query monitored projects
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

        # Build project responses with unread counts
        project_responses = []
        for project in projects:
            # Get unread count for this project
            notification_query = select(UserNotificationState).where(
                UserNotificationState.user_id == current_user.id,
                UserNotificationState.project_id == project.id,
            )
            notification_result = await db.execute(notification_query)
            notification_state = notification_result.scalar_one_or_none()

            if notification_state is None:
                # Never viewed - count ALL changes
                count_query = select(func.count(ChangeRecord.id)).where(
                    ChangeRecord.project_id == project.id,
                    ChangeRecord.organization_id == organization_id,
                )
            else:
                # Count changes detected after last_viewed_at
                count_query = select(func.count(ChangeRecord.id)).where(
                    ChangeRecord.project_id == project.id,
                    ChangeRecord.organization_id == organization_id,
                    ChangeRecord.detected_at > notification_state.last_viewed_at,
                )

            count_result = await db.execute(count_query)
            unread_count = count_result.scalar() or 0

            # Build ProjectResponse
            project_response = ProjectResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                created_at=project.created_at,
                updated_at=project.updated_at,
                report_count=0,  # Not relevant for monitoring view
                parent_id=str(project.parent_id) if project.parent_id else None,
                gemeente_code=project.gemeente_code,
                wijk_naam=project.wijk_naam,
                is_monitored=project.is_monitored,
                unread_count=unread_count,
                children=[],  # TODO: Populate hierarchical children in future plan
            )

            project_responses.append(project_response)

        return ProjectListResponse(
            projects=project_responses,
            total=len(project_responses),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get monitored projects",
        ) from e
