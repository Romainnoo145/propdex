"""Scan management API endpoints."""

import logging
import uuid
from datetime import datetime

import httpx
from arq.jobs import Job
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from shapely.geometry import box
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.models.user import User
from app.scans import service
from app.scans.helpers import _resolve_wijk_bbox_from_geojson
from app.scans.schemas import (
    ScanCreateRequest,
    ScanListItem,
    ScanListResponse,
    ScanResponse,
    ScanStatusResponse,
)
from app.services.gemeente_service import get_gemeente_bbox
from app.services.spatial_helpers import transform_bbox_to_rd, transform_point_to_wgs84
from app.services.wijk_service import get_wijken_in_gemeente

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.get("", response_model=ScanListResponse)
@limiter.limit("60/minute")
async def list_scans(
    request: Request,
    offset: int = 0,
    limit: int = 50,
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="Filter by scan status (pending, running, completed, failed, cancelled)",
    ),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ScanListResponse:
    """
    List paginated scan history with metadata.

    Returns all scans ordered by most recent first. Each scan includes gemeente
    name, wijk name, date, status, and the count of qualifying parcel results.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        offset: Pagination offset (default 0)
        limit: Page size (default 50, max 100)
        status_filter: Optional filter by scan status
        current_user: Authenticated user
        db: Database session

    Returns:
        ScanListResponse: Paginated scan list with total count
    """
    limit = min(limit, 100)

    scans, total = await service.list_scans(
        offset=offset,
        limit=limit,
        session=db,
        status_filter=status_filter,
    )

    scan_items: list[ScanListItem] = []
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

        scan_items.append(
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

    return ScanListResponse(
        scans=scan_items,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.post("", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def trigger_scan(
    request: Request,
    scan_request: ScanCreateRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScanResponse:
    """
    Trigger a new area scan for a gemeente.

    Creates an AreaScan record and enqueues an ARQ background job to process
    all parcels within the gemeente bounding box. Implements existing scan
    detection with re-scan option and 10,000 parcel limit validation.

    Requires JWT authentication. Rate limited to 10 requests per minute.

    Args:
        request: FastAPI request object
        scan_request: Scan trigger request with gemeente info
        current_user: Authenticated user
        db: Database session

    Returns:
        ScanResponse: Scan status with scan_id

    Raises:
        HTTPException 400: Invalid gemeente or parcel count exceeds limit
        HTTPException 500: Internal server error
    """
    try:
        # Determine bbox first (needed for existing scan matching)
        bbox_wgs84 = scan_request.bbox_wgs84
        http_client = request.app.state.http_client

        # If this is a wijk scan without explicit bbox, resolve bbox from CBS wijk geometry.
        # This prevents accidental gemeente-wide scans from project/wijk views.
        if bbox_wgs84 is None and scan_request.wijk_naam:
            try:
                wijken_geojson = await get_wijken_in_gemeente(
                    scan_request.gemeente_code,
                    http_client,
                )
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No wijken found for gemeente {scan_request.gemeente_code}: {e}",
                ) from e
            except httpx.HTTPError as e:
                logger.exception("CBS WFS service error while resolving wijk bbox")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="CBS WFS service unavailable",
                ) from e
            resolved_bbox = _resolve_wijk_bbox_from_geojson(
                wijken_geojson,
                scan_request.wijk_naam,
            )
            if resolved_bbox is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Could not resolve wijk bbox for '{scan_request.wijk_naam}'. "
                        "Selecteer de wijk op de kaart of stuur bbox_wgs84 mee."
                    ),
                )
            bbox_wgs84 = resolved_bbox
            logger.info(
                "Resolved wijk bbox from CBS WFS for gemeente=%s wijk=%s",
                scan_request.gemeente_code,
                scan_request.wijk_naam,
            )

        if bbox_wgs84:
            min_lon, min_lat, max_lon, max_lat = bbox_wgs84

            # Validate coordinates are within Netherlands WGS84 bounds
            # Netherlands approximate WGS84 bounds: 3.3-7.2E, 50.7-53.6N
            if not (3.3 <= min_lon <= 7.2 and 3.3 <= max_lon <= 7.2 and
                    50.7 <= min_lat <= 53.6 and 50.7 <= max_lat <= 53.6):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bbox coordinates are outside Netherlands bounds",
                )

            # Validate min < max
            if min_lon >= max_lon or min_lat >= max_lat:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid bbox: min coordinates must be less than max",
                )

            # Convert WGS84 -> RD New (EPSG:28992)
            minx, miny, maxx, maxy = transform_bbox_to_rd(
                min_lon, min_lat, max_lon, max_lat
            )

            # Validate area using shapely (RD New is conformal, area accurate in m²)
            bbox_geom = box(minx, miny, maxx, maxy)
            area_m2 = bbox_geom.area
            MAX_AREA = 500_000_000  # 500 km² (allows all Dutch gemeentes)

            if area_m2 > MAX_AREA:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Scan area {area_m2 / 1_000_000:.1f} km² exceeds maximum of 500 km². "
                        "Selecteer een kleiner gebied."
                    ),
                )

            bbox = {
                "minx": minx,
                "miny": miny,
                "maxx": maxx,
                "maxy": maxy,
            }
        else:
            # Fall back to gemeente bbox (existing logic)
            try:
                bbox = await get_gemeente_bbox(scan_request.gemeente_code, http_client)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid gemeente: {e}",
                ) from e

        # Optional explicit project linkage (used by project-detail scan trigger).
        target_project_id = scan_request.project_id
        if target_project_id is not None:
            project_result = await db.execute(
                select(Project).where(
                    Project.id == target_project_id,
                    Project.organization_id == organization_id,
                ).limit(1)
            )
            project = project_result.scalar_one_or_none()
            if project is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Project not found",
                )

        # Check for existing scan with matching bbox
        existing_scan = await service.get_existing_scan(
            gemeente_code=scan_request.gemeente_code,
            bbox=bbox,
            project_id=target_project_id,
            session=db,
        )

        # If existing scan found and not forcing rescan, return existing
        if existing_scan and not scan_request.force_rescan:
            days_old = (datetime.utcnow() - existing_scan.created_at).days
            needs_rescan = days_old > 30

            return ScanResponse(
                scan_id=existing_scan.id,
                status="existing",
                gemeente_naam=existing_scan.gemeente_naam,
                gemeente_code=existing_scan.gemeente_code,
                scan_date=existing_scan.created_at,
                needs_rescan=needs_rescan,
                message=f"Scan from {existing_scan.created_at.strftime('%Y-%m-%d')} already exists. Use force_rescan=true to re-scan.",
            )

        # If existing scan and force_rescan, reset the scan
        if existing_scan and scan_request.force_rescan:
            scan = await service.reset_scan_for_rescan(existing_scan, db)
        else:
            # Create new scan record
            scan = await service.create_scan(
                gemeente_code=scan_request.gemeente_code,
                gemeente_naam=scan_request.gemeente_naam,
                bbox=bbox,
                session=db,
                wijk_naam=scan_request.wijk_naam,
                project_id=target_project_id,
                organization_id=organization_id,
            )

        # Enqueue ARQ job
        arq_pool = request.app.state.arq_pool
        job = await arq_pool.enqueue_job(
            "area_scan_job",
            str(scan.id),
            str(organization_id),
        )

        # Store job_id in scan record
        scan.job_id = job.job_id
        db.add(scan)
        await db.flush()
        await db.commit()

        return ScanResponse(
            scan_id=scan.id,
            status="pending",
            gemeente_naam=scan.gemeente_naam,
            gemeente_code=scan.gemeente_code,
            scan_date=scan.created_at,
            needs_rescan=False,
            message="Scan started successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to trigger scan")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger scan: {e}",
        ) from e


