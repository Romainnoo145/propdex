"""Report management service layer with CRUD operations."""

import asyncio
import io
import logging
import re
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import asc, desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.area_scan import AreaScan
from app.models.generated_dossier import GeneratedDossier
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.schemas.address import AddressInput
from app.schemas.property import CadastralParcel, PropertyReportResponse
from app.services.property_aggregator import aggregate_property_data, fetch_brk_ownership

logger = logging.getLogger(__name__)


def active_reports_query(user_id: uuid.UUID):
    """
    Base query for active (non-deleted) reports filtered by user_id.

    All list/get operations MUST use this helper to prevent deleted reports from leaking.
    """
    return select(SavedReport).where(
        SavedReport.user_id == user_id,
        SavedReport.deleted_at.is_(None),
    )


def _normalize_location_value(value: str | None) -> str | None:
    """Normalize optional location labels (strip + empty to None)."""
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _location_key(value: str | None) -> str:
    """Case-insensitive comparison key for location labels."""
    if not value:
        return ""
    return " ".join(value.lower().split())


def _infer_gemeente_code_from_report_data(report_data: dict) -> str | None:
    """
    Infer CBS municipality code from BAG object IDs in report payload.

    BAG IDs start with the 4-digit municipality code (e.g., 1507... -> GM1507).
    """
    address_data = report_data.get("address")
    if not isinstance(address_data, dict):
        return None

    for key in ("verblijfsobject_id", "nummeraanduiding_id", "pand_id"):
        raw_value = address_data.get(key)
        if raw_value is None:
            continue
        match = re.match(r"^\s*(\d{4})", str(raw_value))
        if not match:
            continue
        return f"GM{match.group(1)}"

    return None


async def _find_existing_gemeente_project_by_code(
    organization_id: uuid.UUID,
    gemeente_code: str,
    session: AsyncSession,
) -> Project | None:
    """Return existing top-level gemeente project for a CBS code."""
    project_result = await session.execute(
        select(Project)
        .where(
            Project.organization_id == organization_id,
            Project.parent_id.is_(None),
            Project.gemeente_code == gemeente_code,
        )
        .limit(1)
    )
    return project_result.scalar_one_or_none()


async def _resolve_report_location_context(
    organization_id: uuid.UUID,
    report_data: dict,
    city: str,
    session: AsyncSession,
) -> tuple[str, str | None, str | None]:
    """
    Resolve gemeente/wijk context from report payload without parcel context.

    Safety rule:
    - Only trust inferred gemeente_code when a gemeente project with that code
      already exists in this org (prevents creating wrong municipality folders
      from woonplaats labels).
    """
    gemeente_naam = city
    wijk_naam = None
    gemeente_code = None

    inferred_code = _infer_gemeente_code_from_report_data(report_data)
    if inferred_code is None:
        return gemeente_naam, gemeente_code, wijk_naam

    existing_gemeente = await _find_existing_gemeente_project_by_code(
        organization_id=organization_id,
        gemeente_code=inferred_code,
        session=session,
    )
    if existing_gemeente is None:
        return gemeente_naam, gemeente_code, wijk_naam

    gemeente_naam = existing_gemeente.name
    gemeente_code = inferred_code
    if _location_key(city) != _location_key(existing_gemeente.name):
        wijk_naam = city

    return gemeente_naam, gemeente_code, wijk_naam


