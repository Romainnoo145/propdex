"""Scan management API endpoints."""

import uuid

from arq.jobs import Job
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.government_apis.bag_wfs import bag_wfs_client
from app.middleware.rate_limit import limiter
from app.models.scan_result import ScanResult
from app.models.user import User
from app.scans import service
from app.scans.schemas import (
    ScanCreateRequest,
    ScanResponse,
    ScanResultItem,
    ScanResultsResponse,
    ScanStatusResponse,
)
from app.services.excel_exporter import export_scan_results_to_excel
from app.services.gemeente_service import get_gemeente_bbox

router = APIRouter(prefix="/api/scans", tags=["scans"])


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
        organization_id: Tenant ID
        db: Database session

    Returns:
        ScanResponse: Scan status with scan_id

    Raises:
        HTTPException 400: Invalid gemeente or parcel count exceeds limit
        HTTPException 500: Internal server error
    """
    try:
        # Check for existing scan
        existing_scan = await service.get_existing_scan(
            organization_id=organization_id,
            gemeente_code=scan_request.gemeente_code,
            session=db,
        )

        # If existing scan found and not forcing rescan, return existing
        if existing_scan and not scan_request.force_rescan:
            from datetime import datetime

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
            # Fetch gemeente bounding box
            http_client = request.app.state.http_client
            try:
                bbox = await get_gemeente_bbox(scan_request.gemeente_code, http_client)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid gemeente: {e}",
                ) from e

            # Pre-check parcel count (10k limit per SCAN-06)
            parcel_count = await bag_wfs_client.get_pand_count_in_bbox(bbox, http_client)

            if parcel_count > 10000:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Scan would exceed 10,000 parcel limit. Found {parcel_count} parcels in {scan_request.gemeente_naam}.",
                )

            # Create new scan record
            scan = await service.create_scan(
                organization_id=organization_id,
                gemeente_code=scan_request.gemeente_code,
                gemeente_naam=scan_request.gemeente_naam,
                bbox=bbox,
                session=db,
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to trigger scan",
        ) from e


@router.get("/{scan_id}", response_model=ScanStatusResponse)
@limiter.limit("60/minute")
async def get_scan_status(
    request: Request,
    scan_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
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
        organization_id: Tenant ID
        db: Database session

    Returns:
        ScanStatusResponse: Full scan status with progress info

    Raises:
        HTTPException 404: Scan not found
    """
    # Get scan by ID with multi-tenant isolation
    scan = await service.get_scan_by_id(scan_id, organization_id, db)

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    # Count results created so far
    count_query = select(func.count()).select_from(ScanResult).where(
        ScanResult.scan_id == scan_id,
        ScanResult.organization_id == organization_id,
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
    organization_id: uuid.UUID = Depends(get_current_organization_id),
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
        organization_id: Tenant ID
        db: Database session

    Returns:
        dict: Cancellation confirmation message

    Raises:
        HTTPException 404: Scan not found
        HTTPException 400: Scan is not running
    """
    # Get scan by ID with multi-tenant isolation
    scan = await service.get_scan_by_id(scan_id, organization_id, db)

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


@router.get("/{scan_id}/results", response_model=ScanResultsResponse)
@limiter.limit("60/minute")
async def list_results(
    request: Request,
    scan_id: uuid.UUID,
    has_pand: bool | None = None,
    bestemming_type: str | None = None,
    min_area_m2: float | None = None,
    max_area_m2: float | None = None,
    score_category: str | None = None,
    sort_by: str = "score",
    sort_order: str = "desc",
    offset: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScanResultsResponse:
    """
    List paginated scan results with filtering and sorting.

    Returns paginated scan results with server-side filtering by parcel
    characteristics and sorting. Default sort is by score DESC (most promising
    first). Includes score breakdown for transparency.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        scan_id: Scan UUID
        has_pand: Filter by building presence
        bestemming_type: Filter by zoning type substring
        min_area_m2: Minimum parcel area
        max_area_m2: Maximum parcel area
        score_category: Filter by score category (High/Medium/Low)
        sort_by: Sort field (score/area_m2/address)
        sort_order: Sort direction (asc/desc)
        offset: Pagination offset
        limit: Page size (max 100)
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ScanResultsResponse: Paginated results with metadata

    Raises:
        HTTPException 404: Scan not found
    """
    # Validate and cap limit
    limit = min(limit, 100)

    # Get scan by ID with multi-tenant isolation
    scan = await service.get_scan_by_id(scan_id, organization_id, db)

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    # Query results with filters and pagination
    rows, total = await service.list_scan_results(
        scan_id=scan_id,
        organization_id=organization_id,
        has_pand=has_pand,
        bestemming_type=bestemming_type,
        min_area_m2=min_area_m2,
        max_area_m2=max_area_m2,
        score_category=score_category,
        sort_by=sort_by,
        sort_order=sort_order,
        offset=offset,
        limit=limit,
        session=db,
    )

    # Map to ScanResultItem
    result_items = []
    for result, parcel in rows:
        # Extract score_category from flags
        score_category_value = None
        score_breakdown = {}
        if result.flags:
            score_category_value = result.flags.get("category")
            score_breakdown = {k: v for k, v in result.flags.items() if k != "category"}

        result_items.append(
            ScanResultItem(
                parcel_id=parcel.id,
                parcel_code=parcel.parcel_id,
                address=parcel.address,
                gemeente_code=parcel.gemeente_code,
                area_m2=parcel.area_m2,
                has_pand=parcel.has_pand,
                bestemmingen=parcel.bestemmingen,
                score=result.score,
                score_category=score_category_value,
                score_breakdown=score_breakdown if score_breakdown else None,
            )
        )

    return ScanResultsResponse(
        scan_id=scan.id,
        gemeente_naam=scan.gemeente_naam,
        scan_date=scan.created_at,
        total=total,
        offset=offset,
        limit=limit,
        results=result_items,
    )


@router.get("/{scan_id}/tiles/{z}/{x}/{y}.pbf")
@limiter.limit("120/minute")
async def get_scan_tiles(
    request: Request,
    scan_id: uuid.UUID,
    z: int,
    x: int,
    y: int,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Serve MVT vector tiles for scan results with score overlay.

    Generates Mapbox Vector Tiles (MVT) directly from PostGIS using
    ST_AsMVT. Tiles contain parcel geometry, score, and metadata
    filtered by organization_id for multi-tenant isolation.

    Rate limited to 120/minute (map loads trigger many tile requests).

    Returns:
        Response with MVT binary and proper content-type
    """
    scan = await service.get_scan_by_id(scan_id, organization_id, db)
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    from app.services.tile_proxy import generate_mvt_tile

    tile_data = await generate_mvt_tile(
        z=z,
        x=x,
        y=y,
        organization_id=organization_id,
        scan_id=scan_id,
        db=db,
    )

    if tile_data is None:
        return Response(status_code=204)

    return Response(
        content=tile_data,
        media_type="application/vnd.mapbox-vector-tile",
        headers={
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/{scan_id}/export")
@limiter.limit("10/minute")
async def export_results(
    request: Request,
    scan_id: uuid.UUID,
    has_pand: bool | None = None,
    bestemming_type: str | None = None,
    min_area_m2: float | None = None,
    max_area_m2: float | None = None,
    score_category: str | None = None,
    sort_by: str = "score",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Export filtered scan results to Excel .xlsx file.

    Generates a downloadable Excel file containing all results matching the active
    filters (no pagination limit). Includes scan metadata, Dutch column names,
    styled headers, and score transparency columns.

    User decision: .xlsx format (not CSV) as NL/BE real estate developers work in Excel.
    Export respects active filters -- exports what the user sees, not all results.

    Requires JWT authentication. Rate limited to 10 requests per minute.

    Args:
        request: FastAPI request object
        scan_id: Scan UUID
        has_pand: Filter by building presence
        bestemming_type: Filter by zoning type substring
        min_area_m2: Minimum parcel area
        max_area_m2: Maximum parcel area
        score_category: Filter by score category (High/Medium/Low)
        sort_by: Sort field (score/area_m2/address)
        sort_order: Sort direction (asc/desc)
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        StreamingResponse: Excel file download with Content-Disposition header

    Raises:
        HTTPException 404: Scan not found
    """
    # Get scan by ID with multi-tenant isolation
    scan = await service.get_scan_by_id(scan_id, organization_id, db)

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    # Fetch ALL filtered results (no pagination -- export everything)
    rows, _total = await service.list_scan_results(
        scan_id=scan_id,
        organization_id=organization_id,
        has_pand=has_pand,
        bestemming_type=bestemming_type,
        min_area_m2=min_area_m2,
        max_area_m2=max_area_m2,
        score_category=score_category,
        sort_by=sort_by,
        sort_order=sort_order,
        offset=0,
        limit=10000,  # Effectively all (scan limit is 10k parcels)
        session=db,
    )

    # Build filters_applied dict for metadata
    filters_applied = {}
    if has_pand is not None:
        filters_applied["has_pand"] = has_pand
    if bestemming_type is not None:
        filters_applied["bestemming_type"] = bestemming_type
    if min_area_m2 is not None:
        filters_applied["min_area_m2"] = min_area_m2
    if max_area_m2 is not None:
        filters_applied["max_area_m2"] = max_area_m2
    if score_category is not None:
        filters_applied["score_category"] = score_category

    # Generate Excel file
    excel_buffer = await export_scan_results_to_excel(rows, scan, filters_applied)

    # Generate filename with gemeente name and date
    filename = f"propdex-scan-{scan.gemeente_naam}-{scan.created_at.strftime('%Y%m%d')}.xlsx"

    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
