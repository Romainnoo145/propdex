"""Report management service layer with CRUD operations."""

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.report import SavedReport
from app.schemas.property import PropertyReportResponse


def active_reports_query(organization_id: uuid.UUID):
    """
    Base query for active (non-deleted) reports filtered by organization_id.

    All list/get operations MUST use this helper to prevent deleted reports from leaking.
    """
    return select(SavedReport).where(
        SavedReport.organization_id == organization_id,
        SavedReport.deleted_at.is_(None),
    )


async def save_report(
    report_data: dict,
    notes: str | None,
    project_id: uuid.UUID | None,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> SavedReport:
    """
    Save a property intelligence report.

    Args:
        report_data: Full PropertyReportResponse dict
        notes: Optional free-text notes
        project_id: Optional project folder ID
        organization_id: Tenant organization ID
        session: Database session

    Returns:
        SavedReport: The created report

    Raises:
        ValueError: If report_data is invalid
        HTTPException: If project_id doesn't exist or doesn't belong to organization
    """
    # Validate report_data by parsing as PropertyReportResponse
    try:
        validated_report = PropertyReportResponse.model_validate(report_data)
    except Exception as e:
        raise ValueError(f"Invalid report_data: {e}") from e

    # Generate report_name from address
    address_data = report_data["address"]
    report_name = f"{address_data['straatnaam']} {address_data['huisnummer']}, {address_data['woonplaats']}"

    # Extract denormalized fields
    postcode = address_data["postcode"]
    city = address_data["woonplaats"]

    # If project_id provided, verify project exists and belongs to same organization
    if project_id is not None:
        project_result = await session.execute(
            select(Project).where(
                Project.id == project_id,
                Project.organization_id == organization_id,
            )
        )
        project = project_result.scalar_one_or_none()
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

    # Store validated dict
    report_data_json = validated_report.model_dump(mode="json")

    # Create SavedReport
    report = SavedReport(
        organization_id=organization_id,
        report_name=report_name,
        report_data=report_data_json,
        postcode=postcode,
        city=city,
        notes=notes,
        project_id=project_id,
    )

    session.add(report)
    await session.flush()
    await session.commit()

    return report


async def list_reports(
    organization_id: uuid.UUID,
    city: str | None,
    project_id: uuid.UUID | None,
    search_query: str | None,
    sort_by: str,
    sort_order: str,
    offset: int,
    limit: int,
    session: AsyncSession,
) -> tuple[list[SavedReport], int]:
    """
    List saved reports with filtering, search, sorting, and pagination.

    Args:
        organization_id: Tenant organization ID
        city: Optional city filter (exact match)
        project_id: Optional project filter (exact match)
        search_query: Optional search query (ILIKE on report_name)
        sort_by: Sort field ("created", "updated", "address")
        sort_order: Sort order ("asc", "desc")
        offset: Pagination offset
        limit: Pagination limit
        session: Database session

    Returns:
        tuple: (list of SavedReport, total count)
    """
    # Start from active reports query
    query = active_reports_query(organization_id)

    # Apply optional filters
    if city is not None:
        query = query.where(SavedReport.city == city)

    if project_id is not None:
        query = query.where(SavedReport.project_id == project_id)

    if search_query is not None:
        query = query.where(SavedReport.report_name.ilike(f"%{search_query}%"))

    # Apply sorting
    sort_field_map = {
        "created": SavedReport.created_at,
        "updated": SavedReport.updated_at,
        "address": SavedReport.report_name,
    }
    sort_field = sort_field_map.get(sort_by, SavedReport.updated_at)

    if sort_order == "asc":
        query = query.order_by(asc(sort_field))
    else:
        query = query.order_by(desc(sort_field))

    # Get total count (before pagination)
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.offset(offset).limit(limit)

    # Execute query
    result = await session.execute(query)
    reports = list(result.scalars().all())

    return reports, total


async def get_report(
    report_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> SavedReport:
    """
    Get a single saved report by ID.

    Args:
        report_id: Report ID
        organization_id: Tenant organization ID
        session: Database session

    Returns:
        SavedReport: The report

    Raises:
        HTTPException: If report not found
    """
    query = active_reports_query(organization_id).where(SavedReport.id == report_id)
    result = await session.execute(query)
    report = result.scalar_one_or_none()

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    return report


async def soft_delete_report(
    report_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> SavedReport:
    """
    Soft-delete a report by setting deleted_at.

    Args:
        report_id: Report ID
        organization_id: Tenant organization ID
        session: Database session

    Returns:
        SavedReport: The deleted report

    Raises:
        HTTPException: If report not found
    """
    report = await get_report(report_id, organization_id, session)
    report.deleted_at = datetime.utcnow()
    await session.commit()
    return report


async def restore_report(
    report_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> SavedReport:
    """
    Restore a soft-deleted report.

    Args:
        report_id: Report ID
        organization_id: Tenant organization ID
        session: Database session

    Returns:
        SavedReport: The restored report

    Raises:
        HTTPException: If report not found
    """
    # Query DELETED reports
    query = select(SavedReport).where(
        SavedReport.organization_id == organization_id,
        SavedReport.id == report_id,
        SavedReport.deleted_at.is_not(None),
    )
    result = await session.execute(query)
    report = result.scalar_one_or_none()

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted report not found",
        )

    report.deleted_at = None
    await session.commit()
    return report


async def update_report_notes(
    report_id: uuid.UUID,
    organization_id: uuid.UUID,
    notes: str | None,
    session: AsyncSession,
) -> SavedReport:
    """
    Update report notes.

    Args:
        report_id: Report ID
        organization_id: Tenant organization ID
        notes: New notes content (None to clear)
        session: Database session

    Returns:
        SavedReport: The updated report

    Raises:
        HTTPException: If report not found
    """
    report = await get_report(report_id, organization_id, session)
    report.notes = notes
    await session.commit()
    return report


async def assign_report_to_project(
    report_id: uuid.UUID,
    organization_id: uuid.UUID,
    project_id: uuid.UUID | None,
    session: AsyncSession,
) -> SavedReport:
    """
    Assign report to a project (or remove from project).

    Args:
        report_id: Report ID
        organization_id: Tenant organization ID
        project_id: Project ID (None to remove from project)
        session: Database session

    Returns:
        SavedReport: The updated report

    Raises:
        HTTPException: If report or project not found
    """
    report = await get_report(report_id, organization_id, session)

    # If project_id provided, verify project exists in same organization
    if project_id is not None:
        project_result = await session.execute(
            select(Project).where(
                Project.id == project_id,
                Project.organization_id == organization_id,
            )
        )
        project = project_result.scalar_one_or_none()
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

    report.project_id = project_id
    await session.commit()
    return report


async def update_report_data(
    report_id: uuid.UUID,
    organization_id: uuid.UUID,
    fresh_data: dict,
    session: AsyncSession,
) -> SavedReport:
    """
    Update report with fresh property data.

    Args:
        report_id: Report ID
        organization_id: Tenant organization ID
        fresh_data: Fresh PropertyReportResponse dict
        session: Database session

    Returns:
        SavedReport: The updated report

    Raises:
        ValueError: If fresh_data is invalid
        HTTPException: If report not found
    """
    # Validate fresh_data as PropertyReportResponse
    try:
        validated_report = PropertyReportResponse.model_validate(fresh_data)
    except Exception as e:
        raise ValueError(f"Invalid fresh_data: {e}") from e

    report = await get_report(report_id, organization_id, session)

    # Update report_data JSONB
    report.report_data = validated_report.model_dump(mode="json")

    # Update denormalized fields
    address_data = fresh_data["address"]
    report.postcode = address_data["postcode"]
    report.city = address_data["woonplaats"]

    # Update report_name
    report.report_name = f"{address_data['straatnaam']} {address_data['huisnummer']}, {address_data['woonplaats']}"

    # Update timestamp
    report.updated_at = datetime.utcnow()

    await session.commit()
    return report


async def get_distinct_cities(
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> list[str]:
    """
    Get list of distinct cities from active reports for filter dropdown.

    Args:
        organization_id: Tenant organization ID
        session: Database session

    Returns:
        list[str]: Sorted list of city names
    """
    query = (
        select(SavedReport.city)
        .where(
            SavedReport.organization_id == organization_id,
            SavedReport.deleted_at.is_(None),
        )
        .distinct()
        .order_by(SavedReport.city)
    )

    result = await session.execute(query)
    cities = [row[0] for row in result.all()]
    return cities