async def _get_or_create_project_for_location(
    organization_id: uuid.UUID,
    gemeente_naam: str | None,
    gemeente_code: str | None,
    wijk_naam: str | None,
    session: AsyncSession,
) -> uuid.UUID:
    """
    Ensure a gemeente/wijk project folder exists and return its ID.

    Hierarchy:
    - parent project: gemeente
    - child project: wijk (optional)
    """
    normalized_gemeente_naam = _normalize_location_value(gemeente_naam)
    normalized_gemeente_code = _normalize_location_value(gemeente_code)
    normalized_wijk_naam = _normalize_location_value(wijk_naam)

    # Always keep a deterministic fallback folder for reports with incomplete location data.
    if normalized_gemeente_naam is None:
        normalized_gemeente_naam = (
            f"Gemeente {normalized_gemeente_code}"
            if normalized_gemeente_code
            else "Onbekende gemeente"
        )

    gemeente_project = None

    # Prefer exact gemeente_code match when available.
    if normalized_gemeente_code is not None:
        gemeente_by_code_result = await session.execute(
            select(Project)
            .where(
                Project.organization_id == organization_id,
                Project.parent_id.is_(None),
                Project.gemeente_code == normalized_gemeente_code,
            )
            .limit(1)
        )
        gemeente_project = gemeente_by_code_result.scalar_one_or_none()

    # Fallback to case-insensitive gemeente name match.
    if gemeente_project is None:
        gemeente_by_name_result = await session.execute(
            select(Project)
            .where(
                Project.organization_id == organization_id,
                Project.parent_id.is_(None),
                func.lower(Project.name) == normalized_gemeente_naam.lower(),
            )
            .limit(1)
        )
        gemeente_project = gemeente_by_name_result.scalar_one_or_none()

    if gemeente_project is None:
        gemeente_project = Project(
            organization_id=organization_id,
            name=normalized_gemeente_naam,
            gemeente_code=normalized_gemeente_code,
            is_monitored=normalized_gemeente_code is not None,
        )
        session.add(gemeente_project)
        await session.flush()
    else:
        # Fill missing metadata on older folders when we now have better context.
        if normalized_gemeente_code and not gemeente_project.gemeente_code:
            gemeente_project.gemeente_code = normalized_gemeente_code

    if normalized_wijk_naam is None:
        return gemeente_project.id

    wijk_result = await session.execute(
        select(Project)
        .where(
            Project.organization_id == organization_id,
            Project.parent_id == gemeente_project.id,
            func.lower(Project.name) == normalized_wijk_naam.lower(),
        )
        .limit(1)
    )
    wijk_project = wijk_result.scalar_one_or_none()

    if wijk_project is None:
        wijk_project = Project(
            organization_id=organization_id,
            name=normalized_wijk_naam,
            parent_id=gemeente_project.id,
            gemeente_code=normalized_gemeente_code,
            wijk_naam=normalized_wijk_naam,
            is_monitored=normalized_gemeente_code is not None,
        )
        session.add(wijk_project)
        await session.flush()
    else:
        if normalized_gemeente_code and not wijk_project.gemeente_code:
            wijk_project.gemeente_code = normalized_gemeente_code
        if not wijk_project.wijk_naam:
            wijk_project.wijk_naam = normalized_wijk_naam

    return wijk_project.id


async def _resolve_location_context_from_parcel(
    organization_id: uuid.UUID,
    parcel_id: uuid.UUID,
    default_gemeente_naam: str,
    session: AsyncSession,
) -> tuple[str, str | None, str | None]:
    """
    Resolve best-known gemeente/wijk context for a parcel.

    Priority:
    1. Latest scan result context (gemeente + wijk)
    2. ParcelCache.gemeente_code
    3. Report address city as municipality display name
    """
    resolved_gemeente_naam = default_gemeente_naam
    resolved_gemeente_code = None
    resolved_wijk_naam = None

    scan_context_result = await session.execute(
        select(
            AreaScan.gemeente_naam,
            AreaScan.gemeente_code,
            AreaScan.wijk_naam,
        )
        .join(ScanResult, ScanResult.scan_id == AreaScan.id)
        .where(
            ScanResult.parcel_id == parcel_id,
        )
        .order_by(ScanResult.created_at.desc())
        .limit(1)
    )
    scan_context = scan_context_result.one_or_none()
    if scan_context is not None:
        resolved_gemeente_naam = (
            _normalize_location_value(scan_context.gemeente_naam) or resolved_gemeente_naam
        )
        resolved_gemeente_code = _normalize_location_value(scan_context.gemeente_code)
        resolved_wijk_naam = _normalize_location_value(scan_context.wijk_naam)

    if resolved_gemeente_code is None:
        parcel_code_result = await session.execute(
            select(ParcelCache.gemeente_code).where(
                ParcelCache.id == parcel_id,
            )
        )
        parcel_gemeente_code = parcel_code_result.scalar_one_or_none()
        resolved_gemeente_code = _normalize_location_value(parcel_gemeente_code)

    return resolved_gemeente_naam, resolved_gemeente_code, resolved_wijk_naam


