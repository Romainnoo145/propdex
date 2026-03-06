"""Project folder management API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.project import Project
from app.models.report import SavedReport
from app.models.user import User
from app.scans import service as scan_service
from app.scans.schemas import ScanListItem, ScanListResponse
from app.schemas.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_project(
    request: Request,
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """
    Create a new project folder.

    Projects organize saved reports into named folders. Reports can exist
    without a project (optional grouping).

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        project_data: Project creation data
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ProjectResponse: The created project with report_count=0

    Raises:
        HTTPException 500: Internal server error
    """
    try:
        project = Project(
            organization_id=organization_id,
            name=project_data.name,
            description=project_data.description,
        )

        db.add(project)
        await db.flush()
        await db.commit()

        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            created_at=project.created_at,
            updated_at=project.updated_at,
            report_count=0,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project",
        ) from e


@router.get("", response_model=ProjectListResponse)
@limiter.limit("60/minute")
async def list_projects(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectListResponse:
    """
    List all project folders with report counts.

    Includes count of active (non-deleted) reports per project.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ProjectListResponse: List of projects with report counts

    Raises:
        HTTPException 500: Internal server error
    """
    try:
        # Query projects with report count subquery
        report_count_subquery = (
            select(func.count(SavedReport.id))
            .where(
                SavedReport.project_id == Project.id,
                SavedReport.deleted_at.is_(None),
            )
            .scalar_subquery()
        )

        query = (
            select(
                Project,
                report_count_subquery.label("report_count"),
            )
            .where(Project.organization_id == organization_id)
            .order_by(Project.name)
        )

        result = await db.execute(query)
        rows = result.all()

        projects = [
            ProjectResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                created_at=project.created_at,
                updated_at=project.updated_at,
                report_count=report_count or 0,
                parent_id=str(project.parent_id) if project.parent_id else None,
                gemeente_code=project.gemeente_code,
                wijk_naam=project.wijk_naam,
                is_monitored=project.is_monitored,
            )
            for project, report_count in rows
        ]

        return ProjectListResponse(projects=projects, total=len(projects))

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list projects",
        ) from e


@router.get("/{project_id}", response_model=ProjectResponse)
@limiter.limit("60/minute")
async def get_project(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """
    Get project details with report count.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        project_id: Project ID
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ProjectResponse: Project details with report_count

    Raises:
        HTTPException 404: Project not found
        HTTPException 500: Internal server error
    """
    try:
        # Query project
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

        # Count active reports in this project
        count_query = select(func.count(SavedReport.id)).where(
            SavedReport.project_id == project_id,
            SavedReport.deleted_at.is_(None),
        )
        count_result = await db.execute(count_query)
        report_count = count_result.scalar() or 0

        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            created_at=project.created_at,
            updated_at=project.updated_at,
            report_count=report_count,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get project",
        ) from e


@router.get("/{project_id}/scans", response_model=ScanListResponse)
@limiter.limit("60/minute")
async def list_project_scans(
    request: Request,
    project_id: uuid.UUID,
    offset: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScanListResponse:
    """
    List scans associated with a specific project.

    Returns paginated scans filtered by project_id. First verifies project
    exists and belongs to the authenticated organization (404 if not --
    prevents resource enumeration).

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        project_id: Project UUID
        offset: Pagination offset (default 0)
        limit: Page size (default 50, max 100)
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ScanListResponse: Paginated scan list for this project

    Raises:
        HTTPException 404: Project not found (or belongs to another org)
    """
    limit = min(limit, 100)

    # 1. Verify project exists and belongs to org (404 not 403 -- prevents enumeration)
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

    # 2. List scans filtered by project_id (already org-scoped via service)
    scans, total = await scan_service.list_scans(
        organization_id=organization_id,
        offset=offset,
        limit=limit,
        session=db,
        project_id=project_id,
    )

    scan_items = [
        ScanListItem(
            scan_id=scan.id,
            gemeente_naam=scan.gemeente_naam,
            gemeente_code=scan.gemeente_code,
            wijk_naam=scan.wijk_naam,
            neighborhood_metrics=scan.neighborhood_metrics,
            scan_date=scan.created_at,
            status=scan.status,
            parcel_count=parcel_count or 0,
            project_id=scan.project_id,
        )
        for scan, parcel_count in scans
    ]

    return ScanListResponse(
        scans=scan_items,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
@limiter.limit("30/minute")
async def update_project(
    request: Request,
    project_id: uuid.UUID,
    update_data: ProjectUpdate,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """
    Update project name or description.

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        project_id: Project ID
        update_data: Update data (name and/or description)
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ProjectResponse: The updated project with report_count

    Raises:
        HTTPException 404: Project not found
        HTTPException 500: Internal server error
    """
    try:
        # Query project
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

        # Update fields if provided
        if update_data.name is not None:
            project.name = update_data.name

        if update_data.description is not None:
            project.description = update_data.description

        await db.commit()

        # Count active reports in this project
        count_query = select(func.count(SavedReport.id)).where(
            SavedReport.project_id == project_id,
            SavedReport.deleted_at.is_(None),
        )
        count_result = await db.execute(count_query)
        report_count = count_result.scalar() or 0

        return ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            created_at=project.created_at,
            updated_at=project.updated_at,
            report_count=report_count,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update project",
        ) from e


@router.delete("/{project_id}")
@limiter.limit("30/minute")
async def delete_project(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Delete a project folder.

    Sets all reports' project_id to NULL (FK ondelete=SET NULL handles this).
    Hard delete the project (projects don't need soft-delete).

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        project_id: Project ID
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        dict: Success message with project_id

    Raises:
        HTTPException 404: Project not found
        HTTPException 500: Internal server error
    """
    try:
        # Query project
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

        # Delete project (FK ondelete=SET NULL will handle reports)
        await db.delete(project)
        await db.commit()

        return {"message": "Project deleted", "project_id": str(project_id)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete project",
        ) from e
