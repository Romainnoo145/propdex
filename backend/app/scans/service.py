"""Scan CRUD service layer for area scan operations."""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import asc, delete, desc, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.models.scan_result import ScanResult


async def expire_stale_scans(
    organization_id: uuid.UUID,
    session: AsyncSession,
    stale_minutes: int = 15,
) -> int:
    """
    Mark scans stuck in pending/running for too long as failed.

    Returns the number of scans expired.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=stale_minutes)
    stmt = (
        update(AreaScan)
        .where(
            AreaScan.organization_id == organization_id,
            AreaScan.status.in_(["pending", "running"]),
            AreaScan.created_at < cutoff,
        )
        .values(status="failed")
    )
    result = await session.execute(stmt)
    if result.rowcount > 0:
        await session.flush()
        await session.commit()
    return result.rowcount


async def get_existing_scan(
    organization_id: uuid.UUID,
    gemeente_code: str,
    session: AsyncSession,
    bbox: dict | None = None,
) -> AreaScan | None:
    """
    Get most recent completed scan for organization + gemeente + bbox.

    Only returns scans with status='completed'. Pending/running/failed scans
    are not considered "existing" — they should not block re-scanning.

    When bbox is provided, only matches scans with the same bounding box
    (within 1m tolerance in RD coordinates). This prevents a gemeente-wide
    scan from matching when a wijk-specific scan is requested.

    Args:
        organization_id: Tenant organization ID
        gemeente_code: CBS gemeentecode
        bbox: Optional bounding box dict with minx, miny, maxx, maxy (EPSG:28992)
        session: Database session

    Returns:
        AreaScan | None: Most recent completed scan or None
    """
    # First, expire any stale scans for this org
    await expire_stale_scans(organization_id, session)

    query = (
        select(AreaScan)
        .where(
            AreaScan.organization_id == organization_id,
            AreaScan.gemeente_code == gemeente_code,
            AreaScan.status == "completed",
        )
    )

    if bbox is not None:
        # Match bbox within 1m tolerance (RD coordinates are in meters)
        tolerance = 1.0
        query = query.where(
            func.abs(AreaScan.bbox_minx - bbox["minx"]) < tolerance,
            func.abs(AreaScan.bbox_miny - bbox["miny"]) < tolerance,
            func.abs(AreaScan.bbox_maxx - bbox["maxx"]) < tolerance,
            func.abs(AreaScan.bbox_maxy - bbox["maxy"]) < tolerance,
        )

    query = query.order_by(AreaScan.created_at.desc()).limit(1)

    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_or_create_wijk_project(
    organization_id: uuid.UUID,
    gemeente_code: str,
    gemeente_naam: str,
    wijk_naam: str | None,
    session: AsyncSession,
) -> uuid.UUID | None:
    """
    Get or create a gemeente→wijk project hierarchy for a scan.

    When a wijk scan is triggered, automatically creates:
    1. A gemeente parent project (if not exists)
    2. A wijk child project under that gemeente (if not exists)

    Returns the wijk project ID to link to the scan.
    """
    if not wijk_naam:
        return None

    # Find or create gemeente parent project
    gemeente_result = await session.execute(
        select(Project).where(
            Project.organization_id == organization_id,
            Project.gemeente_code == gemeente_code,
            Project.parent_id.is_(None),
        ).limit(1)
    )
    gemeente_project = gemeente_result.scalar_one_or_none()

    if not gemeente_project:
        gemeente_project = Project(
            organization_id=organization_id,
            name=gemeente_naam,
            gemeente_code=gemeente_code,
            is_monitored=True,
        )
        session.add(gemeente_project)
        await session.flush()

    # Find or create wijk child project
    wijk_result = await session.execute(
        select(Project).where(
            Project.organization_id == organization_id,
            Project.parent_id == gemeente_project.id,
            Project.wijk_naam == wijk_naam,
        ).limit(1)
    )
    wijk_project = wijk_result.scalar_one_or_none()

    if not wijk_project:
        wijk_project = Project(
            organization_id=organization_id,
            name=wijk_naam,
            parent_id=gemeente_project.id,
            gemeente_code=gemeente_code,
            wijk_naam=wijk_naam,
            is_monitored=True,
        )
        session.add(wijk_project)
        await session.flush()

    return wijk_project.id


async def create_scan(
    organization_id: uuid.UUID,
    gemeente_code: str,
    gemeente_naam: str,
    bbox: dict,
    session: AsyncSession,
    wijk_naam: str | None = None,
) -> AreaScan:
    """
    Create a new area scan record.

    Automatically creates a gemeente→wijk project hierarchy and links the scan.

    Args:
        organization_id: Tenant organization ID
        gemeente_code: CBS gemeentecode
        gemeente_naam: Gemeente display name
        bbox: Bounding box dict with minx, miny, maxx, maxy keys
        session: Database session
        wijk_naam: Optional CBS wijk name

    Returns:
        AreaScan: The created scan
    """
    # Auto-create project hierarchy for wijk scans
    project_id = await get_or_create_wijk_project(
        organization_id, gemeente_code, gemeente_naam, wijk_naam, session
    )

    scan = AreaScan(
        organization_id=organization_id,
        gemeente_code=gemeente_code,
        gemeente_naam=gemeente_naam,
        wijk_naam=wijk_naam,
        project_id=project_id,
        bbox_minx=bbox["minx"],
        bbox_miny=bbox["miny"],
        bbox_maxx=bbox["maxx"],
        bbox_maxy=bbox["maxy"],
        status="pending",
        progress_pct=0,
    )

    session.add(scan)
    await session.flush()
    await session.commit()

    return scan


async def reset_scan_for_rescan(
    scan: AreaScan,
    session: AsyncSession,
) -> AreaScan:
    """
    Reset scan for re-scan by deleting results and resetting fields.

    Args:
        scan: Existing AreaScan to reset
        session: Database session

    Returns:
        AreaScan: The reset scan
    """
    # Delete all ScanResult rows for this scan
    delete_stmt = delete(ScanResult).where(ScanResult.scan_id == scan.id)
    await session.execute(delete_stmt)

    # Reset scan fields
    scan.status = "pending"
    scan.progress_pct = 0
    scan.parcels_total = 0
    scan.parcels_processed = 0
    scan.parcels_failed = 0
    scan.current_phase = None
    scan.error_message = None
    scan.started_at = None
    scan.completed_at = None
    scan.job_id = None

    session.add(scan)
    await session.flush()
    await session.commit()

    return scan


async def get_scan_by_id(
    scan_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> AreaScan | None:
    """
    Get scan by ID with multi-tenant isolation.

    Args:
        scan_id: Scan UUID
        organization_id: Tenant organization ID
        session: Database session

    Returns:
        AreaScan | None: The scan or None if not found
    """
    query = select(AreaScan).where(
        AreaScan.id == scan_id,
        AreaScan.organization_id == organization_id,
    )

    result = await session.execute(query)
    return result.scalar_one_or_none()


async def list_scan_results_by_ids(
    scan_id: uuid.UUID,
    organization_id: uuid.UUID,
    parcel_ids: list[uuid.UUID],
    sort_by: str = "score",
    sort_order: str = "desc",
    session: AsyncSession = None,  # type: ignore[assignment]
) -> list[tuple]:
    """
    List scan results filtered by a specific set of parcel UUIDs.

    Fetches results for the given parcel_ids within the scan. No pagination —
    exports all selected rows. Used by the bulk export-selection endpoint.

    Args:
        scan_id: Scan UUID
        organization_id: Tenant organization ID
        parcel_ids: List of parcel UUIDs to include
        sort_by: Sort field (score, area_m2, address, bouwjaar)
        sort_order: Sort direction (asc, desc)
        session: Database session

    Returns:
        list[tuple]: List of (ScanResult, ParcelCache) tuples
    """
    # Base query: join ScanResult to ParcelCache
    query = (
        select(ScanResult, ParcelCache)
        .join(ParcelCache, ScanResult.parcel_id == ParcelCache.id)
        .where(
            ScanResult.scan_id == scan_id,
            ScanResult.organization_id == organization_id,
            ScanResult.parcel_id.in_(parcel_ids),
        )
    )

    # Apply sorting
    sort_field_map = {
        "score": ScanResult.score,
        "area_m2": ParcelCache.area_m2,
        "address": ParcelCache.address,
        "bouwjaar": ParcelCache.bouwjaar,
    }

    sort_field = sort_field_map.get(sort_by, ScanResult.score)
    sort_func = desc if sort_order == "desc" else asc
    query = query.order_by(sort_func(sort_field))

    result = await session.execute(query)
    return list(result.all())


async def list_scan_results(
    scan_id: uuid.UUID,
    organization_id: uuid.UUID,
    has_pand: bool | None,
    bestemming_type: str | None,
    min_area_m2: float | None,
    max_area_m2: float | None,
    score_category: str | None,
    sort_by: str,
    sort_order: str,
    offset: int,
    limit: int,
    session: AsyncSession,
    pand_status: str | None = None,
) -> tuple[list[tuple], int]:
    """
    List scan results with server-side filtering, sorting, and pagination.

    Args:
        scan_id: Scan UUID
        organization_id: Tenant organization ID
        has_pand: Filter by building presence (True/False/None)
        bestemming_type: Filter by zoning type substring (e.g., "Wonen")
        min_area_m2: Minimum parcel area in square meters
        max_area_m2: Maximum parcel area in square meters
        score_category: Filter by score category ("High" >=65, "Medium" 40-64, "Low" <40)
        sort_by: Sort field (score, area_m2, address, bouwjaar)
        sort_order: Sort direction (asc, desc)
        offset: Pagination offset
        limit: Page size
        session: Database session
        pand_status: Filter by building status substring

    Returns:
        tuple[list[tuple], int]: List of (ScanResult, ParcelCache) tuples and total count
    """
    # Base query: join ScanResult to ParcelCache
    query = (
        select(ScanResult, ParcelCache)
        .join(ParcelCache, ScanResult.parcel_id == ParcelCache.id)
        .where(
            ScanResult.scan_id == scan_id,
            ScanResult.organization_id == organization_id,
        )
    )

    # Apply filters
    if has_pand is not None:
        query = query.where(ParcelCache.has_pand == has_pand)

    if bestemming_type is not None:
        # Use JSONB text cast with LIKE for display filtering
        query = query.where(
            text("bestemmingen::text LIKE :pattern").bindparams(
                pattern=f"%{bestemming_type}%"
            )
        )

    if min_area_m2 is not None:
        query = query.where(ParcelCache.area_m2 >= min_area_m2)

    if max_area_m2 is not None:
        query = query.where(ParcelCache.area_m2 <= max_area_m2)

    if score_category is not None:
        if score_category == "High":
            query = query.where(ScanResult.score >= 65)
        elif score_category == "Medium":
            query = query.where(ScanResult.score >= 40, ScanResult.score < 65)
        elif score_category == "Low":
            query = query.where(ScanResult.score < 40)

    if pand_status is not None:
        query = query.where(
            ParcelCache.pand_status.ilike(f"%{pand_status}%")
        )

    # Count total before pagination
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    # Apply sorting
    sort_field_map = {
        "score": ScanResult.score,
        "area_m2": ParcelCache.area_m2,
        "address": ParcelCache.address,
        "bouwjaar": ParcelCache.bouwjaar,
    }

    sort_field = sort_field_map.get(sort_by, ScanResult.score)
    sort_func = desc if sort_order == "desc" else asc
    query = query.order_by(sort_func(sort_field))

    # Apply pagination
    query = query.offset(offset).limit(limit)

    # Execute query
    result = await session.execute(query)
    rows = result.all()

    return rows, total


async def list_scans(
    organization_id: uuid.UUID,
    offset: int,
    limit: int,
    session: AsyncSession,
    project_id: uuid.UUID | None = None,
    status_filter: str | None = None,
) -> tuple[list[tuple], int]:
    """
    List AreaScans with parcel_count from scan_results.

    Returns list of (AreaScan, parcel_count) tuples and total count.
    Uses COUNT(scan_results) for parcel_count -- more accurate than
    parcels_total which reflects discovered parcels before qualification.

    Args:
        organization_id: Tenant organization ID
        offset: Pagination offset
        limit: Page size
        session: Database session
        project_id: Optional filter by project
        status_filter: Optional filter by scan status

    Returns:
        tuple[list[tuple], int]: (AreaScan, parcel_count) rows and total count
    """
    parcel_count_subq = (
        select(func.count(ScanResult.id))
        .where(ScanResult.scan_id == AreaScan.id)
        .scalar_subquery()
    )

    query = (
        select(AreaScan, parcel_count_subq.label("parcel_count"))
        .where(AreaScan.organization_id == organization_id)
    )

    if project_id is not None:
        query = query.where(AreaScan.project_id == project_id)

    if status_filter is not None:
        query = query.where(AreaScan.status == status_filter)

    # Count total before pagination (derive from same query to share filters)
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    # Apply ordering and pagination
    query = query.order_by(AreaScan.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    return list(result.all()), total
