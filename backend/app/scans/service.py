"""Scan CRUD service layer for area scan operations."""

import uuid

from sqlalchemy import asc, delete, desc, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult


async def get_existing_scan(
    organization_id: uuid.UUID,
    gemeente_code: str,
    session: AsyncSession,
    bbox: dict | None = None,
) -> AreaScan | None:
    """
    Get most recent scan for organization + gemeente + bbox.

    When bbox is provided, only matches scans with the same bounding box
    (within 1m tolerance in RD coordinates). This prevents a gemeente-wide
    scan from matching when a wijk-specific scan is requested.

    Args:
        organization_id: Tenant organization ID
        gemeente_code: CBS gemeentecode
        bbox: Optional bounding box dict with minx, miny, maxx, maxy (EPSG:28992)
        session: Database session

    Returns:
        AreaScan | None: Most recent scan or None
    """
    query = (
        select(AreaScan)
        .where(
            AreaScan.organization_id == organization_id,
            AreaScan.gemeente_code == gemeente_code,
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


async def create_scan(
    organization_id: uuid.UUID,
    gemeente_code: str,
    gemeente_naam: str,
    bbox: dict,
    session: AsyncSession,
) -> AreaScan:
    """
    Create a new area scan record.

    Args:
        organization_id: Tenant organization ID
        gemeente_code: CBS gemeentecode
        gemeente_naam: Gemeente display name
        bbox: Bounding box dict with minx, miny, maxx, maxy keys
        session: Database session

    Returns:
        AreaScan: The created scan
    """
    scan = AreaScan(
        organization_id=organization_id,
        gemeente_code=gemeente_code,
        gemeente_naam=gemeente_naam,
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
        score_category: Filter by score category ("High" >=70, "Medium" 40-69, "Low" <40)
        sort_by: Sort field (score, area_m2, address)
        sort_order: Sort direction (asc, desc)
        offset: Pagination offset
        limit: Page size
        session: Database session

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
            query = query.where(ScanResult.score >= 70)
        elif score_category == "Medium":
            query = query.where(ScanResult.score >= 40, ScanResult.score < 70)
        elif score_category == "Low":
            query = query.where(ScanResult.score < 40)

    # Count total before pagination
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    # Apply sorting
    sort_field_map = {
        "score": ScanResult.score,
        "area_m2": ParcelCache.area_m2,
        "address": ParcelCache.address,
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