# --- Static path routes MUST come before /{scan_id} to avoid UUID parsing ---
# Include sub-routers with static paths (/wijken, /parcels/*) before dynamic routes.

from app.scans.parcels_router import router as parcels_router
from app.scans.results_router import router as results_router

router.include_router(parcels_router)


# --- Dynamic path routes (/{scan_id}) ---


@router.get("/{scan_id}", response_model=ScanStatusResponse)
@limiter.limit("60/minute")
async def get_scan_status(
    request: Request,
    scan_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ScanStatusResponse:
    """
    Poll scan status and progress.

    Returns real-time scan progress including percentage complete, current phase,
    parcel counts, and number of results created. Used by frontend for polling.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        scan_id: Scan UUID to poll
        current_user: Authenticated user
        db: Database session

    Returns:
        ScanStatusResponse: Full scan status with progress info

    Raises:
        HTTPException 404: Scan not found
    """
    # Get scan by ID with multi-tenant isolation
    scan = await service.get_scan_by_id(scan_id, db)

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    # Count results created so far
    count_query = select(func.count()).select_from(ScanResult).where(
        ScanResult.scan_id == scan_id,
    )
    result = await db.execute(count_query)
    results_count = result.scalar() or 0

    return ScanStatusResponse(
        scan_id=scan.id,
        status=scan.status,
        progress_pct=scan.progress_pct,
        current_phase=scan.current_phase,
        parcels_total=scan.parcels_total,
        parcels_processed=scan.parcels_processed,
        parcels_failed=scan.parcels_failed,
        results_count=results_count,
        started_at=scan.started_at,
        completed_at=scan.completed_at,
    )


@router.post("/{scan_id}/cancel")
@limiter.limit("10/minute")
async def cancel_scan(
    request: Request,
    scan_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a running scan.

    Aborts the ARQ background job for a running scan. The job's CancelledError
    handler (from 20-04) will update the scan status to 'cancelled' and preserve
    any parcels already processed.

    Requires JWT authentication. Rate limited to 10 requests per minute.

    Args:
        request: FastAPI request object
        scan_id: Scan UUID to cancel
        current_user: Authenticated user
        db: Database session

    Returns:
        dict: Cancellation confirmation message

    Raises:
        HTTPException 404: Scan not found
        HTTPException 400: Scan is not running
    """
    # Get scan by ID with multi-tenant isolation
    scan = await service.get_scan_by_id(scan_id, db)

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    if scan.status != "running":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scan is not running (current status: {scan.status})",
        )

    # Abort ARQ job
    arq_pool = request.app.state.arq_pool
    job = Job(scan.job_id, arq_pool)
    await job.abort()

    return {
        "message": "Scan cancellation requested",
        "scan_id": str(scan_id),
    }


# Results router has /{scan_id}/* paths — safe to include after /{scan_id} since
# they always have additional path segments beyond the UUID.
router.include_router(results_router)
