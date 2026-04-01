"""Project folder management API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.projects import projects_service as svc
from app.scans import service as scan_service
from app.scans.schemas import ScanListResponse
from app.schemas.common import MessageResponse
from app.schemas.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_project(
    request: Request,
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Create a new project folder."""
    try:
        return await svc.create_project(project_data.name, project_data.description, organization_id, db)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create project") from e


@router.get("", response_model=ProjectListResponse)
@limiter.limit("60/minute")
async def list_projects(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectListResponse:
    """List all project folders with report counts."""
    try:
        projects = await svc.list_projects(organization_id, db)
        return ProjectListResponse(projects=projects, total=len(projects))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list projects") from e


@router.get("/{project_id}", response_model=ProjectResponse)
@limiter.limit("60/minute")
async def get_project(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Get project details with report count."""
    try:
        result = await svc.get_project(project_id, organization_id, db)
        if result is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get project") from e


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
    """List scans associated with a specific project."""
    limit = min(limit, 100)

    if not await svc.verify_project_ownership(project_id, organization_id, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    scans, total = await scan_service.list_scans(
        offset=offset, limit=limit, session=db, project_id=project_id,
    )
    return ScanListResponse(
        scans=scan_service.build_scan_list_items(scans),
        total=total, offset=offset, limit=limit,
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
    """Update project name or description."""
    try:
        result = await svc.update_project(project_id, organization_id, update_data.name, update_data.description, db)
        if result is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update project") from e


@router.delete("/{project_id}", response_model=MessageResponse)
@limiter.limit("30/minute")
async def delete_project(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete a project folder."""
    try:
        if not await svc.delete_project(project_id, organization_id, db):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        return {"message": "Project deleted", "id": str(project_id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete project") from e