async def _backfill_unassigned_reports(
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    """Backfill legacy reports without project_id to gemeente folders."""
    unassigned_result = await session.execute(
        select(SavedReport).where(
            SavedReport.user_id == user_id,
            SavedReport.deleted_at.is_(None),
            SavedReport.project_id.is_(None),
        )
    )
    unassigned_reports = list(unassigned_result.scalars().all())
    if not unassigned_reports:
        return

    for report in unassigned_reports:
        gemeente_naam, gemeente_code, wijk_naam = await _resolve_report_location_context(
            organization_id=organization_id,
            report_data=report.report_data,
            city=report.city,
            session=session,
        )
        report.project_id = await _get_or_create_project_for_location(
            organization_id=organization_id,
            gemeente_naam=gemeente_naam,
            gemeente_code=gemeente_code,
            wijk_naam=wijk_naam,
            session=session,
        )

    await session.commit()


async def _collect_project_scope_ids(
    organization_id: uuid.UUID,
    root_project_id: uuid.UUID,
    session: AsyncSession,
) -> list[uuid.UUID]:
    """
    Collect project filter scope as root project + all descendants.

    Rapporten filter uses top-level gemeente folders in the UI. Reports are often
    stored under child wijk folders, so parent-only filtering would return empty
    results. This helper expands scope recursively.
    """
    scope_ids: set[uuid.UUID] = {root_project_id}
    frontier: set[uuid.UUID] = {root_project_id}

    while frontier:
        child_rows = await session.execute(
            select(Project.id).where(
                Project.organization_id == organization_id,
                Project.parent_id.in_(tuple(frontier)),
            )
        )
        child_ids = set(child_rows.scalars().all())
        next_frontier = child_ids - scope_ids
        if not next_frontier:
            break
        scope_ids.update(next_frontier)
        frontier = next_frontier

    return list(scope_ids)


async def save_report(
    report_data: dict,
    notes: str | None,
    project_id: uuid.UUID | None,
    user_id: uuid.UUID,
    organization_id: uuid.UUID | None = None,
    session: AsyncSession = None,
    parcel_id: uuid.UUID | None = None,
    return_status: bool = False,
) -> SavedReport | tuple[SavedReport, bool]:
    """
    Save a property intelligence report.

    Args:
        report_data: Full PropertyReportResponse dict
        notes: Optional free-text notes
        project_id: Optional project folder ID
        user_id: Owner user ID
        organization_id: Organization ID (for project resolution)
        session: Database session
        parcel_id: Optional ParcelCache ID (used to resolve wijk context)

    Returns:
        SavedReport by default.
        If return_status=True, returns (SavedReport, created_bool).

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
    report_name = f"{address_data.get('straat', address_data.get('straatnaam', 'Onbekend'))} {address_data['huisnummer']}, {address_data['woonplaats']}"

    # Extract denormalized fields
    postcode = address_data["postcode"]
    city = address_data["woonplaats"]

    resolved_project_id = project_id

    # If project_id provided, verify project exists and belongs to same organization.
    if resolved_project_id is not None:
        project_result = await session.execute(
            select(Project).where(
                Project.id == resolved_project_id,
                Project.organization_id == organization_id,
            )
        )
        project = project_result.scalar_one_or_none()
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

    # Idempotency guard: one active report per source parcel per organization.
    # Prevents duplicate report generation on repeated "Genereer rapport" clicks.
    if parcel_id is not None:
        existing_for_parcel = await get_report_by_source_parcel(
            parcel_id=parcel_id,
            user_id=user_id,
            session=session,
        )
        if existing_for_parcel is not None:
            if (
                resolved_project_id is not None
                and existing_for_parcel.project_id != resolved_project_id
            ):
                existing_for_parcel.project_id = resolved_project_id
                await session.commit()
            if notes is not None and existing_for_parcel.notes != notes:
                existing_for_parcel.notes = notes
                await session.commit()
            if return_status:
                return existing_for_parcel, False
            return existing_for_parcel
    if resolved_project_id is None:
        if parcel_id is not None:
            gemeente_naam, gemeente_code, wijk_naam = await _resolve_location_context_from_parcel(
                organization_id=organization_id,
                parcel_id=parcel_id,
                default_gemeente_naam=city,
                session=session,
            )
        else:
            gemeente_naam, gemeente_code, wijk_naam = await _resolve_report_location_context(
                organization_id=organization_id,
                report_data=report_data,
                city=city,
                session=session,
            )

        resolved_project_id = await _get_or_create_project_for_location(
            organization_id=organization_id,
            gemeente_naam=gemeente_naam,
            gemeente_code=gemeente_code,
            wijk_naam=wijk_naam,
            session=session,
        )

    # Store validated dict
    report_data_json = validated_report.model_dump(mode="json")
    # BRK eigendomsdata MUST be stripped before JSONB persist (Kadaster Tier 3 never-store terms).
    # See: app/schemas/brk_ownership.py (never_cache = True)
    report_data_json.pop("brk_ownership", None)

    # Create SavedReport
    report = SavedReport(
        user_id=user_id,
        report_name=report_name,
        report_data=report_data_json,
        postcode=postcode,
        city=city,
        notes=notes,
        project_id=resolved_project_id,
        source_parcel_id=parcel_id,
    )

    session.add(report)
    try:
        await session.flush()
        await session.commit()
    except IntegrityError as e:
        # Race-safe idempotency fallback for concurrent from-parcel requests.
        await session.rollback()
        if parcel_id is not None:
            existing_for_parcel = await get_report_by_source_parcel(
                parcel_id=parcel_id,
                user_id=user_id,
                session=session,
            )
            if existing_for_parcel is not None:
                if return_status:
                    return existing_for_parcel, False
                return existing_for_parcel
        raise e

    if return_status:
        return report, True
    return report


async def get_report_by_source_parcel(
    parcel_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession,
) -> SavedReport | None:
    """
    Return active report linked to a source parcel for this user.
    """
    result = await session.execute(
        select(SavedReport)
        .where(
            SavedReport.user_id == user_id,
            SavedReport.source_parcel_id == parcel_id,
            SavedReport.deleted_at.is_(None),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_reports(
    user_id: uuid.UUID,
    organization_id: uuid.UUID | None = None,
    city: str | None = None,
    project_id: uuid.UUID | None = None,
    search_query: str | None = None,
    sort_by: str = "updated",
    sort_order: str = "desc",
    offset: int = 0,
    limit: int = 50,
    session: AsyncSession | None = None,
) -> tuple[list[SavedReport], int]:
    """
    List saved reports with filtering, search, sorting, and pagination.

    Args:
        user_id: Owner user ID
        organization_id: Organization ID (for project scope queries)
        city: Optional city filter (exact match)
        project_id: Optional project filter (selected project + descendants)
        search_query: Optional search query (ILIKE on report_name)
        sort_by: Sort field ("created", "updated", "address")
        sort_order: Sort order ("asc", "desc")
        offset: Pagination offset
        limit: Pagination limit
        session: Database session

    Returns:
        tuple: (list of SavedReport, total count)
    """
    # One-time safety pass: ensure legacy data is also folder-linked.
    if organization_id is not None:
        await _backfill_unassigned_reports(user_id=user_id, organization_id=organization_id, session=session)

    # Start from active reports query
    query = active_reports_query(user_id)

    # Apply optional filters
    if city is not None:
        query = query.where(SavedReport.city == city)

    if project_id is not None and organization_id is not None:
        scoped_project_ids = await _collect_project_scope_ids(
            organization_id=organization_id,
            root_project_id=project_id,
            session=session,
        )
        query = query.where(SavedReport.project_id.in_(scoped_project_ids))
    elif project_id is not None:
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
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> SavedReport:
    """
    Get a single saved report by ID.

    Args:
        report_id: Report ID
        user_id: Owner user ID
        organization_id: Organization ID (for project resolution)
        session: Database session

    Returns:
        SavedReport: The report

    Raises:
        HTTPException: If report not found
    """
    query = active_reports_query(user_id).where(SavedReport.id == report_id)
    result = await session.execute(query)
    report = result.scalar_one_or_none()

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    # Backfill one-off legacy report assignment on read.
    if report.project_id is None:
        report.project_id = await _get_or_create_project_for_location(
            organization_id=organization_id,
            gemeente_naam=report.city,
            gemeente_code=None,
            wijk_naam=None,
            session=session,
        )
        await session.commit()

    return report


async def soft_delete_report(
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> SavedReport:
    """
    Soft-delete a report by setting deleted_at.

    Args:
        report_id: Report ID
        user_id: Owner user ID
        organization_id: Organization ID (for project resolution in get_report)
        session: Database session

    Returns:
        SavedReport: The deleted report

    Raises:
        HTTPException: If report not found
    """
    report = await get_report(report_id, user_id=user_id, organization_id=organization_id, session=session)
    report.deleted_at = datetime.utcnow()
    await session.commit()
    return report


async def restore_report(
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession,
) -> SavedReport:
    """
    Restore a soft-deleted report.

    Args:
        report_id: Report ID
        user_id: Owner user ID
        session: Database session

    Returns:
        SavedReport: The restored report

    Raises:
        HTTPException: If report not found
    """
    # Query DELETED reports
    query = select(SavedReport).where(
        SavedReport.user_id == user_id,
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
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    notes: str | None,
    session: AsyncSession,
) -> SavedReport:
    """
    Update report notes.

    Args:
        report_id: Report ID
        user_id: Owner user ID
        organization_id: Organization ID (for project resolution in get_report)
        notes: New notes content (None to clear)
        session: Database session

    Returns:
        SavedReport: The updated report

    Raises:
        HTTPException: If report not found
    """
    report = await get_report(report_id, user_id=user_id, organization_id=organization_id, session=session)
    report.notes = notes
    await session.commit()
    return report


async def assign_report_to_project(
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    project_id: uuid.UUID | None,
    session: AsyncSession,
) -> SavedReport:
    """
    Assign report to a project.

    Args:
        report_id: Report ID
        user_id: Owner user ID
        organization_id: Organization ID (for project verification)
        project_id: Project ID (None auto-maps to gemeente folder)
        session: Database session

    Returns:
        SavedReport: The updated report

    Raises:
        HTTPException: If report or project not found
    """
    report = await get_report(report_id, user_id=user_id, organization_id=organization_id, session=session)

    # Never leave a report unassigned. Null requests map to auto gemeente folder.
    if project_id is None:
        gemeente_naam, gemeente_code, wijk_naam = await _resolve_report_location_context(
            organization_id=organization_id,
            report_data=report.report_data,
            city=report.city,
            session=session,
        )
        project_id = await _get_or_create_project_for_location(
            organization_id=organization_id,
            gemeente_naam=gemeente_naam,
            gemeente_code=gemeente_code,
            wijk_naam=wijk_naam,
            session=session,
        )
    else:
        # If project_id provided, verify project exists in same organization.
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
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    fresh_data: dict,
    session: AsyncSession,
) -> SavedReport:
    """
    Update report with fresh property data.

    Args:
        report_id: Report ID
        user_id: Owner user ID
        organization_id: Organization ID (for project resolution in get_report)
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

    report = await get_report(report_id, user_id=user_id, organization_id=organization_id, session=session)

    # Update report_data JSONB
    # BRK eigendomsdata MUST be stripped before JSONB persist (Kadaster Tier 3 never-store terms).
    report_data_dict = validated_report.model_dump(mode="json")
    report_data_dict.pop("brk_ownership", None)
    report.report_data = report_data_dict

    # Update denormalized fields
    address_data = fresh_data["address"]
    report.postcode = address_data["postcode"]
    report.city = address_data["woonplaats"]

    # Update report_name
    report.report_name = f"{address_data.get('straat', address_data.get('straatnaam', 'Onbekend'))} {address_data['huisnummer']}, {address_data['woonplaats']}"

    # Update timestamp
    report.updated_at = datetime.utcnow()

    await session.commit()
    return report


async def regenerate_report_data(
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    client,
    session: AsyncSession,
) -> SavedReport:
    """
    Re-aggregate all property data from APIs and update the saved report.

    Fetches fresh data using the same pipeline as initial report creation,
    then replaces the stored snapshot. Used for the "Ververs rapport" button.
    """
    report = await get_report(report_id, user_id=user_id, organization_id=organization_id, session=session)

    source_parcel_id = report.source_parcel_id
    stored = report.report_data or {}
    address = stored.get("address", {})

    if not address.get("postcode") or not address.get("huisnummer"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kan rapport niet vernieuwen: adresgegevens ontbreken.",
        )

    from app.schemas.address import AddressInput
    input_data = AddressInput(
        postcode=address["postcode"],
        huisnummer=address["huisnummer"],
        huisletter=address.get("huisletter"),
        toevoeging=address.get("toevoeging"),
    )

    fresh_data = await aggregate_property_data(
        input_data=input_data,
        client=client,
        session=session,
        force_refresh=True,
    )

    report_data_dict = fresh_data.model_dump(mode="json")
    report_data_dict.pop("brk_ownership", None)
    report.report_data = report_data_dict
    report.updated_at = datetime.utcnow()

    await session.commit()
    return report


async def get_distinct_cities(
    user_id: uuid.UUID,
    session: AsyncSession,
) -> list[str]:
    """
    Get list of distinct cities from active reports for filter dropdown.

    Args:
        user_id: Owner user ID
        session: Database session

    Returns:
        list[str]: Sorted list of city names
    """
    query = (
        select(SavedReport.city)
        .where(
            SavedReport.user_id == user_id,
            SavedReport.deleted_at.is_(None),
        )
        .distinct()
        .order_by(SavedReport.city)
    )

    result = await session.execute(query)
    cities = [row[0] for row in result.all()]
    return cities


async def save_generated_dossier(
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    file_size: int,
    session: AsyncSession,
) -> GeneratedDossier:
    """
    Create a GeneratedDossier audit record after PDF generation.

    Args:
        report_id: SavedReport ID the dossier belongs to
        user_id: ID of the user who generated the dossier
        file_size: PDF file size in bytes
        session: Database session

    Returns:
        GeneratedDossier: The created audit record
    """
    dossier = GeneratedDossier(
        report_id=report_id,
        generated_by_user_id=user_id,
        file_size_bytes=file_size,
        template_version="v1",
    )
    session.add(dossier)
    await session.flush()
    await session.commit()
    return dossier


async def list_generated_dossiers(
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession,
) -> list[GeneratedDossier]:
    """
    List all generated dossiers for a report, newest first.

    Args:
        report_id: SavedReport ID to list dossiers for
        user_id: Owner user ID
        session: Database session

    Returns:
        list[GeneratedDossier]: Dossiers ordered by created_at descending
    """
    result = await session.execute(
        select(GeneratedDossier)
        .where(
            GeneratedDossier.generated_by_user_id == user_id,
            GeneratedDossier.report_id == report_id,
        )
        .order_by(desc(GeneratedDossier.created_at))
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Helpers migrated from router.py
# ---------------------------------------------------------------------------


def extract_report_address_input(
    report_data: dict,
    fallback_postcode: str | None = None,
) -> AddressInput | None:
    """Build AddressInput from stored report payload."""
    address = report_data.get("address")
    if not isinstance(address, dict):
        return None

    postcode = address.get("postcode") or fallback_postcode
    huisnummer_raw = address.get("huisnummer")
    try:
        huisnummer = int(huisnummer_raw)
    except (TypeError, ValueError):
        return None

    if not postcode or huisnummer <= 0:
        return None

    try:
        return AddressInput(postcode=str(postcode), huisnummer=huisnummer)
    except Exception:
        return None


def report_needs_v7_backfill(report_data: dict) -> bool:
    """Detect old reports that miss newer v7 sections."""
    required_keys = (
        "energy_label",
        "woz_data",
        "market_signals",
        "buildability_delta",
        "wkb_precheck",
        "permit_precedents",
        "map_data",
        "monuments",
        "section_sources",
    )
    return any(key not in report_data for key in required_keys)


def parse_parcel_address(address: str) -> tuple[str, int] | None:
    """
    Parse PDOK weergavenaam to (postcode, huisnummer).

    Format: "{straat} {huisnummer}, {postcode} {woonplaats}"
    """
    upper = address.upper()
    postcode_match = re.search(r"(\d{4})\s*([A-Z]{2})\b", upper)
    if not postcode_match:
        return None
    postcode = f"{postcode_match.group(1)} {postcode_match.group(2)}"

    pre_comma = address.split(",")[0] if "," in address else address
    hn_match = re.search(r"(\d+)", pre_comma)
    if not hn_match:
        return None

    huisnummer = int(hn_match.group(1))
    if huisnummer <= 0:
        return None

    return postcode, huisnummer


def parse_rd_point_wkt(wkt: str | None) -> tuple[float, float] | None:
    """Parse WKT POINT string to RD tuple."""
    if not isinstance(wkt, str) or not wkt:
        return None
    m = re.match(r"POINT\(([^ ]+) ([^ ]+)\)", wkt)
    if not m:
        return None
    try:
        return float(m.group(1)), float(m.group(2))
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Business logic extracted from router endpoint handlers
# ---------------------------------------------------------------------------


async def generate_report_from_address(
    *,
    address_input: AddressInput,
    notes: str | None,
    project_id: uuid.UUID | None,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
    http_client,
    arq_pool,
) -> tuple["SavedReport", bool]:
    """Aggregate property data for an address and save as report.

    Returns (report, created) tuple.
    """
    property_data = await aggregate_property_data(
        input_data=address_input,
        client=http_client,
        session=session,
        force_refresh=False,
        arq_pool=arq_pool,
    )

    report, created = await save_report(
        report_data=property_data.model_dump(mode="json"),
        notes=notes,
        project_id=project_id,
        user_id=user_id,
        organization_id=organization_id,
        session=session,
        parcel_id=None,
        return_status=True,
    )
    return report, created


async def generate_report_from_parcel(
    *,
    parcel_id: uuid.UUID,
    notes: str | None,
    project_id: uuid.UUID | None,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
    http_client,
    arq_pool,
    locatieserver,
) -> tuple["SavedReport", bool]:
    """Full property intelligence report from a cached parcel.

    Handles idempotency, address parsing with reverse-geocode fallback,
    aggregation, scan-flag overlay, saving, and checklist auto-generation.

    Returns (report, created) tuple.
    """
    from app.reports.flags_assembler import assemble_enrichment_from_flags, build_flags_section_sources

    # 1. Fetch parcel
    result = await session.execute(
        select(ParcelCache).where(ParcelCache.id == parcel_id)
    )
    parcel = result.scalar_one_or_none()
    if parcel is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perceel niet gevonden",
        )

    # Idempotency: return existing report for this parcel if present
    existing_report = await get_report_by_source_parcel(
        parcel_id=parcel_id, user_id=user_id, session=session,
    )
    if existing_report is not None:
        if project_id is not None and existing_report.project_id != project_id:
            existing_report = await assign_report_to_project(
                report_id=existing_report.id,
                user_id=user_id,
                organization_id=organization_id,
                project_id=project_id,
                session=session,
            )
        if notes is not None and existing_report.notes != notes:
            existing_report = await update_report_notes(
                report_id=existing_report.id,
                user_id=user_id,
                organization_id=organization_id,
                notes=notes,
                session=session,
            )
        return existing_report, False

    # 2. Parse address with reverse-geocode fallback
    source_address = parcel.address
    parsed = parse_parcel_address(source_address) if source_address else None
    if parsed is None:
        from geoalchemy2.functions import ST_AsText, ST_Centroid

        centroid_query = select(ST_AsText(ST_Centroid(ParcelCache.geometry))).where(
            ParcelCache.id == parcel_id,
        )
        centroid_row = (await session.execute(centroid_query)).one_or_none()
        rd_point = parse_rd_point_wkt(centroid_row[0] if centroid_row else None)
        if rd_point is not None:
            reverse_address = await locatieserver.reverse(
                rd_x=rd_point[0], rd_y=rd_point[1], client=http_client,
            )
            if reverse_address:
                source_address = reverse_address
                parsed = parse_parcel_address(reverse_address)
                if parsed is not None and not parcel.address:
                    parcel.address = reverse_address
                    session.add(parcel)

    if parsed is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Adres kan niet worden verwerkt: {source_address}"
                if source_address
                else "Geen geldig adres beschikbaar voor dit perceel"
            ),
        )
    postcode, huisnummer = parsed

    # 3. Build AddressInput and aggregate
    address_input = AddressInput(postcode=postcode, huisnummer=huisnummer)
    property_data = await aggregate_property_data(
        input_data=address_input,
        client=http_client,
        session=session,
        force_refresh=False,
        arq_pool=arq_pool,
    )

    # 4. Overlay scan enrichment from scan_results.flags
    flags_query = (
        select(ScanResult.flags, ScanResult.created_at)
        .join(AreaScan, ScanResult.scan_id == AreaScan.id)
        .where(
            ScanResult.parcel_id == parcel_id,
            AreaScan.status == "completed",
        )
        .order_by(ScanResult.created_at.desc())
        .limit(1)
    )
    flags_row = (await session.execute(flags_query)).one_or_none()
    if flags_row is not None:
        scan_flags, scan_created_at = flags_row
        if scan_flags and isinstance(scan_flags, dict):
            enrichment = assemble_enrichment_from_flags(scan_flags)
            report_dict = property_data.model_dump(mode="json")
            report_dict.update({k: v for k, v in enrichment.items() if v is not None})
            flag_sources = build_flags_section_sources(scan_flags, scan_created_at)
            report_dict.setdefault("section_sources", []).extend(
                [s.model_dump(mode="json") for s in flag_sources]
            )
            property_data = PropertyReportResponse.model_validate(report_dict)
    else:
        logger.info("No scan flags for parcel %s, using aggregator fallback", parcel_id)

    # 5. Save report
    report, created = await save_report(
        report_data=property_data.model_dump(mode="json"),
        notes=notes,
        project_id=project_id,
        user_id=user_id,
        organization_id=organization_id,
        session=session,
        parcel_id=parcel_id,
        return_status=True,
    )

    # 5b. Auto-generate checklist PDFs for newly created reports
    if created:
        try:
            from app.reports.checklist_orchestrator import generate_checklist_documents

            checklist_result = await generate_checklist_documents(
                report_data=report.report_data,
                report_name=report.report_name,
                parcel_id=parcel_id,
                user_id=user_id,
                db=session,
            )
            logger.info(
                "Checklist docs for parcel=%s: generated=%d failed=%d skipped=%d",
                parcel_id,
                len(checklist_result.generated),
                len(checklist_result.failed),
                len(checklist_result.skipped),
            )
        except Exception:
            logger.warning(
                "Checklist doc generation failed for parcel=%s — report saved successfully",
                parcel_id,
                exc_info=True,
            )

    return report, created


