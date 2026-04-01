"""Project folder business logic (extracted from router, M023/S02/T05)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.report import SavedReport
from app.schemas.project import ProjectResponse


def _project_response(project: Project, report_count: int) -> ProjectResponse:
    """Build ProjectResponse from ORM model + count."""
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        updated_at=project.updated_at,
        report_count=report_count,
        parent_id=str(project.parent_id) if project.parent_id else None,
        gemeente_code=project.gemeente_code,
        wijk_naam=project.wijk_naam,
        is_monitored=project.is_monitored,
    )


def _report_count_subquery():
    """Subquery: count of active (non-deleted) reports per project."""
    return (
        select(func.count(SavedReport.id))
        .where(SavedReport.project_id == Project.id, SavedReport.deleted_at.is_(None))
        .scalar_subquery()
    )


async def create_project(
    name: str,
    description: str | None,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> ProjectResponse:
    """Create a new project folder. Returns ProjectResponse with report_count=0."""
    project = Project(
        organization_id=organization_id,
        name=name,
        description=description,
    )
    session.add(project)
    await session.flush()
    await session.commit()
    return _project_response(project, 0)


async def list_projects(
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> list[ProjectResponse]:
    """List all project folders with report counts."""
    query = (
        select(Project, _report_count_subquery().label("report_count"))
        .where(Project.organization_id == organization_id)
        .order_by(Project.name)
    )
    result = await session.execute(query)
    return [_project_response(p, rc or 0) for p, rc in result.all()]


async def get_project(
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> ProjectResponse | None:
    """Get project details with report count. Returns None if not found."""
    project_result = await session.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == organization_id,
        )
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        return None

    count_result = await session.execute(
        select(func.count(SavedReport.id)).where(
            SavedReport.project_id == project_id,
            SavedReport.deleted_at.is_(None),
        )
    )
    return _project_response(project, count_result.scalar() or 0)


async def update_project(
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    name: str | None,
    description: str | None,
    session: AsyncSession,
) -> ProjectResponse | None:
    """Update project name/description. Returns None if not found."""
    project_result = await session.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == organization_id,
        )
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        return None

    if name is not None:
        project.name = name
    if description is not None:
        project.description = description
    await session.commit()

    count_result = await session.execute(
        select(func.count(SavedReport.id)).where(
            SavedReport.project_id == project_id,
            SavedReport.deleted_at.is_(None),
        )
    )
    return _project_response(project, count_result.scalar() or 0)


async def delete_project(
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> bool:
    """Delete a project. Returns False if not found."""
    project_result = await session.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == organization_id,
        )
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        return False

    await session.delete(project)
    await session.commit()
    return True


async def verify_project_ownership(
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> bool:
    """Check if project exists and belongs to org."""
    result = await session.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == organization_id,
        )
    )
    return result.scalar_one_or_none() is not None
