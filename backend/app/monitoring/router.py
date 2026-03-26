"""Monitoring API endpoints for change detection and notifications."""

import logging
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
from app.schemas.project import ProjectListResponse, ProjectResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


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
                )
            else:
                count_query = select(func.count(ChangeRecord.id)).where(
                    ChangeRecord.project_id == project.id,
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


# Include sub-routers (no prefix — routes already include their paths)
from app.monitoring.changes_router import router as changes_router  # noqa: E402
from app.monitoring.subscriptions_router import router as subscriptions_router  # noqa: E402

router.include_router(changes_router)
router.include_router(subscriptions_router)
