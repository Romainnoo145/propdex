"""Scan management API endpoints."""

import logging
import re
import uuid
from datetime import datetime

import httpx
from arq.jobs import Job
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response, StreamingResponse
from shapely.geometry import box
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.government_apis.base import GovernmentAPIError
from app.government_apis.sru_bekendmakingen import sru_client
from app.middleware.rate_limit import limiter
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.models.user import User
from app.scans import service
from app.scans.schemas import (
    ParcelEnrichmentResponse,
    ScanCreateRequest,
    ScanListItem,
    ScanListResponse,
    ScanResponse,
    ScanResultItem,
    ScanResultsResponse,
    ScanStatusResponse,
)
from app.services.excel_exporter import export_scan_results_to_excel
from app.services.gemeente_service import get_gemeente_bbox
from app.services.spatial_helpers import transform_bbox_to_rd
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
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScanListResponse:
    """
    List paginated scan history with metadata.

    Returns all scans for the authenticated organization, ordered by most recent
    first. Each scan includes gemeente name, wijk name, date, status, and the
    count of qualifying parcel results.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        offset: Pagination offset (default 0)
        limit: Page size (default 50, max 100)
        status_filter: Optional filter by scan status
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ScanListResponse: Paginated scan list with total count
    """
    limit = min(limit, 100)

    scans, total = await service.list_scans(
        organization_id=organization_id,
        offset=offset,
        limit=limit,
        session=db,
        status_filter=status_filter,
    )

    scan_items = [
        ScanListItem(
            scan_id=scan.id,
            gemeente_naam=scan.gemeente_naam,
            gemeente_code=scan.gemeente_code,
            wijk_naam=scan.wijk_naam,
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
        # Determine bbox first (needed for existing scan matching)
        if scan_request.bbox_wgs84:
            min_lon, min_lat, max_lon, max_lat = scan_request.bbox_wgs84

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
            http_client = request.app.state.http_client
            try:
                bbox = await get_gemeente_bbox(scan_request.gemeente_code, http_client)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid gemeente: {e}",
                ) from e

        # Check for existing scan with matching bbox
        existing_scan = await service.get_existing_scan(
            organization_id=organization_id,
            gemeente_code=scan_request.gemeente_code,
            bbox=bbox,
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
                organization_id=organization_id,
                gemeente_code=scan_request.gemeente_code,
                gemeente_naam=scan_request.gemeente_naam,
                bbox=bbox,
                session=db,
                wijk_naam=scan_request.wijk_naam,
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


@router.get("/wijken")
@limiter.limit("30/minute")
async def get_wijken(
    request: Request,
    gemeente_code: str,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
) -> dict:
    """
    Get wijk (district) boundaries for a gemeente.

    Fetches wijk polygons from CBS gebiedsindelingen WFS and returns them
    as a GeoJSON FeatureCollection. Used by frontend to render clickable
    wijk boundaries when user selects a gemeente for area selection.

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        gemeente_code: CBS gemeentecode (e.g., "0983" for Venlo)
        current_user: Authenticated user
        organization_id: Tenant ID

    Returns:
        dict: GeoJSON FeatureCollection with wijk polygons in EPSG:4326

    Raises:
        HTTPException 404: No wijken found for gemeente
        HTTPException 502: CBS WFS service unavailable
        HTTPException 500: Internal server error
    """
    try:
        # Get shared HTTP client from app state
        http_client = request.app.state.http_client

        # Fetch wijken from CBS WFS
        geojson = await get_wijken_in_gemeente(gemeente_code, http_client)

        return geojson

    except ValueError as e:
        # No wijken found for gemeente
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No wijken found for gemeente {gemeente_code}: {e}",
        ) from e
    except httpx.HTTPError as e:
        # CBS WFS service error
        logger.exception("CBS WFS service error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="CBS WFS service unavailable",
        ) from e
    except Exception as e:
        # Generic error
        logger.exception("Failed to fetch wijken")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch wijken: {e}",
        ) from e