async def enrich_report_for_view(
    *,
    report: "SavedReport",
    organization_id: uuid.UUID,
    session: AsyncSession,
    http_client,
    arq_pool,
) -> dict:
    """Enrich stored report data for viewing: v7 backfill + live BRK.

    Returns enriched report_data dict (never mutates the report ORM object's report_data).
    """
    report_data = dict(report.report_data)

    # Auto-upgrade older reports with missing v7 sections
    if report_needs_v7_backfill(report_data):
        address_input = extract_report_address_input(report_data, report.postcode)
        if address_input is not None:
            try:
                fresh = await aggregate_property_data(
                    input_data=address_input,
                    client=http_client,
                    session=session,
                    force_refresh=False,
                    arq_pool=arq_pool,
                )
                fresh_data = fresh.model_dump(mode="json")
                report = await update_report_data(
                    report_id=report.id,
                    user_id=report.user_id,
                    organization_id=organization_id,
                    fresh_data=fresh_data,
                    session=session,
                )
                report_data = dict(report.report_data)
                report_data["brk_ownership"] = fresh_data.get("brk_ownership")
            except Exception as e:
                logger.warning("Report v7 auto-backfill skipped for %s: %s", report.id, str(e))

    # BRK re-fetch: Kadaster Tier 3 requires live data per view
    if report_data.get("brk_ownership") is None:
        try:
            stored_parcels = [
                CadastralParcel.model_validate(p)
                for p in report_data.get("cadastral_parcels", [])
            ]
            brk_section = await fetch_brk_ownership(stored_parcels)
            report_data["brk_ownership"] = brk_section.model_dump(mode="json")
        except Exception as e:
            logger.warning("BRK re-fetch on view failed: %s", str(e))

    return report_data


