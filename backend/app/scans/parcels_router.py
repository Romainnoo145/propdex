"""Parcel-focused API endpoints (wijken, enrichment, centroid, at-point, eigendom, resolve, aerial)."""

import json
import logging
import re
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy import func, literal, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.government_apis.base import GovernmentAPIError
from app.government_apis.pdok_cadastral import PDOKCadastralClient
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.government_apis.sru_bekendmakingen import sru_client
from app.middleware.rate_limit import limiter
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.models.user import User
from app.scans.helpers import (
    _extract_listing_signal_from_enrichment,
    _filter_vergunningen_for_parcel,
    _is_missing_address,
    _normalize_market_signals,
    _resolve_parcel_address_from_centroid,
    _resolve_pdok_cadastral_parcel_at_rd,
)
from app.scans.schemas import (
    ParcelAtPointResponse,
    ParcelCentroidResponse,
    ParcelEnrichmentResponse,
    ParcelRiskProfileResponse,
)
from app.models.report import SavedReport
from app.services.bekendmaking_matcher import find_parcel_at_point
from app.services.parcel_scoring import (
    compute_vacancy_confidence,
    extract_building_metrics,
)
from app.services.spatial_helpers import transform_point_to_wgs84
from app.services.wijk_service import get_wijken_in_gemeente

logger = logging.getLogger(__name__)

router = APIRouter()

pdok_cadastral_client = PDOKCadastralClient()


@router.get("/wijken")
@limiter.limit("30/minute")
async def get_wijken(
    request: Request,
    gemeente_code: str,
    current_user: User = Depends(get_current_active_user),
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
        db: Database session

    Returns:
        ParcelEnrichmentResponse: Enrichment data with cache status

    Raises:
        HTTPException 404: Parcel not found
    """
    # Query ParcelCache by id
    query = select(ParcelCache).where(
        ParcelCache.id == parcel_id,
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
        soil_profile = await fetch_soil_profile(x_rd, y_rd, client, db)

    if cached_funderingsrisico:
        logger.info("Using pre-cached funderingsrisico from scan flags for parcel %s", parcel_id)
        funderingsrisico = cached_funderingsrisico
    else:
        logger.debug("Fetching funderingsrisico on-demand (old scan) for parcel %s", parcel_id)
        funderingsrisico = await fetch_funderingsrisico_data(postcode, client, db)

    if cached_bodem:
        logger.info("Using pre-cached bodem from scan flags for parcel %s", parcel_id)
        bodem_data = cached_bodem
    else:
        logger.debug("Fetching bodem on-demand (old scan) for parcel %s", parcel_id)
        bodem_data = await fetch_bodem_data(x_rd, y_rd, client, db)

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
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ParcelCentroidResponse:
    """Return parcel centroid in WGS84 for map fly-to.

    Accepts either a ParcelCache UUID or a Kadaster parcel_id string
    (e.g. "HTT02-A-1234") or a PDOK parcel_code (e.g. "Venlo I 6658").
    """
    from geoalchemy2.functions import ST_AsGeoJSON, ST_AsText, ST_Centroid, ST_Transform

    columns = (
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
    )

    # Try UUID lookup first, then Kadaster parcel_id, then parcel_code
    row = None
    try:
        parsed_uuid = uuid.UUID(parcel_id)
        result = await db.execute(
            select(*columns).where(ParcelCache.id == parsed_uuid)
        )
        row = result.one_or_none()
    except ValueError:
        pass  # Not a UUID — fall through to string lookups

    if row is None:
        result = await db.execute(
            select(*columns).where(ParcelCache.parcel_id == parcel_id)
        )
        row = result.one_or_none()

    if row is None:
        result = await db.execute(
            select(*columns).where(ParcelCache.parcel_code == parcel_id)
        )
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

    # has_report check: use raw SQL because the model's user_id column may
    # not exist in the DB yet (migration l0_user_scope_models pending).
    has_report_subquery = (
        select(literal(True))
        .select_from(text("saved_reports"))
        .where(
            text("saved_reports.source_parcel_id = parcel_cache.id"),
            text("saved_reports.deleted_at IS NULL"),
        )
        .exists()
        .correlate(ParcelCache)
    )
    # After dedup migration, each parcel has exactly one scan_result per org.
    # Direct lookup — no need for best-scan subquery workaround.
    scan_score_subquery = (
        select(ScanResult.score)
        .where(
            ScanResult.parcel_id == ParcelCache.id,
        )
        .correlate(ParcelCache)
        .scalar_subquery()
    )
    scan_flags_subquery = (
        select(ScanResult.flags)
        .where(
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

    # 1. Look up ParcelCache
    result = await db.execute(
        select(ParcelCache.id).where(
            ParcelCache.id == parcel_id,
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
                coords[0], coords[1], db
            )
            if parcel_id is not None:
                centroid_query = select(
                    ParcelCache.id,
                    ParcelCache.address,
                    ST_AsText(ST_Transform(ST_Centroid(ParcelCache.geometry), 4326)),
                ).where(
                    ParcelCache.id == parcel_id,
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


@router.get("/parcels/{parcel_id}/aerial-crop")
@limiter.limit("60/minute")
async def get_aerial_crop(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
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
