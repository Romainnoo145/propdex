"""Scan management API endpoints."""

import json
import logging
import re
import uuid
from datetime import datetime

import httpx
from arq.jobs import Job
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response, StreamingResponse
from shapely.geometry import box, shape
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.government_apis.base import GovernmentAPIError
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.government_apis.sru_bekendmakingen import sru_client
from app.middleware.rate_limit import limiter
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.models.user import User
from app.scans import service
from app.scans.schemas import (
    ParcelCentroidResponse,
    ParcelEnrichmentResponse,
    ScanCreateRequest,
    ScanListItem,
    ScanListResponse,
    ScanResponse,
    ScanResultItem,
    ScanResultsResponse,
    ScanStatusResponse,
)
from app.services.bekendmaking_matcher import find_parcel_at_point
from app.services.excel_exporter import export_scan_results_to_excel
from app.services.gemeente_service import get_gemeente_bbox
from app.services.spatial_helpers import transform_bbox_to_rd
from app.services.wijk_service import get_wijken_in_gemeente

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scans", tags=["scans"])


def _normalize_area_name(value: str) -> str:
    """Normalize area names for robust matching (wijk names can vary in spacing/apostrophes)."""
    return re.sub(r"\s+", " ", value.casefold().replace("’", "").replace("'", "")).strip()


def _resolve_wijk_bbox_from_geojson(
    geojson: dict,
    wijk_naam: str,
) -> tuple[float, float, float, float] | None:
    """Find wijk geometry by name and return WGS84 bbox (min_lon, min_lat, max_lon, max_lat)."""
    features = geojson.get("features", []) if isinstance(geojson, dict) else []
    if not isinstance(features, list):
        return None

    target = _normalize_area_name(wijk_naam)

    # Exact normalized name match first.
    matched_feature = None
    for feature in features:
        if not isinstance(feature, dict):
            continue
        properties = feature.get("properties", {})
        statnaam = properties.get("statnaam") if isinstance(properties, dict) else None
        if isinstance(statnaam, str) and _normalize_area_name(statnaam) == target:
            matched_feature = feature
            break

    # Fuzzy fallback: allow containment match (e.g., legacy labels/prefixes).
    if matched_feature is None:
        for feature in features:
            if not isinstance(feature, dict):
                continue
            properties = feature.get("properties", {})
            statnaam = properties.get("statnaam") if isinstance(properties, dict) else None
            if not isinstance(statnaam, str):
                continue
            candidate = _normalize_area_name(statnaam)
            if target in candidate or candidate in target:
                matched_feature = feature
                break

    if matched_feature is None:
        return None

    geometry = matched_feature.get("geometry") if isinstance(matched_feature, dict) else None
    if not isinstance(geometry, dict):
        return None

    try:
        min_lon, min_lat, max_lon, max_lat = shape(geometry).bounds
    except Exception:
        return None

    return (min_lon, min_lat, max_lon, max_lat)


def _parse_address_components(address: str | None) -> tuple[str | None, str | None]:
    """Parse simple Dutch street + housenumber from display address."""
    if not address:
        return None, None

    first_part = address.split(",")[0].strip()
    if not first_part:
        return None, None

    # Examples:
    # - "Maasstraat 117"
    # - "Maasstraat 117A"
    # - "Maasstraat 117-1"
    match = re.match(r"^(?P<street>.+?)\s+(?P<number>\d+[A-Za-z]?(?:-\d+)?)$", first_part)
    if not match:
        return first_part.lower(), None

    street = match.group("street").strip().lower()
    number = match.group("number").strip().lower()
    return street, number


