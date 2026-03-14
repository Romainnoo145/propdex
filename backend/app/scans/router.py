"""Scan management API endpoints."""

import json
import logging
import re
import uuid
from datetime import datetime, timedelta

import httpx
from arq.jobs import Job
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response, StreamingResponse
from shapely.geometry import Point, box, shape
from sqlalchemy import func, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.government_apis.base import GovernmentAPIError
from app.government_apis.pdok_cadastral import PDOKCadastralClient
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.government_apis.sru_bekendmakingen import sru_client
from app.middleware.rate_limit import limiter
from app.models.change_record import ChangeRecord
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.models.user import User
from app.scans import service
from app.scans.schemas import (
    ParcelAtPointResponse,
    ParcelCentroidResponse,
    ParcelEnrichmentResponse,
    ParcelRiskProfileResponse,
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
from app.services.funda_listing_ingestion import build_funda_listing_signal_map
from app.services.gemeente_service import get_gemeente_bbox
from app.services.parcel_addressing import (
    find_bag_building_lookup_point,
    reverse_geocode_rd_point,
)
from app.services.parcel_scoring import (
    compute_vacancy_confidence,
    extract_building_metrics,
)
from app.services.spatial_helpers import transform_bbox_to_rd, transform_point_to_wgs84
from app.services.wijk_service import get_wijken_in_gemeente

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scans", tags=["scans"])

pdok_cadastral_client = PDOKCadastralClient()


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


def _is_missing_address(address: str | None) -> bool:
    """Return True when address is null/empty/placeholder-like."""
    if not isinstance(address, str):
        return True
    normalized = address.strip().lower()
    return normalized in {"", "onbekend", "unknown", "none", "null", "-"}


def _extract_first_coordinate_pair(geometry: dict | None) -> tuple[float, float] | None:
    """
    Extract first coordinate pair from GeoJSON geometry coordinates.

    Works for Point/LineString/Polygon/Multi* by descending into nested arrays.
    """
    if not isinstance(geometry, dict):
        return None
    node = geometry.get("coordinates")
    while isinstance(node, (list, tuple)) and len(node) > 0:
        if (
            len(node) >= 2
            and isinstance(node[0], (int, float))
            and isinstance(node[1], (int, float))
        ):
            return float(node[0]), float(node[1])
        node = node[0]
    return None


def _geometry_looks_wgs84(geometry: dict | None) -> bool:
    """Best-effort CRS detection for GeoJSON: True when first coord looks like lon/lat."""
    pair = _extract_first_coordinate_pair(geometry)
    if pair is None:
        return False
    x, y = pair
    return -180 <= x <= 180 and -90 <= y <= 90


async def _resolve_pdok_cadastral_parcel_at_rd(
    *,
    x_rd: float,
    y_rd: float,
    db: AsyncSession,
) -> dict | None:
    """
    Resolve containing PDOK cadastral parcel for an RD point.

    Returns normalized payload with RD geometry + WGS84 geometry and display metadata.
    """
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            pdok_features = await pdok_cadastral_client.get_parcels_by_point(
                x=x_rd,
                y=y_rd,
                client=client,
                distance=3.0,
            )
    except Exception as e:
        logger.debug("PDOK cadastral lookup failed at RD point (%s,%s): %s", x_rd, y_rd, e)
        return None

    click_point_rd = Point(float(x_rd), float(y_rd))
    click_lng, click_lat = transform_point_to_wgs84(float(x_rd), float(y_rd))
    click_point_wgs84 = Point(click_lng, click_lat)
    selected_feature: dict | None = None
    selected_shape = None
    selected_is_wgs84: bool | None = None
    fallback_feature: dict | None = None
    fallback_shape = None
    fallback_is_wgs84: bool | None = None

    for feature in pdok_features:
        if not isinstance(feature, dict):
            continue
        geometry_candidate = feature.get("geometry")
        if not isinstance(geometry_candidate, dict):
            continue
        try:
            geom_shape = shape(geometry_candidate)
        except Exception:
            continue
        if geom_shape.is_empty:
            continue
        geometry_is_wgs84 = _geometry_looks_wgs84(geometry_candidate)
        test_point = click_point_wgs84 if geometry_is_wgs84 else click_point_rd
        if fallback_feature is None:
            fallback_feature = feature
            fallback_shape = geom_shape
            fallback_is_wgs84 = geometry_is_wgs84
        if geom_shape.contains(test_point) or geom_shape.touches(test_point):
            selected_feature = feature
            selected_shape = geom_shape
            selected_is_wgs84 = geometry_is_wgs84
            break

    if selected_feature is None and fallback_feature is not None:
        selected_feature = fallback_feature
        selected_shape = fallback_shape
        selected_is_wgs84 = fallback_is_wgs84

    if selected_feature is None or selected_shape is None:
        return None

    geometry_raw = selected_feature.get("geometry")
    if not isinstance(geometry_raw, dict):
        return None

    source_srid = 4326 if bool(selected_is_wgs84) else 28992
    geometry_rd = None
    geometry_wgs84 = None
    try:
        source_geom_expr = func.ST_SetSRID(
            func.ST_GeomFromGeoJSON(json.dumps(geometry_raw)),
            source_srid,
        )
        transformed_row = (
            await db.execute(
                select(
                    func.ST_AsGeoJSON(func.ST_Transform(source_geom_expr, 28992)).label(
                        "geometry_rd"
                    ),
                    func.ST_AsGeoJSON(func.ST_Transform(source_geom_expr, 4326)).label(
                        "geometry_wgs84"
                    ),
                )
            )
        ).mappings().one_or_none()
        if transformed_row is not None:
            geometry_rd_raw = transformed_row.get("geometry_rd")
            geometry_wgs84_raw = transformed_row.get("geometry_wgs84")
            if isinstance(geometry_rd_raw, str) and geometry_rd_raw.strip():
                parsed_rd = json.loads(geometry_rd_raw)
                if isinstance(parsed_rd, dict):
                    geometry_rd = parsed_rd
            if isinstance(geometry_wgs84_raw, str) and geometry_wgs84_raw.strip():
                parsed_wgs84 = json.loads(geometry_wgs84_raw)
                if isinstance(parsed_wgs84, dict):
                    geometry_wgs84 = parsed_wgs84
    except Exception as e:
        logger.debug("Failed to transform PDOK parcel geometry to WGS84: %s", e)

    if geometry_wgs84 is None and bool(selected_is_wgs84):
        geometry_wgs84 = geometry_raw
    if geometry_rd is None and not bool(selected_is_wgs84):
        geometry_rd = geometry_raw

    props = selected_feature.get("properties", {})
    parcel_code = None
    area_m2 = None
    if isinstance(props, dict):
        municipality_name = props.get("kadastrale_gemeente_waarde")
        section = props.get("sectie")
        number = props.get("perceelnummer")
        if (
            isinstance(municipality_name, str)
            and municipality_name.strip()
            and isinstance(section, str)
            and section.strip()
            and number is not None
        ):
            parcel_code = f"{municipality_name.strip()} {section.strip()} {number}"
        else:
            identificatie = props.get("identificatie")
            if isinstance(identificatie, str) and identificatie.strip():
                parcel_code = identificatie.strip()

        raw_size = props.get("kadastrale_grootte_waarde")
        if isinstance(raw_size, (int, float)):
            area_m2 = float(raw_size)
        elif isinstance(raw_size, str):
            try:
                area_m2 = float(raw_size.replace(",", "."))
            except ValueError:
                area_m2 = None

    centroid = selected_shape.centroid
    if bool(selected_is_wgs84):
        centroid_wgs84 = (float(centroid.x), float(centroid.y))
    else:
        centroid_wgs84 = transform_point_to_wgs84(float(centroid.x), float(centroid.y))

    return {
        "geometry_rd": geometry_rd,
        "geometry_wgs84": geometry_wgs84,
        "parcel_code": parcel_code,
        "area_m2": area_m2,
        "centroid_wgs84": centroid_wgs84,
    }


async def _resolve_parcel_address_from_centroid(
    *,
    request: Request,
    db: AsyncSession,
    organization_id: uuid.UUID,
    parcel_id: uuid.UUID,
    current_address: str | None,
    centroid_rd_wkt: str | None = None,
) -> str | None:
    """
    Best-effort address resolution tied to actual BAG building overlap.

    This intentionally avoids parcel-centroid reverse geocoding for empty
    parcels, because that assigns a neighbor's house address to undeveloped land.
    """
    try:
        http_client = getattr(request.app.state, "http_client", None)
        if not isinstance(http_client, httpx.AsyncClient):
            return current_address

        parcel_row = (
            await db.execute(
                select(
                    ParcelCache.has_pand,
                    func.ST_AsGeoJSON(ParcelCache.geometry).label("geometry_raw"),
                ).where(
                    ParcelCache.id == parcel_id,
                    ParcelCache.organization_id == organization_id,
                )
            )
        ).mappings().one_or_none()
        if parcel_row is None:
            return current_address

        has_pand = bool(parcel_row.get("has_pand"))
        if not has_pand:
            if not _is_missing_address(current_address):
                await db.execute(
                    sa_update(ParcelCache)
                    .where(
                        ParcelCache.id == parcel_id,
                        ParcelCache.organization_id == organization_id,
                    )
                    .values(address=None)
                )
                await db.commit()
            return None

        if not _is_missing_address(current_address):
            return current_address

        geometry_raw = parcel_row.get("geometry_raw")
        if not isinstance(geometry_raw, str) or not geometry_raw.strip():
            return current_address
        try:
            parcel_geometry = json.loads(geometry_raw)
        except json.JSONDecodeError:
            return current_address
        if not isinstance(parcel_geometry, dict):
            return current_address

        lookup_point = await find_bag_building_lookup_point(parcel_geometry, http_client)
        if lookup_point is None:
            return current_address

        normalized_address = await reverse_geocode_rd_point(lookup_point, http_client)
        if not normalized_address:
            return current_address

        await db.execute(
            sa_update(ParcelCache)
            .where(
                ParcelCache.id == parcel_id,
                ParcelCache.organization_id == organization_id,
            )
            .values(address=normalized_address)
        )
        await db.commit()
        return normalized_address
    except Exception as e:
        logger.debug(
            "Reverse geocode fallback failed for parcel %s: %s",
            parcel_id,
            e,
        )
        return current_address


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


def _extract_listing_signal_from_enrichment(enrichment_data: dict | None) -> dict | None:
    """Extract normalized listing signal from optional enrichment payload."""
    if not isinstance(enrichment_data, dict):
        return None

    # Preferred explicit block if present.
    listing = enrichment_data.get("listing_signal")
    if isinstance(listing, dict):
        return listing

    # Backward-compatible flattening from top-level keys.
    duration = (
        enrichment_data.get("listing_duration_days")
        or enrichment_data.get("listing_days_on_market")
        or enrichment_data.get("days_on_market")
    )
    price_changes = (
        enrichment_data.get("price_change_count")
        or enrichment_data.get("listing_price_change_count")
    )

    if duration is None and price_changes is None:
        return None

    return {
        "listing_duration_days": duration,
        "price_change_count": price_changes,
    }


def _normalize_market_signals(raw: object) -> dict[str, int] | None:
    if not isinstance(raw, dict):
        return None
    known_keys = (
        "listing_duration_days",
        "price_change_count",
        "listing_snapshots_count",
        "days_since_last_seen",
    )
    if not any(key in raw for key in known_keys):
        return None

    def _to_non_negative_int(value: object) -> int:
        if isinstance(value, bool):
            return 1 if value else 0
        if isinstance(value, int):
            return max(0, value)
        if isinstance(value, float):
            if value != value:
                return 0
            return max(0, int(value))
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return 0
            try:
                return max(0, int(float(stripped)))
            except ValueError:
                return 0
        return 0

    return {
        "listing_duration_days": _to_non_negative_int(raw.get("listing_duration_days")),
        "price_change_count": _to_non_negative_int(raw.get("price_change_count")),
        "listing_snapshots_count": _to_non_negative_int(raw.get("listing_snapshots_count")),
        "days_since_last_seen": _to_non_negative_int(raw.get("days_since_last_seen")),
    }


async def _build_permit_activity_map(
    parcel_ids: list[uuid.UUID],
    organization_id: uuid.UUID,
    db: AsyncSession,
) -> dict[uuid.UUID, dict[str, int]]:
    """Aggregate permit activity per parcel for vacancy confidence modeling."""
    if not parcel_ids:
        return {}

    now = datetime.utcnow()
    cutoff_180d = now - timedelta(days=180)
    cutoff_365d = now - timedelta(days=365)
    cutoff_730d = now - timedelta(days=730)

    rows = await db.execute(
        select(
            ChangeRecord.matched_parcel_id,
            ChangeRecord.change_date,
            ChangeRecord.title,
        ).where(
            ChangeRecord.organization_id == organization_id,
            ChangeRecord.change_type == "permit",
            ChangeRecord.matched_parcel_id.in_(parcel_ids),
            ChangeRecord.change_date >= cutoff_730d,
        )
    )

    activity: dict[uuid.UUID, dict[str, int]] = {}
    for matched_parcel_id, change_date, title in rows.all():
        if matched_parcel_id is None or change_date is None:
            continue

        stats = activity.setdefault(
            matched_parcel_id,
            {
                "permit_count_180d": 0,
                "permit_count_365d": 0,
                "permit_count_730d": 0,
                "demolition_count_365d": 0,
                "granted_count_365d": 0,
            },
        )
        stats["permit_count_730d"] += 1

        normalized_date = (
            change_date.replace(tzinfo=None)
            if getattr(change_date, "tzinfo", None) is not None
            else change_date
        )
        lower_title = (title or "").lower()

        if normalized_date >= cutoff_365d:
            stats["permit_count_365d"] += 1

            if any(token in lower_title for token in ("sloop", "slopen", "gesloopt")):
                stats["demolition_count_365d"] += 1

            if any(token in lower_title for token in ("verleend", "vergunning verleend")):
                stats["granted_count_365d"] += 1

        if normalized_date >= cutoff_180d:
            stats["permit_count_180d"] += 1

    return activity


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

    # --- Flags-first lookup: check scan_results.flags for pre-cached enrichment ---
    # After dedup migration, each parcel has exactly one scan_result per org.
    flags_query = (
        select(ScanResult.flags)
        .where(
            ScanResult.organization_id == organization_id,
            ScanResult.parcel_id == parcel_id,
        )
    )
    flags_row = (await db.execute(flags_query)).scalar_one_or_none()
    scan_flags = flags_row if isinstance(flags_row, dict) else {}

    # Extract pre-cached enrichment data from scan flags
    flags_vergunningen = scan_flags.get("vergunningen")
    flags_energielabel = scan_flags.get("energielabel")
    flags_woz = scan_flags.get("woz")
    flags_bodem = scan_flags.get("bodem")
    flags_bodemtype = scan_flags.get("bodemtype")
    flags_funderingsrisico = scan_flags.get("funderingsrisico")
    flags_natura2000 = scan_flags.get("natura2000")
    flags_overstromingsrisico = scan_flags.get("overstromingsrisico")
    flags_geluid = scan_flags.get("geluid")
    flags_luchtkwaliteit = scan_flags.get("luchtkwaliteit")

    # If any enrichment data is pre-cached in flags, return it (even partial)
    # This handles partially-enriched parcels from interrupted backfill runs
    has_any_flags = any(v is not None for v in [
        flags_vergunningen, flags_energielabel, flags_woz, flags_bodem,
        flags_bodemtype, flags_funderingsrisico, flags_natura2000,
        flags_overstromingsrisico, flags_geluid, flags_luchtkwaliteit,
    ])
    if has_any_flags:
        logger.info("Using pre-cached enrichment from scan flags for parcel %s", parcel_id)
        return ParcelEnrichmentResponse(
            parcel_id=parcel.id,
            enrichment_data={
                "vergunningen": (flags_vergunningen.get("records", []) if isinstance(flags_vergunningen, dict) else flags_vergunningen) if flags_vergunningen is not None else [],
                "source_match_mode": "scan_flags",
            },
            enriched_at=parcel.enriched_at,
            is_cached=True,
            energielabel=flags_energielabel,
            woz_data=flags_woz,
            bodem_data=flags_bodem,
            funderingsrisico_data=flags_funderingsrisico,
            natura2000_data=flags_natura2000,
            overstromingsrisico_data=flags_overstromingsrisico,
            geluid_data=flags_geluid,
            luchtkwaliteit_data=flags_luchtkwaliteit,
        )

    logger.debug("No pre-cached enrichment in scan flags for parcel %s, falling back to on-demand", parcel_id)

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


@router.get("/parcels/{parcel_id}/risk-profile", response_model=ParcelRiskProfileResponse)
@limiter.limit("30/minute")
async def get_parcel_risk_profile(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ParcelRiskProfileResponse:
    """
    Fetch fysiek risicoprofiel for a parcel (foundation risk, soil, asbest, contamination).

    Aggregates data from BRO Bodemkaart, PDOK Funderingsrisicogebieden, Bodemloket,
    and bouwjaar-based heuristics into a combined risk profile with amber badges.

    Requires JWT authentication. Rate limited to 30 requests per minute.
    """
    import asyncio
    import re as re_mod

    from geoalchemy2.functions import ST_AsText, ST_Centroid

    from app.schemas.address import BuildingData
    from app.services.asbest_indicator import assess_asbest_risk
    from app.services.bodem_aggregator import fetch_bodem_data
    from app.services.foundation_risk_engine import (
        assess_foundation_risk,
        build_fysiek_risico_profiel,
        estimate_kcaf_cost,
    )
    from app.services.funderingsrisico_aggregator import fetch_funderingsrisico_data
    from app.services.soil_aggregator import fetch_soil_profile

    # Load parcel with centroid (RD coordinates for WMS queries)
    query = select(
        ParcelCache.id,
        ParcelCache.address,
        ParcelCache.bouwjaar,
        ParcelCache.has_pand,
        ParcelCache.area_m2,
        ST_AsText(ST_Centroid(ParcelCache.geometry)).label("centroid_rd_wkt"),
    ).where(
        ParcelCache.id == parcel_id,
        ParcelCache.organization_id == organization_id,
    )
    result = await db.execute(query)
    row = result.mappings().one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parcel not found",
        )

    # Parse RD centroid coordinates
    centroid_wkt = row["centroid_rd_wkt"]
    centroid_match = re_mod.match(r"POINT\(([^ ]+) ([^ ]+)\)", centroid_wkt or "")
    if not centroid_match:
        return ParcelRiskProfileResponse(
            parcel_id=row["id"],
            fysiek_risico_profiel=None,
            is_cached=False,
        )

    x_rd = float(centroid_match.group(1))
    y_rd = float(centroid_match.group(2))

    # --- Flags-first lookup: check scan_results.flags for pre-cached risk data ---
    from app.models.area_scan import AreaScan as AreaScanModel

    risk_flags_query = (
        select(ScanResult.flags)
        .join(AreaScanModel, AreaScanModel.id == ScanResult.scan_id)
        .where(
            ScanResult.organization_id == organization_id,
            ScanResult.parcel_id == parcel_id,
            AreaScanModel.status == "completed",
        )
        .order_by(AreaScanModel.completed_at.desc())
        .limit(1)
    )
    risk_flags_row = (await db.execute(risk_flags_query)).scalar_one_or_none()
    risk_flags = risk_flags_row if isinstance(risk_flags_row, dict) else {}

    cached_bodemtype = risk_flags.get("bodemtype")
    cached_bodem = risk_flags.get("bodem")
    cached_funderingsrisico = risk_flags.get("funderingsrisico")

    # Extract postcode from address for funderingsrisico lookup
    postcode = None
    if row["address"]:
        pc_match = re_mod.search(r"\b(\d{4}\s?[A-Z]{2})\b", row["address"], flags=re_mod.IGNORECASE)
        if pc_match:
            postcode = pc_match.group(1).replace(" ", "").upper()

    # Fetch data sources: use pre-cached flags when available, fall back to on-demand API
    client = request.app.state.http_client

    if cached_bodemtype:
        logger.info("Using pre-cached bodemtype from scan flags for parcel %s", parcel_id)
        soil_profile = cached_bodemtype
    else:
        logger.debug("Fetching bodemtype on-demand (old scan) for parcel %s", parcel_id)
        soil_profile = await fetch_soil_profile(x_rd, y_rd, client, organization_id, db)

    if cached_funderingsrisico:
        logger.info("Using pre-cached funderingsrisico from scan flags for parcel %s", parcel_id)
        funderingsrisico = cached_funderingsrisico
    else:
        logger.debug("Fetching funderingsrisico on-demand (old scan) for parcel %s", parcel_id)
        funderingsrisico = await fetch_funderingsrisico_data(postcode, client, organization_id, db)

    if cached_bodem:
        logger.info("Using pre-cached bodem from scan flags for parcel %s", parcel_id)
        bodem_data = cached_bodem
    else:
        logger.debug("Fetching bodem on-demand (old scan) for parcel %s", parcel_id)
        bodem_data = await fetch_bodem_data(x_rd, y_rd, client, organization_id, db)

    # Build BuildingData for risk heuristics
    building = BuildingData(
        pand_id="",
        bouwjaar=row["bouwjaar"],
        status=None,
        oppervlakte=int(row["area_m2"]) if row["area_m2"] else None,
        gebruiksdoel=[],
    ) if row["has_pand"] or row["bouwjaar"] else None

    # Derive sub-risks
    foundation_risk = assess_foundation_risk(
        building=building,
        soil_profile=soil_profile,
        funderingsrisicogebied=funderingsrisico,
    )

    asbest = assess_asbest_risk(building=building)

    kcaf_cost = estimate_kcaf_cost(
        risk=foundation_risk.risk,
        oppervlakte_m2=int(row["area_m2"]) if row["area_m2"] else None,
    )

    # Build combined profile
    profiel = build_fysiek_risico_profiel(
        foundation_risk=foundation_risk,
        soil_profile=soil_profile,
        asbest_indicator=asbest,
        bodem_data=bodem_data,
        funderingsrisicogebied=funderingsrisico,
        kcaf_cost=kcaf_cost,
    )

    return ParcelRiskProfileResponse(
        parcel_id=row["id"],
        fysiek_risico_profiel=profiel,
        is_cached=True,
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
        ST_AsText(ST_Centroid(ParcelCache.geometry)),
        ParcelCache.address,
        ParcelCache.parcel_id,
        ParcelCache.gemeente_code,
        ParcelCache.area_m2,
        ParcelCache.has_pand,
        ParcelCache.bouwjaar,
        ParcelCache.pand_status,
        ST_AsGeoJSON(ST_Transform(ParcelCache.geometry, 4326)),
    ).where(
        ParcelCache.id == parcel_id,
        ParcelCache.organization_id == organization_id,
    )
    result = await db.execute(query)
    row = result.one_or_none()
    wkt = row[0] if row else None
    centroid_rd_wkt = row[1] if row else None
    address = row[2] if row else None
    parcel_code = row[3] if row else None
    gemeente_code = row[4] if row else None
    area_m2 = row[5] if row else None
    has_pand = row[6] if row else None
    bouwjaar = row[7] if row else None
    pand_status = row[8] if row else None
    geometry_raw = row[9] if row else None

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

    resolved_lng = float(m.group(1))
    resolved_lat = float(m.group(2))
    if isinstance(centroid_rd_wkt, str):
        centroid_rd_match = re_mod.match(r"POINT\(([^ ]+) ([^ ]+)\)", centroid_rd_wkt)
        if centroid_rd_match:
            try:
                x_rd = float(centroid_rd_match.group(1))
                y_rd = float(centroid_rd_match.group(2))
                pdok_parcel = await _resolve_pdok_cadastral_parcel_at_rd(
                    x_rd=x_rd,
                    y_rd=y_rd,
                    db=db,
                )
                if isinstance(pdok_parcel, dict):
                    pdok_geometry = pdok_parcel.get("geometry_wgs84")
                    if isinstance(pdok_geometry, dict):
                        geometry = pdok_geometry
                    pdok_code = pdok_parcel.get("parcel_code")
                    if isinstance(pdok_code, str) and pdok_code.strip():
                        parcel_code = pdok_code
                    pdok_area = pdok_parcel.get("area_m2")
                    if isinstance(pdok_area, (int, float)) and float(pdok_area) > 0:
                        area_m2 = float(pdok_area)
                    pdok_centroid = pdok_parcel.get("centroid_wgs84")
                    if (
                        isinstance(pdok_centroid, tuple)
                        and len(pdok_centroid) == 2
                        and all(isinstance(v, (int, float)) for v in pdok_centroid)
                    ):
                        resolved_lng = float(pdok_centroid[0])
                        resolved_lat = float(pdok_centroid[1])
            except Exception as e:
                logger.debug(
                    "Failed to resolve PDOK centroid geometry for parcel %s: %s",
                    parcel_id,
                    e,
                )

    address = await _resolve_parcel_address_from_centroid(
        request=request,
        db=db,
        organization_id=organization_id,
        parcel_id=parcel_id,
        current_address=address,
        centroid_rd_wkt=centroid_rd_wkt if isinstance(centroid_rd_wkt, str) else None,
    )

    return ParcelCentroidResponse(
        lng=resolved_lng,
        lat=resolved_lat,
        address=address,
        parcel_code=parcel_code,
        gemeente_code=gemeente_code,
        area_m2=area_m2,
        has_pand=bool(has_pand) if isinstance(has_pand, bool) else None,
        bouwjaar=bouwjaar if isinstance(bouwjaar, int) else None,
        pand_status=pand_status if isinstance(pand_status, str) else None,
        geometry=geometry,
    )


@router.get("/parcels/at-point", response_model=ParcelAtPointResponse)
@limiter.limit("120/minute")
async def get_parcel_at_point(
    request: Request,
    lng: float = Query(..., ge=-180, le=180),
    lat: float = Query(..., ge=-90, le=90),
    scan_id: uuid.UUID | None = Query(
        default=None,
        description="Optional scan_id to include scan-specific score/flags for this parcel",
    ),
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ParcelAtPointResponse:
    """Resolve the parcel that intersects a clicked WGS84 map point."""
    from geoalchemy2.functions import ST_AsGeoJSON, ST_AsText, ST_Centroid, ST_Transform

    point_rd = func.ST_Transform(
        func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326),
        28992,
    )

    has_report_subquery = (
        select(func.count(SavedReport.id) > 0)
        .where(
            SavedReport.organization_id == organization_id,
            SavedReport.deleted_at.is_(None),
            SavedReport.source_parcel_id == ParcelCache.id,
        )
        .scalar_subquery()
    )
    # After dedup migration, each parcel has exactly one scan_result per org.
    # Direct lookup — no need for best-scan subquery workaround.
    scan_score_subquery = (
        select(ScanResult.score)
        .where(
            ScanResult.organization_id == organization_id,
            ScanResult.parcel_id == ParcelCache.id,
        )
        .correlate(ParcelCache)
        .scalar_subquery()
    )
    scan_flags_subquery = (
        select(ScanResult.flags)
        .where(
            ScanResult.organization_id == organization_id,
            ScanResult.parcel_id == ParcelCache.id,
        )
        .correlate(ParcelCache)
        .scalar_subquery()
    )

    pdok_geometry_wgs84: dict | None = None
    pdok_parcel_code: str | None = None
    pdok_area_m2: float | None = None
    pdok_centroid_wgs84: tuple[float, float] | None = None
    pdok_geom_rd_expr = None

    try:
        rd_coords = (
            await db.execute(
                select(
                    func.ST_X(point_rd).label("x_rd"),
                    func.ST_Y(point_rd).label("y_rd"),
                )
            )
        ).mappings().one_or_none()

        if rd_coords is not None:
            x_rd = rd_coords.get("x_rd")
            y_rd = rd_coords.get("y_rd")
            if isinstance(x_rd, (int, float)) and isinstance(y_rd, (int, float)):
                pdok_parcel = await _resolve_pdok_cadastral_parcel_at_rd(
                    x_rd=float(x_rd),
                    y_rd=float(y_rd),
                    db=db,
                )
                if isinstance(pdok_parcel, dict):
                    pdok_geometry_rd = pdok_parcel.get("geometry_rd")
                    if isinstance(pdok_geometry_rd, dict):
                        pdok_geom_rd_expr = func.ST_SetSRID(
                            func.ST_GeomFromGeoJSON(json.dumps(pdok_geometry_rd)),
                            28992,
                        )
                    pdok_geometry_wgs84 = pdok_parcel.get("geometry_wgs84")
                    pdok_parcel_code = pdok_parcel.get("parcel_code")
                    pdok_area_m2 = pdok_parcel.get("area_m2")
                    pdok_centroid_wgs84 = pdok_parcel.get("centroid_wgs84")
    except Exception as e:
        logger.debug("PDOK cadastral fallback failed for at-point lookup: %s", e)

    def _build_lookup_query(
        spatial_condition,
        *,
        order_by: list,
    ):
        # Don't filter by scan scope — all cached parcels should be clickable.
        # Scan-specific data (score, flags) is enriched via subqueries, not filtering.
        conditions = [
            ParcelCache.organization_id == organization_id,
            spatial_condition,
        ]

        return (
            select(
                ParcelCache.id.label("parcel_id"),
                ST_AsText(ST_Centroid(ParcelCache.geometry)).label("centroid_rd_wkt"),
                ST_AsText(ST_Transform(ST_Centroid(ParcelCache.geometry), 4326)).label(
                    "centroid_wkt"
                ),
                ParcelCache.address.label("address"),
                ParcelCache.parcel_id.label("parcel_code"),
                ParcelCache.gemeente_code.label("gemeente_code"),
                ParcelCache.area_m2.label("area_m2"),
                ParcelCache.has_pand.label("has_pand"),
                ParcelCache.bouwjaar.label("bouwjaar"),
                ParcelCache.pand_status.label("pand_status"),
                ParcelCache.bestemmingen.label("bestemmingen"),
                has_report_subquery.label("has_report"),
                ST_AsGeoJSON(ST_Transform(ParcelCache.geometry, 4326)).label("geometry_raw"),
                scan_score_subquery.label("scan_score"),
                scan_flags_subquery.label("scan_flags"),
            )
            .where(*conditions)
            .order_by(*order_by)
            .limit(1)
        )

    row = None
    if pdok_geom_rd_expr is not None:
        pdok_query = _build_lookup_query(
            func.ST_Intersects(ParcelCache.geometry, pdok_geom_rd_expr),
            order_by=[
                func.ST_Area(
                    func.ST_Intersection(ParcelCache.geometry, pdok_geom_rd_expr)
                ).desc(),
                func.ST_Distance(ST_Centroid(ParcelCache.geometry), point_rd).asc(),
            ],
        )
        row = (await db.execute(pdok_query)).mappings().one_or_none()

    if row is None:
        fallback_query = _build_lookup_query(
            func.ST_Intersects(ParcelCache.geometry, point_rd),
            order_by=[func.ST_Area(ParcelCache.geometry).asc()],
        )
        row = (await db.execute(fallback_query)).mappings().one_or_none()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parcel not found at point",
        )

    centroid_wkt = row["centroid_wkt"]
    if not isinstance(centroid_wkt, str):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse parcel centroid",
        )
    centroid_match = re.match(r"POINT\(([^ ]+) ([^ ]+)\)", centroid_wkt)
    if not centroid_match:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse centroid",
        )

    geometry = None
    geometry_raw = row.get("geometry_raw")
    if isinstance(geometry_raw, str) and geometry_raw.strip():
        try:
            parsed_geometry = json.loads(geometry_raw)
            if isinstance(parsed_geometry, dict):
                geometry = parsed_geometry
        except json.JSONDecodeError:
            logger.debug(
                "Failed to parse parcel geometry JSON for parcel_id=%s",
                row["parcel_id"],
            )
    if pdok_geometry_wgs84 is not None:
        geometry = pdok_geometry_wgs84

    score = row.get("scan_score")
    score_value = (
        float(score)
        if isinstance(score, (int, float)) and not isinstance(score, bool)
        else None
    )

    score_category = None
    score_breakdown = None
    potentie_score = None
    risico_score = None
    vacancy_signal = None
    vacancy_confidence = None
    vacancy_reasons = None
    vacancy_model_version = None
    opportunity_signals = None
    building_metrics = None
    market_signals = None
    scan_flags = row.get("scan_flags")
    if isinstance(scan_flags, str) and scan_flags.strip():
        try:
            parsed_flags = json.loads(scan_flags)
            scan_flags = parsed_flags if isinstance(parsed_flags, dict) else None
        except json.JSONDecodeError:
            scan_flags = None
    if isinstance(scan_flags, dict):
        raw_category = scan_flags.get("category")
        score_category = raw_category if isinstance(raw_category, str) else None
        raw_vacancy = scan_flags.get("vacancy_signal")
        vacancy_signal = raw_vacancy if isinstance(raw_vacancy, str) else None
        raw_vc = scan_flags.get("vacancy_confidence")
        vacancy_confidence = (
            float(raw_vc)
            if isinstance(raw_vc, (int, float)) and not isinstance(raw_vc, bool)
            else None
        )
        raw_vr = scan_flags.get("vacancy_reasons")
        vacancy_reasons = (
            [str(r) for r in raw_vr] if isinstance(raw_vr, list) else None
        )
        raw_vmv = scan_flags.get("vacancy_model_version")
        vacancy_model_version = raw_vmv if isinstance(raw_vmv, str) else None
        raw_signals = scan_flags.get("opportunity_signals")
        opportunity_signals = (
            [str(s) for s in raw_signals]
            if isinstance(raw_signals, list)
            else None
        )
        raw_metrics = scan_flags.get("building_metrics")
        building_metrics = raw_metrics if isinstance(raw_metrics, dict) else None
        market_signals = _normalize_market_signals(scan_flags.get("market_signals"))

        # v3.0 score extraction: check for score_breakdown with categorie objects
        v3_breakdown = scan_flags.get("score_breakdown")
        if isinstance(v3_breakdown, dict):
            first_val = next(iter(v3_breakdown.values()), None)
            if isinstance(first_val, dict) and "categorie" in first_val:
                # v3.0 format detected
                score_breakdown = v3_breakdown
                v3_scores = scan_flags.get("scores")
                if isinstance(v3_scores, dict):
                    raw_pot = v3_scores.get("potentie")
                    if isinstance(raw_pot, (int, float)) and not isinstance(raw_pot, bool):
                        potentie_score = float(raw_pot)
                    raw_ris = v3_scores.get("risico")
                    if isinstance(raw_ris, (int, float)) and not isinstance(raw_ris, bool):
                        risico_score = float(raw_ris)
            else:
                # Non-v3.0 score_breakdown, treat as legacy
                score_breakdown = v3_breakdown if v3_breakdown else None
        else:
            # v2.1 fallback: factors-based breakdown
            factors = scan_flags.get("factors")
            if isinstance(factors, dict):
                score_breakdown = {"factors": factors}
                raw_subscores = scan_flags.get("subscores")
                if isinstance(raw_subscores, dict):
                    score_breakdown["subscores"] = raw_subscores
                model_version = scan_flags.get("score_model_version")
                if isinstance(model_version, str) and model_version:
                    score_breakdown["model_version"] = model_version
            else:
                legacy_breakdown = {
                    k: v for k, v in scan_flags.items() if k != "category"
                }
                score_breakdown = legacy_breakdown if legacy_breakdown else None

    if building_metrics is None:
        raw_bestemmingen = row.get("bestemmingen")
        if isinstance(raw_bestemmingen, list):
            try:
                derived_metrics = extract_building_metrics(raw_bestemmingen)
                if any(value is not None for value in derived_metrics.values()):
                    building_metrics = derived_metrics
            except Exception:
                logger.debug(
                    "Failed to derive building metrics from bestemmingen for parcel_id=%s",
                    row["parcel_id"],
                )

    resolved_address = await _resolve_parcel_address_from_centroid(
        request=request,
        db=db,
        organization_id=organization_id,
        parcel_id=row["parcel_id"],
        current_address=row["address"],
        centroid_rd_wkt=row.get("centroid_rd_wkt"),
    )

    resolved_area_m2 = row.get("area_m2")
    if isinstance(pdok_area_m2, float) and pdok_area_m2 > 0:
        resolved_area_m2 = pdok_area_m2

    resolved_parcel_code = pdok_parcel_code or row.get("parcel_code")
    resolved_lng = float(centroid_match.group(1))
    resolved_lat = float(centroid_match.group(2))
    if (
        isinstance(pdok_centroid_wgs84, tuple)
        and len(pdok_centroid_wgs84) == 2
        and all(isinstance(v, (int, float)) for v in pdok_centroid_wgs84)
    ):
        resolved_lng = float(pdok_centroid_wgs84[0])
        resolved_lat = float(pdok_centroid_wgs84[1])

    # Derive uses_custom_weights at read time from org settings (not stored per scan_result)
    org_score_weights_row = await db.execute(
        select(Organization.score_weights).where(Organization.id == organization_id)
    )
    org_score_weights = org_score_weights_row.scalar_one_or_none()
    uses_custom_weights = org_score_weights is not None

    return ParcelAtPointResponse(
        parcel_id=row["parcel_id"],
        lng=resolved_lng,
        lat=resolved_lat,
        address=resolved_address,
        parcel_code=resolved_parcel_code,
        gemeente_code=row["gemeente_code"],
        area_m2=resolved_area_m2,
        has_pand=bool(row["has_pand"]),
        bouwjaar=row["bouwjaar"],
        pand_status=row["pand_status"],
        score=score_value,
        score_category=score_category,
        score_breakdown=score_breakdown,
        potentie_score=potentie_score,
        risico_score=risico_score,
        vacancy_signal=vacancy_signal,
        vacancy_confidence=vacancy_confidence,
        vacancy_reasons=vacancy_reasons,
        vacancy_model_version=vacancy_model_version,
        market_signals=market_signals,
        opportunity_signals=opportunity_signals,
        building_metrics=building_metrics,
        bestemmingen=row["bestemmingen"] if isinstance(row["bestemmingen"], list) else None,
        has_report=bool(row["has_report"]),
        uses_custom_weights=uses_custom_weights,
        geometry=geometry,
    )