@router.get("/parcels/{parcel_id}/enrich", response_model=ParcelEnrichmentResponse)
@limiter.limit("30/minute")
async def enrich_parcel(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ParcelEnrichmentResponse:
    """
    Fetch on-demand Tier 2 enrichment for a parcel (vergunningen via SRU).

    Returns cached enrichment if available and fresh (< 7 days old).
    Otherwise fetches fresh data from SRU API using parcel postcode.

    Tier 2 enrichment includes:
    - Vergunningen (permits) from Officiele Bekendmakingen SRU

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        parcel_id: ParcelCache UUID
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ParcelEnrichmentResponse: Enrichment data with cache status

    Raises:
        HTTPException 404: Parcel not found
    """
    # Query ParcelCache by id and organization_id (multi-tenant isolation)
    query = select(ParcelCache).where(
        ParcelCache.id == parcel_id,
        ParcelCache.organization_id == organization_id,
    )
    result = await db.execute(query)
    parcel = result.scalar_one_or_none()

    if not parcel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parcel not found",
        )

    # Check if enrichment is fresh (< 7 days old)
    if parcel.enriched_at:
        days_old = (datetime.utcnow() - parcel.enriched_at).days
        if days_old < 7:
            # Return cached enrichment
            return ParcelEnrichmentResponse(
                parcel_id=parcel.id,
                enrichment_data=parcel.enrichment_data,
                enriched_at=parcel.enriched_at,
                is_cached=True,
            )

    # Enrichment is stale or missing - fetch fresh data

    # Extract postcode from address (pattern: last 7 chars like "1234 AB" or "1234AB")
    postcode = None
    if parcel.address:
        # Find Dutch postcode pattern: 4 digits + optional space + 2 uppercase letters
        match = re.search(r'\b(\d{4}\s?[A-Z]{2})\b', parcel.address)
        if match:
            # Remove space for SRU query (expects "1234AB" format)
            postcode = match.group(1).replace(' ', '')

    if not postcode:
        # No postcode extractable - return empty enrichment with note
        return ParcelEnrichmentResponse(
            parcel_id=parcel.id,
            enrichment_data={
                "vergunningen": [],
                "error": "Postcode niet gevonden in adres",
            },
            enriched_at=None,
            is_cached=False,
        )

    # Fetch vergunningen from SRU API
    http_client = request.app.state.http_client

    try:
        records = await sru_client.query_by_postcode(
            postcode=postcode,
            client=http_client,
            max_records=20,
        )

        # Store enrichment result
        parcel.enrichment_data = {
            "vergunningen": [dict(r) for r in records],
        }
        parcel.enriched_at = datetime.utcnow()
        db.add(parcel)
        await db.commit()

        return ParcelEnrichmentResponse(
            parcel_id=parcel.id,
            enrichment_data=parcel.enrichment_data,
            enriched_at=parcel.enriched_at,
            is_cached=False,
        )

    except GovernmentAPIError as e:
        # SRU API error - log and return error in enrichment_data
        logger.warning(f"SRU API error for postcode {postcode}: {e}")
        parcel.enrichment_data = {
            "vergunningen": [],
            "error": f"Kon vergunningen niet ophalen: {e}",
        }
        parcel.enriched_at = datetime.utcnow()
        db.add(parcel)
        await db.commit()

        return ParcelEnrichmentResponse(
            parcel_id=parcel.id,
            enrichment_data=parcel.enrichment_data,
            enriched_at=parcel.enriched_at,
            is_cached=False,
        )


# --- Dynamic path routes (/{scan_id}) ---


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
    pand_status: str | None = None,
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
        pand_status: Filter by building status
        sort_by: Sort field (score/area_m2/address/bouwjaar)
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
        pand_status=pand_status,
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
                bouwjaar=parcel.bouwjaar,
                pand_status=parcel.pand_status,
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
        parcels_total=scan.parcels_total,
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


@router.get("/{scan_id}/export/selection")
@limiter.limit("10/minute")
async def export_selection(
    request: Request,
    scan_id: uuid.UUID,
    parcel_ids: str = Query(..., description="Comma-separated parcel UUIDs"),
    sort_by: str = "score",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Export a user-selected subset of parcels to Excel .xlsx file.

    Accepts a comma-separated list of parcel UUIDs and returns an Excel file
    containing only those parcels. Maximum 500 parcels per export.

    Requires JWT authentication. Rate limited to 10 requests per minute.

    Args:
        request: FastAPI request object
        scan_id: Scan UUID
        parcel_ids: Comma-separated parcel UUIDs to include in export
        sort_by: Sort field (score/area_m2/address/bouwjaar)
        sort_order: Sort direction (asc/desc)
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        StreamingResponse: Excel file download with Content-Disposition header

    Raises:
        HTTPException 400: Invalid UUID format, no IDs provided, or >500 IDs
        HTTPException 404: Scan not found
    """
    # Parse and validate parcel_ids
    try:
        parsed_ids = [
            uuid.UUID(pid.strip())
            for pid in parcel_ids.split(",")
            if pid.strip()
        ]
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid parcel UUID format",
        ) from e

    if len(parsed_ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No parcel IDs provided",
        )

    if len(parsed_ids) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 500 parcels per export",
        )

    # Get scan by ID with multi-tenant isolation
    scan = await service.get_scan_by_id(scan_id, organization_id, db)

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    # Fetch selected results (no pagination -- export all selected)
    rows = await service.list_scan_results_by_ids(
        scan_id=scan_id,
        organization_id=organization_id,
        parcel_ids=parsed_ids,
        sort_by=sort_by,
        sort_order=sort_order,
        session=db,
    )

    # Build filters_applied dict for metadata
    filters_applied = {"selection": f"{len(parsed_ids)} percelen geselecteerd"}

    # Generate Excel file
    excel_buffer = await export_scan_results_to_excel(rows, scan, filters_applied)

    # Generate filename with gemeente name and date
    filename = f"propdex-selectie-{scan.gemeente_naam}-{scan.created_at.strftime('%Y%m%d')}.xlsx"

    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
    pand_status: str | None = None,
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
        pand_status=pand_status,
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