def _filter_vergunningen_for_parcel(
    records: list[dict],
    address: str | None,
    postcode: str,
) -> list[dict]:
    """
    Filter postcode-level SRU records down to parcel-level likely matches.

    SRU postcode queries can return many items for the entire postcode area.
    We prioritize precision by matching straat + huisnummer in title where possible.
    """
    street, house_number = _parse_address_components(address)
    postcode_compact = postcode.replace(" ", "").lower()

    # Deduplicate on identifier first.
    deduped: list[dict] = []
    seen_ids: set[str] = set()
    for record in records:
        identifier = str(record.get("identifier") or "").strip()
        key = identifier if identifier else str(record)
        if key in seen_ids:
            continue
        seen_ids.add(key)
        deduped.append(record)

    if not street and not house_number:
        return deduped

    strict_matches: list[dict] = []
    soft_matches: list[dict] = []

    for record in deduped:
        title = str(record.get("title") or "").lower()
        rtype = str(record.get("type") or "").lower()
        text = f"{title} {rtype}"
        text_compact = re.sub(r"\s+", "", text)

        postcode_match = postcode_compact in text_compact
        street_match = bool(street and street in text)
        number_match = bool(
            house_number and
            re.search(rf"\b{re.escape(house_number)}\b", text)
        )

        if street_match and number_match:
            strict_matches.append(record)
        elif number_match and postcode_match:
            soft_matches.append(record)

    if strict_matches:
        return strict_matches
    if soft_matches:
        return soft_matches
    return []


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
            organization_id=organization_id,
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
                organization_id=organization_id,
                gemeente_code=scan_request.gemeente_code,
                gemeente_naam=scan_request.gemeente_naam,
                bbox=bbox,
                session=db,
                wijk_naam=scan_request.wijk_naam,
                project_id=target_project_id,
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

    # Check if enrichment is fresh (< 7 days old).
    # Since 2026-02-25 we require postcode+adres filtering for vergunningen.
    # Legacy cache entries (without source_match_mode) are treated as stale
    # to avoid inflated postcode-level counts.
    if parcel.enriched_at:
        days_old = (datetime.utcnow() - parcel.enriched_at).days
        if days_old < 7:
            cached = parcel.enrichment_data if isinstance(parcel.enrichment_data, dict) else {}
            mode = cached.get("source_match_mode")
            is_legacy_vergunning_cache = (
                "vergunningen" in cached and mode != "postcode+adres"
            )
            if not is_legacy_vergunning_cache:
                return ParcelEnrichmentResponse(
                    parcel_id=parcel.id,
                    enrichment_data=parcel.enrichment_data,
                    enriched_at=parcel.enriched_at,
                    is_cached=True,
                )

    # Enrichment is stale or missing - fetch fresh data

    # Extract postcode from address (pattern: last 7 chars like "1234 AB" or "1234AB")
    postcode = None
    resolved_address = None
    if parcel.address:
        # Find Dutch postcode pattern: 4 digits + optional space + 2 uppercase letters
        match = re.search(r'\b(\d{4}\s?[A-Z]{2})\b', parcel.address, flags=re.IGNORECASE)
        if match:
            # Remove space for SRU query (expects "1234AB" format)
            postcode = match.group(1).replace(' ', '').upper()

    # Fallback: derive an address via centroid reverse geocoding when parcel.address
    # is missing/incomplete and therefore has no postcode.
    if not postcode:
        try:
            from geoalchemy2.functions import ST_AsText, ST_Centroid

            centroid_query = select(
                ST_AsText(ST_Centroid(ParcelCache.geometry))
            ).where(
                ParcelCache.id == parcel.id,
                ParcelCache.organization_id == organization_id,
            )
            centroid_wkt = (await db.execute(centroid_query)).scalar_one_or_none()
            centroid_match = re.match(r"POINT\(([^ ]+) ([^ ]+)\)", centroid_wkt or "")
            if centroid_match:
                rd_x = float(centroid_match.group(1))
                rd_y = float(centroid_match.group(2))
                locatieserver = PDOKLocatieserver()
                resolved_address = await locatieserver.reverse(
                    rd_x, rd_y, request.app.state.http_client
                )
                if resolved_address:
                    reverse_match = re.search(
                        r'\b(\d{4}\s?[A-Z]{2})\b',
                        resolved_address,
                        flags=re.IGNORECASE,
                    )
                    if reverse_match:
                        postcode = reverse_match.group(1).replace(' ', '').upper()
                        parcel.address = resolved_address
        except Exception as e:
            logger.debug(
                "Reverse geocode fallback failed for parcel %s: %s",
                parcel.id,
                e,
            )

    if not postcode:
        if resolved_address and parcel.address != resolved_address:
            parcel.address = resolved_address
            db.add(parcel)
            await db.commit()
        # No postcode extractable - return empty enrichment with note
        return ParcelEnrichmentResponse(
            parcel_id=parcel.id,
            enrichment_data={
                "vergunningen": [],
                "error": "Postcode niet gevonden in adres",
                "source_match_mode": "postcode+adres",
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
        filtered_records = _filter_vergunningen_for_parcel(
            [dict(r) for r in records],
            parcel.address,
            postcode,
        )

        # Store enrichment result
        parcel.enrichment_data = {
            "vergunningen": filtered_records,
            "source_total_postcode_records": len(records),
            "source_match_mode": "postcode+adres",
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


@router.get("/parcels/{parcel_id}/centroid", response_model=ParcelCentroidResponse)
@limiter.limit("60/minute")
async def get_parcel_centroid(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ParcelCentroidResponse:
    """Return parcel centroid in WGS84 for map fly-to."""
    from geoalchemy2.functions import ST_AsGeoJSON, ST_AsText, ST_Centroid, ST_Transform

    query = select(
        ST_AsText(ST_Transform(ST_Centroid(ParcelCache.geometry), 4326)),
        ParcelCache.address,
        ParcelCache.parcel_id,
        ParcelCache.gemeente_code,
        ParcelCache.area_m2,
        ST_AsGeoJSON(ST_Transform(ParcelCache.geometry, 4326)),
    ).where(
        ParcelCache.id == parcel_id,
        ParcelCache.organization_id == organization_id,
    )
    result = await db.execute(query)
    row = result.one_or_none()
    wkt = row[0] if row else None
    address = row[1] if row else None
    parcel_code = row[2] if row else None
    gemeente_code = row[3] if row else None
    area_m2 = row[4] if row else None
    geometry_raw = row[5] if row else None

    if not wkt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parcel not found",
        )

    # Parse "POINT(lng lat)" WKT
    import re as re_mod

    m = re_mod.match(r"POINT\(([^ ]+) ([^ ]+)\)", wkt)
    if not m:
        raise HTTPException(status_code=500, detail="Failed to parse centroid")

    geometry = None
    if isinstance(geometry_raw, str) and geometry_raw.strip():
        try:
            parsed_geometry = json.loads(geometry_raw)
            if isinstance(parsed_geometry, dict):
                geometry = parsed_geometry
        except json.JSONDecodeError:
            logger.debug(
                "Failed to parse parcel geometry JSON for parcel_id=%s",
                parcel_id,
            )

    return ParcelCentroidResponse(
        lng=float(m.group(1)),
        lat=float(m.group(2)),
        address=address,
        parcel_code=parcel_code,
        gemeente_code=gemeente_code,
        area_m2=area_m2,
        geometry=geometry,
    )


@router.get("/parcels/resolve")
@limiter.limit("60/minute")
async def resolve_parcel_by_address(
    request: Request,
    street: str = Query(..., min_length=2),
    huisnummer: int = Query(..., ge=1),
    postcode: str | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Resolve a ParcelCache UUID from address hints for map-focused navigation.

    Heuristic matching over ParcelCache.address for the authenticated organization.
    Returns best-effort match with centroid and address.
    """
    from geoalchemy2.functions import ST_AsText, ST_Centroid, ST_Transform

    normalized_street = street.strip().lower()
    normalized_postcode = (
        postcode.upper().replace(" ", "") if isinstance(postcode, str) and postcode.strip() else None
    )

    base_query = (
        select(
            ParcelCache.id,
            ParcelCache.address,
            ST_AsText(ST_Transform(ST_Centroid(ParcelCache.geometry), 4326)),
        )
        .where(
            ParcelCache.organization_id == organization_id,
            ParcelCache.address.is_not(None),
            func.lower(ParcelCache.address).contains(normalized_street),
        )
    )
    if normalized_postcode:
        base_query = base_query.where(
            func.upper(
                func.regexp_replace(ParcelCache.address, r"\s+", "", "g")
            ).contains(normalized_postcode)
        )

    rows = (await db.execute(base_query.limit(40))).all()

    def _extract_huisnummer(value: str) -> int | None:
        prefix = value.split(",")[0] if "," in value else value
        match = re.search(r"(\d+)", prefix)
        if not match:
            return None
        try:
            return int(match.group(1))
        except ValueError:
            return None

    chosen = None
    if rows:
        exact_matches = [r for r in rows if _extract_huisnummer(r[1] or "") == huisnummer]
        chosen = exact_matches[0] if exact_matches else rows[0]

    if chosen is None:
        # Fallback: geocode exact address and do spatial point-in-parcel.
        locatieserver = PDOKLocatieserver()
        async with httpx.AsyncClient(timeout=20.0) as client:
            coords = await locatieserver.geocode_address(
                street=street,
                huisnummer=huisnummer,
                postcode=normalized_postcode,
                client=client,
            )
        if coords is not None:
            parcel_id = await find_parcel_at_point(
                coords[0], coords[1], organization_id, db
            )
            if parcel_id is not None:
                centroid_query = select(
                    ParcelCache.id,
                    ParcelCache.address,
                    ST_AsText(ST_Transform(ST_Centroid(ParcelCache.geometry), 4326)),
                ).where(
                    ParcelCache.id == parcel_id,
                    ParcelCache.organization_id == organization_id,
                )
                centroid_row = (await db.execute(centroid_query)).one_or_none()
                if centroid_row is not None:
                    chosen = centroid_row

    if chosen is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parcel not found for address",
        )

    wkt = chosen[2]
    wkt_match = re.match(r"POINT\(([^ ]+) ([^ ]+)\)", wkt or "")
    if not wkt_match:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse centroid",
        )

    return {
        "parcel_id": str(chosen[0]),
        "address": chosen[1],
        "lng": float(wkt_match.group(1)),
        "lat": float(wkt_match.group(2)),
    }


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
    search: str | None = None,
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
        search: Free-text search across address, parcel code, status, and bestemming
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
        search=search,
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
        score_breakdown = None
        vacancy_signal = None
        opportunity_signals = None
        building_metrics = None
        if result.flags:
            score_category_value = result.flags.get("category")
            raw_vacancy = result.flags.get("vacancy_signal")
            raw_signals = result.flags.get("opportunity_signals")
            raw_metrics = result.flags.get("building_metrics")

            vacancy_signal = raw_vacancy if isinstance(raw_vacancy, str) else None
            opportunity_signals = (
                [str(s) for s in raw_signals]
                if isinstance(raw_signals, list)
                else None
            )
            building_metrics = raw_metrics if isinstance(raw_metrics, dict) else None

            factors = result.flags.get("factors")
            if isinstance(factors, dict):
                score_breakdown = {"factors": factors}
            else:
                legacy_breakdown = {
                    k: v for k, v in result.flags.items() if k != "category"
                }
                score_breakdown = legacy_breakdown if legacy_breakdown else None

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
                score_breakdown=score_breakdown,
                vacancy_signal=vacancy_signal,
                opportunity_signals=opportunity_signals,
                building_metrics=building_metrics,
            )
        )

    return ScanResultsResponse(
        scan_id=scan.id,
        gemeente_naam=scan.gemeente_naam,
        wijk_naam=scan.wijk_naam,
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
    search: str | None = None,
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
        search: Free-text search across address, parcel code, status, and bestemming
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
        search=search,
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
    if search is not None and search.strip():
        filters_applied["search"] = search.strip()
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