async def export_report_pdf_bytes(
    *,
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> tuple[bytes, str]:
    """Generate PDF bytes for a report. Returns (pdf_bytes, filename)."""
    from app.reports.pdf_export import generate_report_pdf

    report = await get_report(
        report_id=report_id,
        user_id=user_id,
        organization_id=organization_id,
        session=session,
    )

    pdf_bytes = await asyncio.to_thread(
        generate_report_pdf, report.report_data, report.report_name,
    )

    postcode_clean = report.postcode.replace(" ", "")
    filename = f"rapport-{postcode_clean}.pdf"
    return pdf_bytes, filename


async def generate_startdossier_bytes(
    *,
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    generated_by: str,
    session: AsyncSession,
) -> tuple[bytes, str]:
    """Generate Risicobeoordeling Startdossier PDF. Returns (pdf_bytes, filename)."""
    from app.reports.dossier_export import generate_dossier_pdf

    report = await get_report(
        report_id=report_id,
        user_id=user_id,
        organization_id=organization_id,
        session=session,
    )

    pdf_bytes = await asyncio.to_thread(
        generate_dossier_pdf, report.report_data, report.report_name, generated_by,
    )

    await save_generated_dossier(
        report_id=report.id,
        user_id=user_id,
        file_size=len(pdf_bytes),
        session=session,
    )

    postcode_clean = report.postcode.replace(" ", "")
    filename = f"risicobeoordeling-{postcode_clean}.pdf"
    return pdf_bytes, filename