@router.get("/parcels/{parcel_id}/eigendom")
@limiter.limit("30/minute")
async def get_parcel_eigendom(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """On-demand BRK eigendom lookup for a parcel.

    Resolves ParcelCache UUID to BRK identificatie via PDOK centroid,
    then fetches live ownership data from BRK Bevragen V2.

    CRITICAL: Response is ephemeral — never cached, never stored in database.
    Only request metadata (parcel_id, status) is logged — never BRK payloads.
    """
    from app.schemas.brk_ownership import BRKOwnership
    from app.schemas.property import CadastralParcel
    from app.services.property_aggregator import fetch_brk_ownership

    # 1. Look up ParcelCache, validate org ownership (multi-tenant security)
    result = await db.execute(
        select(ParcelCache.id).where(
            ParcelCache.id == parcel_id,
            ParcelCache.organization_id == current_user.organization_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perceel niet gevonden",
        )

    # 2. Extract centroid in EPSG:28992 using PostGIS
    centroid_result = await db.execute(
        select(
            func.ST_X(func.ST_Centroid(ParcelCache.geometry)),
            func.ST_Y(func.ST_Centroid(ParcelCache.geometry)),
        ).where(ParcelCache.id == parcel_id)
    )
    row = centroid_result.one_or_none()
    if row is None or row[0] is None or row[1] is None:
        return BRKOwnership(
            status="unavailable",
            reason="Kan perceelcentroïde niet bepalen",
        ).model_dump(mode="json")

    x, y = float(row[0]), float(row[1])

    # 3. Resolve BRK identificatie via PDOK cadastral point lookup
    try:
        async with httpx.AsyncClient() as client:
            features = await pdok_cadastral_client.get_parcels_by_point(
                x, y, client, distance=1.0
            )
    except GovernmentAPIError as e:
        logger.warning("PDOK cadastral lookup failed for parcel %s: %s", parcel_id, e.message)
        return BRKOwnership(
            status="error",
            reason="PDOK kadastraal perceel opzoeken mislukt",
        ).model_dump(mode="json")

    if not features:
        logger.info("Eigendom lookup: no PDOK features for parcel %s", parcel_id)
        return BRKOwnership(
            status="unavailable",
            reason="Kadastraal perceel niet gevonden in PDOK",
        ).model_dump(mode="json")

    # 4. Extract identificatie from first matching feature
    identificatie = None
    props = features[0].get("properties", {}) if isinstance(features[0], dict) else {}
    if isinstance(props, dict):
        identificatie = props.get("identificatie")

    if not identificatie:
        logger.info("Eigendom lookup: no identificatie in PDOK response for parcel %s", parcel_id)
        return BRKOwnership(
            status="unavailable",
            reason="Kadastraal perceel identificatie ontbreekt in PDOK",
        ).model_dump(mode="json")

    # 5. Fetch BRK ownership (ephemeral, never stored)
    logger.info("Eigendom lookup: parcel=%s, identificatie=%s", parcel_id, identificatie)
    parcel_obj = CadastralParcel(identificatie=identificatie)
    ownership = await fetch_brk_ownership([parcel_obj])

    return ownership.model_dump(mode="json")


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
    min_score: float | None = Query(None, description="Minimum score threshold"),
    exclude_null_scores: bool = Query(False, description="Exclude parcels with null scores"),
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
        sort_by: Sort field (score/vacancy_subscore/buildability_subscore/area_m2/address/bouwjaar)
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
    rows, total, total_unfiltered = await service.list_scan_results(
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
        min_score=min_score,
        exclude_null_scores=exclude_null_scores,
    )

    parcel_ids = [parcel.id for _, parcel in rows]
    parcels_with_report: set[uuid.UUID] = set()
    if parcel_ids:
        report_rows = await db.execute(
            select(SavedReport.source_parcel_id).where(
                SavedReport.organization_id == organization_id,
                SavedReport.deleted_at.is_(None),
                SavedReport.source_parcel_id.in_(parcel_ids),
            )
        )
        parcels_with_report = {
            value
            for value in report_rows.scalars().all()
            if value is not None
        }
    permit_activity_by_parcel = await _build_permit_activity_map(
        parcel_ids,
        organization_id,
        db,
    )
    listing_signal_by_parcel = await build_funda_listing_signal_map(
        parcel_ids,
        organization_id,
        db,
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
        market_signals = None
        if result.flags:
            score_category_value = result.flags.get("category")
            raw_vacancy = result.flags.get("vacancy_signal")
            raw_signals = result.flags.get("opportunity_signals")
            raw_metrics = result.flags.get("building_metrics")
            raw_market_signals = result.flags.get("market_signals")

            vacancy_signal = raw_vacancy if isinstance(raw_vacancy, str) else None
            opportunity_signals = (
                [str(s) for s in raw_signals]
                if isinstance(raw_signals, list)
                else None
            )
            building_metrics = raw_metrics if isinstance(raw_metrics, dict) else None
            market_signals = _normalize_market_signals(raw_market_signals)

            # v3.0 score extraction: check for score_breakdown with categorie objects
            v3_breakdown = result.flags.get("score_breakdown")
            if isinstance(v3_breakdown, dict):
                first_val = next(iter(v3_breakdown.values()), None)
                if isinstance(first_val, dict) and "categorie" in first_val:
                    score_breakdown = v3_breakdown
                else:
                    score_breakdown = v3_breakdown if v3_breakdown else None
            else:
                # v2.1 fallback
                factors = result.flags.get("factors")
                if isinstance(factors, dict):
                    score_breakdown = {"factors": factors}
                    raw_subscores = result.flags.get("subscores")
                    if isinstance(raw_subscores, dict):
                        score_breakdown["subscores"] = raw_subscores
                    model_version = result.flags.get("score_model_version")
                    if isinstance(model_version, str) and model_version:
                        score_breakdown["model_version"] = model_version
                else:
                    legacy_breakdown = {
                        k: v for k, v in result.flags.items() if k != "category"
                    }
                    score_breakdown = legacy_breakdown if legacy_breakdown else None

        listing_signal = (
            listing_signal_by_parcel.get(parcel.id)
            or _extract_listing_signal_from_enrichment(parcel.enrichment_data)
        )
        if listing_signal:
            market_signals = _normalize_market_signals(listing_signal)
        vacancy_confidence = compute_vacancy_confidence(
            parcel,
            permit_activity=permit_activity_by_parcel.get(parcel.id),
            listing_signal=listing_signal,
        )

        result_items.append(
            ScanResultItem(
                parcel_id=parcel.id,
                parcel_code=parcel.parcel_id,
                address=parcel.address if parcel.has_pand else None,
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
                vacancy_confidence=vacancy_confidence.confidence,
                vacancy_reasons=vacancy_confidence.reasons,
                vacancy_model_version=vacancy_confidence.model_version,
                market_signals=market_signals,
                opportunity_signals=opportunity_signals,
                building_metrics=building_metrics,
                has_report=parcel.id in parcels_with_report,
            )
        )

    return ScanResultsResponse(
        scan_id=scan.id,
        gemeente_naam=scan.gemeente_naam,
        wijk_naam=scan.wijk_naam,
        scan_date=scan.created_at,
        parcels_total=scan.parcels_total,
        total=total,
        total_unfiltered=total_unfiltered,
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
        sort_by: Sort field (score/vacancy_subscore/buildability_subscore/area_m2/address/bouwjaar)
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
        sort_by: Sort field (score/vacancy_subscore/buildability_subscore/area_m2/address)
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
    rows, _total, _unfiltered = await service.list_scan_results(
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


@router.get("/parcels/{parcel_id}/aerial-crop")
@limiter.limit("60/minute")
async def get_aerial_crop(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Return a JPEG aerial image crop centered on the parcel.

    Proxies PDOK WMS Actueel_orthoHR layer, cropped around the parcel centroid.
    Image is 840x360 (retina 2x of 420x180 display) with 24h cache.
    """
    from geoalchemy2.functions import ST_Centroid, ST_X, ST_Y

    query = select(
        ST_X(ST_Centroid(ParcelCache.geometry)),
        ST_Y(ST_Centroid(ParcelCache.geometry)),
    ).where(
        ParcelCache.id == parcel_id,
        ParcelCache.organization_id == organization_id,
    )
    result = await db.execute(query)
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parcel not found",
        )

    cx, cy = float(row[0]), float(row[1])

    # BBOX: centroid +/- 75m width, height scaled to 420x180 aspect ratio (7:3)
    half_w = 75.0
    half_h = 75.0 * 180.0 / 420.0  # ~32.1m
    bbox = f"{cx - half_w},{cy - half_h},{cx + half_w},{cy + half_h}"

    wms_url = "https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0"
    params = {
        "SERVICE": "WMS",
        "VERSION": "1.3.0",
        "REQUEST": "GetMap",
        "LAYERS": "Actueel_orthoHR",
        "STYLES": "",
        "CRS": "EPSG:28992",
        "FORMAT": "image/jpeg",
        "BBOX": bbox,
        "WIDTH": "840",
        "HEIGHT": "360",
    }

    http_client: httpx.AsyncClient = request.app.state.http_client
    try:
        resp = await http_client.get(wms_url, params=params, timeout=10.0)
        resp.raise_for_status()
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        logger.warning("PDOK WMS aerial crop failed for parcel %s: %s", parcel_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Aerial imagery service unavailable",
        ) from exc

    return Response(
        content=resp.content,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )
