"""Scan CRUD service layer for area scan operations."""

import logging
import uuid
from datetime import datetime, timedelta

import httpx
from shapely.geometry import box
from sqlalchemy import Float, asc, cast, delete, desc, func, nulls_last, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.scans.helpers import _resolve_wijk_bbox_from_geojson
from app.scans.schemas import ScanListItem, ScanResponse
from app.services.gemeente_service import get_gemeente_bbox
from app.services.spatial_helpers import transform_bbox_to_rd, transform_point_to_wgs84
from app.services.wijk_service import get_wijken_in_gemeente

logger = logging.getLogger(__name__)


def _vacancy_subscore_expr():
    """SQL expression for score-v2 subscore sorting from JSON flags."""
    return cast(
        func.coalesce(ScanResult.flags["subscores"]["vacancy"].astext, "0"),
        Float,
    )


def _buildability_subscore_expr():
    """SQL expression for score-v2 subscore sorting from JSON flags."""
    return cast(
        func.coalesce(ScanResult.flags["subscores"]["buildability"].astext, "0"),
        Float,
    )


async def expire_stale_scans(
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
    gemeente_code: str,
    session: AsyncSession,
    bbox: dict | None = None,
    project_id: uuid.UUID | None = None,
) -> AreaScan | None:
    """
    Get most recent completed scan for gemeente + bbox.

    Only returns scans with status='completed'. Pending/running/failed scans
    are not considered "existing" — they should not block re-scanning.

    When bbox is provided, only matches scans with the same bounding box
    (within 1m tolerance in RD coordinates). This prevents a gemeente-wide
    scan from matching when a wijk-specific scan is requested.

    Args:
        gemeente_code: CBS gemeentecode
        bbox: Optional bounding box dict with minx, miny, maxx, maxy (EPSG:28992)
        session: Database session

    Returns:
        AreaScan | None: Most recent completed scan or None
    """
    # First, expire any stale scans
    await expire_stale_scans(session)

    query = (
        select(AreaScan)
        .where(
            AreaScan.gemeente_code == gemeente_code,
            AreaScan.status == "completed",
        )
    )

    if project_id is not None:
        query = query.where(AreaScan.project_id == project_id)

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

    Note: Project is still org-scoped, so organization_id is required here.

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
    gemeente_code: str,
    gemeente_naam: str,
    bbox: dict,
    session: AsyncSession,
    wijk_naam: str | None = None,
    project_id: uuid.UUID | None = None,
    organization_id: uuid.UUID | None = None,
) -> AreaScan:
    """
    Create a new area scan record.

    Automatically creates a gemeente→wijk project hierarchy and links the scan.

    Args:
        gemeente_code: CBS gemeentecode
        gemeente_naam: Gemeente display name
        bbox: Bounding box dict with minx, miny, maxx, maxy keys
        session: Database session
        wijk_naam: Optional CBS wijk name
        project_id: Optional explicit project ID
        organization_id: Optional org ID — only used for Project creation (still org-scoped)

    Returns:
        AreaScan: The created scan
    """
    resolved_project_id = project_id
    if resolved_project_id is None and organization_id is not None:
        # Auto-create project hierarchy for wijk scans when no explicit folder is provided.
        resolved_project_id = await get_or_create_wijk_project(
            organization_id, gemeente_code, gemeente_naam, wijk_naam, session
        )

    scan = AreaScan(
        gemeente_code=gemeente_code,
        gemeente_naam=gemeente_naam,
        wijk_naam=wijk_naam,
        project_id=resolved_project_id,
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
    scan.coverage_ratio = None
    scan.address_resolution_ratio = None
    scan.error_detail = None

    session.add(scan)
    await session.flush()
    await session.commit()

    return scan


async def get_scan_by_id(
    scan_id: uuid.UUID,
    session: AsyncSession,
) -> AreaScan | None:
    """
    Get scan by ID.

    Args:
        scan_id: Scan UUID
        session: Database session

    Returns:
        AreaScan | None: The scan or None if not found
    """
    query = select(AreaScan).where(
        AreaScan.id == scan_id,
    )

    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_scan_org_id(
    scan_id: uuid.UUID,
    session: AsyncSession,
) -> uuid.UUID | None:
    """Return the organization_id that owns a scan via its project, or None.

    AreaScan itself is shared reference data; ownership is defined by the
    project the scan belongs to (Project is org-scoped).
    """
    query = (
        select(Project.organization_id)
        .join(AreaScan, AreaScan.project_id == Project.id)
        .where(AreaScan.id == scan_id)
    )
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def list_scan_results_by_ids(
    scan_id: uuid.UUID,
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
        parcel_ids: List of parcel UUIDs to include
        sort_by: Sort field (score, vacancy_subscore, buildability_subscore,
                 area_m2, address, bouwjaar)
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
            ScanResult.parcel_id.in_(parcel_ids),
        )
    )

    # Apply sorting
    sort_field_map = {
        "score": ScanResult.score,
        "vacancy_subscore": _vacancy_subscore_expr(),
        "buildability_subscore": _buildability_subscore_expr(),
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
    has_pand: bool | None,
    search: str | None,
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
    min_score: float | None = None,
    exclude_null_scores: bool = False,
) -> tuple[list[tuple], int, int]:
    """
    List scan results with server-side filtering, sorting, and pagination.

    Args:
        scan_id: Scan UUID
        has_pand: Filter by building presence (True/False/None)
        search: Free-text search across address, parcel code, status, and bestemming JSON
        bestemming_type: Filter by zoning type substring (e.g., "Wonen")
        min_area_m2: Minimum parcel area in square meters
        max_area_m2: Maximum parcel area in square meters
        score_category: Filter by score category ("High" >=65, "Medium" 40-64, "Low" <40)
        sort_by: Sort field (score, vacancy_subscore, buildability_subscore,
                 area_m2, address, bouwjaar)
        sort_order: Sort direction (asc, desc)
        offset: Pagination offset
        limit: Page size
        session: Database session
        pand_status: Filter by building status substring
        min_score: Minimum score threshold (applied after unfiltered count)
        exclude_null_scores: Exclude parcels with null scores (applied after unfiltered count)

    Returns:
        tuple[list[tuple], int, int]: (rows, filtered_total, unfiltered_total)
    """
    # Base query: join ScanResult to ParcelCache
    query = (
        select(ScanResult, ParcelCache)
        .join(ParcelCache, ScanResult.parcel_id == ParcelCache.id)
        .where(
            ScanResult.scan_id == scan_id,
        )
    )

    # Apply filters
    if has_pand is not None:
        query = query.where(ParcelCache.has_pand == has_pand)

    if search is not None and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                ParcelCache.address.ilike(pattern),
                ParcelCache.parcel_id.ilike(pattern),
                ParcelCache.pand_status.ilike(pattern),
                text("bestemmingen::text ILIKE :search_pattern").bindparams(
                    search_pattern=pattern
                ),
            )
        )

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

    # Compute unfiltered total BEFORE score threshold filters
    unfiltered_count_q = select(func.count()).select_from(query.subquery())
    unfiltered_total = (await session.execute(unfiltered_count_q)).scalar() or 0

    # Apply score threshold filters (for "Top kansen" default preset)
    if exclude_null_scores:
        query = query.where(ScanResult.score.is_not(None))
    if min_score is not None:
        query = query.where(ScanResult.score >= min_score)

    # Count filtered total before pagination
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await session.execute(count_query)
    filtered_total = count_result.scalar() or 0

    # Apply sorting — nulls_last ensures null-score parcels sort to bottom
    # regardless of ASC/DESC direction
    sort_field_map = {
        "score": ScanResult.score,
        "vacancy_subscore": _vacancy_subscore_expr(),
        "buildability_subscore": _buildability_subscore_expr(),
        "area_m2": ParcelCache.area_m2,
        "address": ParcelCache.address,
        "bouwjaar": ParcelCache.bouwjaar,
    }

    sort_field = sort_field_map.get(sort_by, ScanResult.score)
    if sort_order == "desc":
        query = query.order_by(nulls_last(desc(sort_field)))
    else:
        query = query.order_by(nulls_last(asc(sort_field)))

    # Apply pagination
    query = query.offset(offset).limit(limit)

    # Execute query
    result = await session.execute(query)
    rows = result.all()

    return rows, filtered_total, unfiltered_total


async def list_scans(
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


# ---------------------------------------------------------------------------
# Helpers extracted from router (M023/S02/T05)
# ---------------------------------------------------------------------------


def build_scan_list_items(
    scans: list[tuple],
) -> list[ScanListItem]:
    """Transform raw (AreaScan, parcel_count) tuples into ScanListItem list."""
    items: list[ScanListItem] = []
    for scan, parcel_count in scans:
        bbox_wgs84 = None
        if (
            scan.bbox_minx is not None
            and scan.bbox_miny is not None
            and scan.bbox_maxx is not None
            and scan.bbox_maxy is not None
        ):
            min_lon_raw, min_lat_raw = transform_point_to_wgs84(scan.bbox_minx, scan.bbox_miny)
            max_lon_raw, max_lat_raw = transform_point_to_wgs84(scan.bbox_maxx, scan.bbox_maxy)
            bbox_wgs84 = (
                min(min_lon_raw, max_lon_raw),
                min(min_lat_raw, max_lat_raw),
                max(min_lon_raw, max_lon_raw),
                max(min_lat_raw, max_lat_raw),
            )

        items.append(
            ScanListItem(
                scan_id=scan.id,
                gemeente_naam=scan.gemeente_naam,
                gemeente_code=scan.gemeente_code,
                wijk_naam=scan.wijk_naam,
                neighborhood_metrics=scan.neighborhood_metrics,
                bbox_wgs84=bbox_wgs84,
                scan_date=scan.created_at,
                status=scan.status,
                parcel_count=parcel_count or 0,
                project_id=scan.project_id,
            )
        )
    return items


async def resolve_scan_bbox(
    gemeente_code: str,
    wijk_naam: str | None,
    bbox_wgs84: tuple[float, float, float, float] | None,
    http_client: httpx.AsyncClient,
) -> dict:
    """Resolve WGS84 bbox → RD bbox dict, or fall back to gemeente bbox.

    Returns dict with minx/miny/maxx/maxy in EPSG:28992 (RD New).

    Raises:
        ValueError: If bbox is invalid (out of NL bounds, min >= max, too large)
        or wijk/gemeente cannot be resolved.
    """
    # If wijk scan without explicit bbox, resolve from CBS WFS geometry
    if bbox_wgs84 is None and wijk_naam:
        try:
            wijken_geojson = await get_wijken_in_gemeente(gemeente_code, http_client)
        except ValueError as e:
            raise ValueError(
                f"No wijken found for gemeente {gemeente_code}: {e}"
            ) from e
        except httpx.HTTPError as e:
            raise ValueError("CBS WFS service unavailable") from e

        resolved = _resolve_wijk_bbox_from_geojson(wijken_geojson, wijk_naam)
        if resolved is None:
            raise ValueError(
                f"Could not resolve wijk bbox for '{wijk_naam}'. "
                "Selecteer de wijk op de kaart of stuur bbox_wgs84 mee."
            )
        bbox_wgs84 = resolved
        logger.info(
            "Resolved wijk bbox from CBS WFS for gemeente=%s wijk=%s",
            gemeente_code,
            wijk_naam,
        )

    if bbox_wgs84:
        min_lon, min_lat, max_lon, max_lat = bbox_wgs84

        # Validate within Netherlands WGS84 bounds
        if not (3.3 <= min_lon <= 7.2 and 3.3 <= max_lon <= 7.2 and
                50.7 <= min_lat <= 53.6 and 50.7 <= max_lat <= 53.6):
            raise ValueError("Bbox coordinates are outside Netherlands bounds")

        if min_lon >= max_lon or min_lat >= max_lat:
            raise ValueError("Invalid bbox: min coordinates must be less than max")

        minx, miny, maxx, maxy = transform_bbox_to_rd(min_lon, min_lat, max_lon, max_lat)

        bbox_geom = box(minx, miny, maxx, maxy)
        area_m2 = bbox_geom.area
        MAX_AREA = 500_000_000  # 500 km²

        if area_m2 > MAX_AREA:
            raise ValueError(
                f"Scan area {area_m2 / 1_000_000:.1f} km² exceeds maximum of 500 km². "
                "Selecteer een kleiner gebied."
            )

        return {"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy}

    # Fall back to gemeente bbox
    try:
        return await get_gemeente_bbox(gemeente_code, http_client)
    except ValueError as e:
        raise ValueError(f"Invalid gemeente: {e}") from e


async def process_trigger_scan(
    gemeente_code: str,
    gemeente_naam: str,
    wijk_naam: str | None,
    bbox_wgs84: tuple[float, float, float, float] | None,
    force_rescan: bool,
    target_project_id: uuid.UUID | None,
    organization_id: uuid.UUID,
    http_client: httpx.AsyncClient,
    arq_pool,
    session: AsyncSession,
) -> ScanResponse:
    """Core trigger-scan business logic.

    Resolves bbox, checks existing scans, creates/resets scan, enqueues ARQ job.

    Raises:
        ValueError: For validation/resolution errors (→ HTTP 400/404/502).
        LookupError: When a referenced project is not found (→ HTTP 404).
    """
    bbox = await resolve_scan_bbox(gemeente_code, wijk_naam, bbox_wgs84, http_client)

    # Validate explicit project linkage
    if target_project_id is not None:
        project_result = await session.execute(
            select(Project).where(
                Project.id == target_project_id,
                Project.organization_id == organization_id,
            ).limit(1)
        )
        if project_result.scalar_one_or_none() is None:
            raise LookupError("Project not found")

    # Check for existing scan
    existing_scan = await get_existing_scan(
        gemeente_code=gemeente_code,
        bbox=bbox,
        project_id=target_project_id,
        session=session,
    )

    if existing_scan and not force_rescan:
        days_old = (datetime.utcnow() - existing_scan.created_at).days
        return ScanResponse(
            scan_id=existing_scan.id,
            status="existing",
            gemeente_naam=existing_scan.gemeente_naam,
            gemeente_code=existing_scan.gemeente_code,
            scan_date=existing_scan.created_at,
            needs_rescan=days_old > 30,
            message=f"Scan from {existing_scan.created_at.strftime('%Y-%m-%d')} already exists. Use force_rescan=true to re-scan.",
        )

    if existing_scan and force_rescan:
        scan = await reset_scan_for_rescan(existing_scan, session)
    else:
        scan = await create_scan(
            gemeente_code=gemeente_code,
            gemeente_naam=gemeente_naam,
            bbox=bbox,
            session=session,
            wijk_naam=wijk_naam,
            project_id=target_project_id,
            organization_id=organization_id,
        )

    # Enqueue ARQ job
    job = await arq_pool.enqueue_job("area_scan_job", str(scan.id), str(organization_id))
    scan.job_id = job.job_id
    session.add(scan)
    await session.flush()
    await session.commit()

    return ScanResponse(
        scan_id=scan.id,
        status="pending",
        gemeente_naam=scan.gemeente_naam,
        gemeente_code=scan.gemeente_code,
        scan_date=scan.created_at,
        needs_rescan=False,
        message="Scan started successfully",
    )
