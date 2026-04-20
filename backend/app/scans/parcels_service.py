"""Parcel business-logic service layer.

Extracted from parcels_router.py — each public function corresponds to one
API endpoint.  Router handlers parse HTTP params, call the service, and
return the result.

All functions follow the project convention:
  async def do_thing(db: AsyncSession, …) -> SomeModel | dict | bytes
  Raises HTTPException on expected client/server errors.
"""

import json
import logging
import re
import uuid
from datetime import datetime

import httpx
from fastapi import HTTPException, status
from sqlalchemy import func, literal, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.base import GovernmentAPIError
from app.government_apis.pdok_cadastral import PDOKCadastralClient
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.government_apis.sru_bekendmakingen import sru_client
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.scans.helpers import (
    _extract_listing_signal_from_enrichment,
    _filter_vergunningen_for_parcel,
    _normalize_market_signals,
    _resolve_parcel_address_from_centroid,
    _resolve_pdok_cadastral_parcel_at_rd,
)
from app.scans.schemas import (
    ParcelAtPointResponse,
    ParcelCentroidResponse,
    ParcelEnrichmentResponse,
    ParcelRiskProfileResponse,
    ScanResultItem,
)
from app.services.bekendmaking_matcher import find_parcel_at_point
from app.services.parcel_addressing import reverse_geocode_rd_point
from app.services.score_v3_factors import _best_bestemming_type
from app.services.parcel_scoring import (
    compute_vacancy_confidence,
    extract_building_metrics,
)

logger = logging.getLogger(__name__)

pdok_cadastral_client = PDOKCadastralClient()


# ---------------------------------------------------------------------------
# Module-level helpers (extracted from closure scopes)
# ---------------------------------------------------------------------------


def _build_lookup_query(
    spatial_condition,
    *,
    order_by: list,
    has_report_subquery,
    scan_score_subquery,
    scan_flags_subquery,
):
    """Build spatial parcel lookup query.

    Previously a closure inside ``get_parcel_at_point``; now receives the
    three subqueries that were captured from the enclosing scope.
    """
    from geoalchemy2.functions import ST_AsGeoJSON, ST_AsText, ST_Centroid, ST_Transform

    conditions = [spatial_condition]
    return (
        select(
            ParcelCache.id.label("parcel_id"),
            ST_AsText(ST_Centroid(ParcelCache.geometry)).label("centroid_rd_wkt"),
            ST_AsText(ST_Transform(ST_Centroid(ParcelCache.geometry), 4326)).label("centroid_wkt"),
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


def _extract_huisnummer(value: str) -> int | None:
    """Extract leading house number from an address string."""
    prefix = value.split(",")[0] if "," in value else value
    match = re.search(r"(\d+)", prefix)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Service functions (one per endpoint)
# ---------------------------------------------------------------------------


async def enrich_parcel(
    db: AsyncSession,
    parcel_id: uuid.UUID,
    http_client: httpx.AsyncClient,
) -> ParcelEnrichmentResponse:
    """Fetch on-demand Tier 2 enrichment for a parcel (vergunningen via SRU).

    Returns cached enrichment if available and fresh (< 7 days old).
    Otherwise fetches fresh data from SRU API using parcel postcode.
    """
    query = select(ParcelCache).where(ParcelCache.id == parcel_id)
    result = await db.execute(query)
    parcel = result.scalar_one_or_none()

    if not parcel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parcel not found",
        )

    # --- Flags-first lookup: check scan_results.flags for pre-cached enrichment ---
    flags_query = select(ScanResult.flags).where(ScanResult.parcel_id == parcel_id)
    flags_row = (await db.execute(flags_query)).scalar_one_or_none()
    scan_flags = flags_row if isinstance(flags_row, dict) else {}

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

    has_any_flags = any(
        v is not None
        for v in [
            flags_vergunningen, flags_energielabel, flags_woz, flags_bodem,
            flags_bodemtype, flags_funderingsrisico, flags_natura2000,
            flags_overstromingsrisico, flags_geluid, flags_luchtkwaliteit,
        ]
    )
    if has_any_flags:
        logger.info("Using pre-cached enrichment from scan flags for parcel %s", parcel_id)
        return ParcelEnrichmentResponse(
            parcel_id=parcel.id,
            enrichment_data={
                "vergunningen": (
                    flags_vergunningen.get("records", [])
                    if isinstance(flags_vergunningen, dict)
                    else flags_vergunningen
                )
                if flags_vergunningen is not None
                else [],
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
    if parcel.enriched_at:
        days_old = (datetime.utcnow() - parcel.enriched_at).days
        if days_old < 7:
            cached = parcel.enrichment_data if isinstance(parcel.enrichment_data, dict) else {}
            mode = cached.get("source_match_mode")
            is_legacy_vergunning_cache = "vergunningen" in cached and mode != "postcode+adres"
            if not is_legacy_vergunning_cache:
                return ParcelEnrichmentResponse(
                    parcel_id=parcel.id,
                    enrichment_data=parcel.enrichment_data,
                    enriched_at=parcel.enriched_at,
                    is_cached=True,
                )

    # Enrichment is stale or missing - fetch fresh data
    postcode = None
    resolved_address = None
    if parcel.address:
        match = re.search(r'\b(\d{4}\s?[A-Z]{2})\b', parcel.address, flags=re.IGNORECASE)
        if match:
            postcode = match.group(1).replace(' ', '').upper()

    # Fallback: derive address via centroid reverse geocoding
    if not postcode:
        try:
            from geoalchemy2.functions import ST_AsText, ST_Centroid

            centroid_query = select(
                ST_AsText(ST_Centroid(ParcelCache.geometry))
            ).where(ParcelCache.id == parcel.id)
            centroid_wkt = (await db.execute(centroid_query)).scalar_one_or_none()
            centroid_match = re.match(r"POINT\(([^ ]+) ([^ ]+)\)", centroid_wkt or "")
            if centroid_match:
                rd_x = float(centroid_match.group(1))
                rd_y = float(centroid_match.group(2))
                locatieserver = PDOKLocatieserver()
                resolved_address = await locatieserver.reverse(rd_x, rd_y, http_client)
                if resolved_address:
                    reverse_match = re.search(
                        r'\b(\d{4}\s?[A-Z]{2})\b', resolved_address, flags=re.IGNORECASE,
                    )
                    if reverse_match:
                        postcode = reverse_match.group(1).replace(' ', '').upper()
                        parcel.address = resolved_address
        except Exception as e:
            logger.debug("Reverse geocode fallback failed for parcel %s: %s", parcel.id, e)

    if not postcode:
        if resolved_address and parcel.address != resolved_address:
            parcel.address = resolved_address
            db.add(parcel)
            await db.commit()
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
    try:
        records = await sru_client.query_by_postcode(
            postcode=postcode, client=http_client, max_records=20,
        )
        filtered_records = _filter_vergunningen_for_parcel(
            [dict(r) for r in records], parcel.address, postcode,
        )

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


async def get_parcel_scan_data(
    db: AsyncSession,
    parcel_id: uuid.UUID,
) -> ScanResultItem:
    """Fetch the latest scan result data for a single parcel (by ParcelCache UUID)."""
    query = (
        select(ScanResult, ParcelCache)
        .join(ParcelCache, ScanResult.parcel_id == ParcelCache.id)
        .where(ScanResult.parcel_id == parcel_id)
    )
    row = (await db.execute(query)).one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="No scan data for this parcel")

    result, parcel = row

    flags = result.flags or {}
    score_breakdown = flags.get("score_breakdown")
    building_metrics = flags.get("building_metrics") if isinstance(flags.get("building_metrics"), dict) else None
    opportunity_signals = flags.get("opportunity_signals", [])

    listing_signal = _extract_listing_signal_from_enrichment(parcel.enrichment_data)
    market_signals = _normalize_market_signals(listing_signal) if listing_signal else None
    vacancy_confidence = compute_vacancy_confidence(
        parcel, permit_activity=None, listing_signal=listing_signal,
    )

    score = result.score
    score_category = (
        "High" if score is not None and score >= 65
        else "Medium" if score is not None and score >= 40
        else "Low" if score is not None
        else None
    )

    potentie_score = None
    risico_score = None
    scores = flags.get("scores")
    if isinstance(scores, dict):
        potentie_score = scores.get("potentie")
        risico_score = scores.get("risico")

    report_q = select(SavedReport.id).where(SavedReport.source_parcel_id == parcel_id).limit(1)
    has_report = (await db.execute(report_q)).scalar_one_or_none() is not None

    return ScanResultItem(
        parcel_id=parcel.id,
        parcel_code=parcel.parcel_id,
        address=parcel.address if parcel.has_pand else None,
        gemeente_code=parcel.gemeente_code,
        area_m2=parcel.area_m2,
        has_pand=parcel.has_pand,
        bouwjaar=parcel.bouwjaar,
        pand_status=parcel.pand_status,
        bestemmingen=parcel.bestemmingen,
        score=score,
        score_category=score_category,
        score_breakdown=score_breakdown,
        potentie_score=potentie_score,
        risico_score=risico_score,
        vacancy_signal=vacancy_confidence.signal.value if hasattr(vacancy_confidence, "signal") else flags.get("vacancy_signal"),
        vacancy_confidence=vacancy_confidence.confidence,
        vacancy_reasons=vacancy_confidence.reasons,
        vacancy_model_version=vacancy_confidence.model_version,
        market_signals=market_signals,
        opportunity_signals=opportunity_signals,
        building_metrics=building_metrics,
        has_report=has_report,
    )


async def get_parcel_risk_profile(
    db: AsyncSession,
    parcel_id: uuid.UUID,
    http_client: httpx.AsyncClient,
) -> ParcelRiskProfileResponse:
    """Fetch fysiek risicoprofiel for a parcel."""
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

    query = select(
        ParcelCache.id,
        ParcelCache.address,
        ParcelCache.bouwjaar,
        ParcelCache.has_pand,
        ParcelCache.area_m2,
        ST_AsText(ST_Centroid(ParcelCache.geometry)).label("centroid_rd_wkt"),
    ).where(ParcelCache.id == parcel_id)
    result = await db.execute(query)
    row = result.mappings().one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parcel not found",
        )

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

    # --- Flags-first lookup ---
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

    postcode = None
    if row["address"]:
        pc_match = re_mod.search(r"\b(\d{4}\s?[A-Z]{2})\b", row["address"], flags=re_mod.IGNORECASE)
        if pc_match:
            postcode = pc_match.group(1).replace(" ", "").upper()

    client = http_client

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

    building = BuildingData(
        pand_id="",
        bouwjaar=row["bouwjaar"],
        status=None,
        oppervlakte=int(row["area_m2"]) if row["area_m2"] else None,
        gebruiksdoel=[],
    ) if row["has_pand"] or row["bouwjaar"] else None

    foundation_risk = assess_foundation_risk(
        building=building, soil_profile=soil_profile, funderingsrisicogebied=funderingsrisico,
    )
    asbest = assess_asbest_risk(building=building)
    kcaf_cost = estimate_kcaf_cost(
        risk=foundation_risk.risk,
        oppervlakte_m2=int(row["area_m2"]) if row["area_m2"] else None,
    )

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


async def get_parcel_centroid(
    db: AsyncSession,
    parcel_id: str,
    *,
    request=None,
) -> ParcelCentroidResponse:
    """Return parcel centroid in WGS84 for map fly-to.

    Accepts either a ParcelCache UUID or a Kadaster parcel_id string
    or a PDOK parcel_code.

    ``request`` is forwarded to ``_resolve_parcel_address_from_centroid``
    which needs it for its ``request.app.state.http_client`` access.
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

    row = None
    try:
        parsed_uuid = uuid.UUID(parcel_id)
        result = await db.execute(select(*columns).where(ParcelCache.id == parsed_uuid))
        row = result.one_or_none()
    except ValueError:
        pass

    if row is None:
        result = await db.execute(select(*columns).where(ParcelCache.parcel_id == parcel_id))
        row = result.one_or_none()

    if row is None:
        result = await db.execute(select(*columns).where(ParcelCache.parcel_code == parcel_id))
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
            logger.debug("Failed to parse parcel geometry JSON for parcel_id=%s", parcel_id)

    resolved_lng = float(m.group(1))
    resolved_lat = float(m.group(2))
    if isinstance(centroid_rd_wkt, str):
        centroid_rd_match = re_mod.match(r"POINT\(([^ ]+) ([^ ]+)\)", centroid_rd_wkt)
        if centroid_rd_match:
            try:
                x_rd = float(centroid_rd_match.group(1))
                y_rd = float(centroid_rd_match.group(2))
                pdok_parcel = await _resolve_pdok_cadastral_parcel_at_rd(x_rd=x_rd, y_rd=y_rd, db=db)
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
                logger.debug("Failed to resolve PDOK centroid geometry for parcel %s: %s", parcel_id, e)

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


async def get_parcel_at_point(
    db: AsyncSession,
    lng: float,
    lat: float,
    organization_id: uuid.UUID,
    *,
    scan_id: uuid.UUID | None = None,
    request=None,
) -> ParcelAtPointResponse:
    """Resolve the parcel that intersects a clicked WGS84 map point.

    ``request`` is forwarded to ``_resolve_parcel_address_from_centroid``.
    """
    from geoalchemy2.functions import ST_AsGeoJSON, ST_AsText, ST_Centroid, ST_Transform

    point_rd = func.ST_Transform(
        func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326), 28992,
    )

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

    scan_score_query = select(ScanResult.score).where(ScanResult.parcel_id == ParcelCache.id)
    scan_flags_query = select(ScanResult.flags).where(ScanResult.parcel_id == ParcelCache.id)
    scan_score_subquery = scan_score_query.correlate(ParcelCache).scalar_subquery()
    scan_flags_subquery = scan_flags_query.correlate(ParcelCache).scalar_subquery()

    pdok_geometry_wgs84: dict | None = None
    pdok_parcel_code: str | None = None
    pdok_area_m2: float | None = None
    pdok_centroid_wgs84: tuple[float, float] | None = None
    pdok_geom_rd_expr = None
    x_rd: float | None = None
    y_rd: float | None = None

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
                    x_rd=float(x_rd), y_rd=float(y_rd), db=db,
                )
                if isinstance(pdok_parcel, dict):
                    pdok_geometry_rd = pdok_parcel.get("geometry_rd")
                    if isinstance(pdok_geometry_rd, dict):
                        pdok_geom_rd_expr = func.ST_SetSRID(
                            func.ST_GeomFromGeoJSON(json.dumps(pdok_geometry_rd)), 28992,
                        )
                    pdok_geometry_wgs84 = pdok_parcel.get("geometry_wgs84")
                    pdok_parcel_code = pdok_parcel.get("parcel_code")
                    pdok_area_m2 = pdok_parcel.get("area_m2")
                    pdok_centroid_wgs84 = pdok_parcel.get("centroid_wgs84")
    except Exception as e:
        logger.debug("PDOK cadastral fallback failed for at-point lookup: %s", e)

    row = None
    if pdok_geom_rd_expr is not None:
        pdok_query = _build_lookup_query(
            func.ST_Intersects(ParcelCache.geometry, pdok_geom_rd_expr),
            order_by=[
                func.ST_Area(func.ST_Intersection(ParcelCache.geometry, pdok_geom_rd_expr)).desc(),
                func.ST_Distance(ST_Centroid(ParcelCache.geometry), point_rd).asc(),
            ],
            has_report_subquery=has_report_subquery,
            scan_score_subquery=scan_score_subquery,
            scan_flags_subquery=scan_flags_subquery,
        )
        row = (await db.execute(pdok_query)).mappings().one_or_none()

    if row is None:
        fallback_query = _build_lookup_query(
            func.ST_Intersects(ParcelCache.geometry, point_rd),
            order_by=[func.ST_Area(ParcelCache.geometry).asc()],
            has_report_subquery=has_report_subquery,
            scan_score_subquery=scan_score_subquery,
            scan_flags_subquery=scan_flags_subquery,
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
            logger.debug("Failed to parse parcel geometry JSON for parcel_id=%s", row["parcel_id"])
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
    scan_flags_val = row.get("scan_flags")
    if isinstance(scan_flags_val, str) and scan_flags_val.strip():
        try:
            parsed_flags = json.loads(scan_flags_val)
            scan_flags_val = parsed_flags if isinstance(parsed_flags, dict) else None
        except json.JSONDecodeError:
            scan_flags_val = None
    if isinstance(scan_flags_val, dict):
        raw_category = scan_flags_val.get("category")
        score_category = raw_category if isinstance(raw_category, str) else None
        raw_vacancy = scan_flags_val.get("vacancy_signal")
        vacancy_signal = raw_vacancy if isinstance(raw_vacancy, str) else None
        raw_vc = scan_flags_val.get("vacancy_confidence")
        vacancy_confidence = (
            float(raw_vc)
            if isinstance(raw_vc, (int, float)) and not isinstance(raw_vc, bool)
            else None
        )
        raw_vr = scan_flags_val.get("vacancy_reasons")
        vacancy_reasons = [str(r) for r in raw_vr] if isinstance(raw_vr, list) else None
        raw_vmv = scan_flags_val.get("vacancy_model_version")
        vacancy_model_version = raw_vmv if isinstance(raw_vmv, str) else None
        raw_signals = scan_flags_val.get("opportunity_signals")
        opportunity_signals = [str(s) for s in raw_signals] if isinstance(raw_signals, list) else None
        raw_metrics = scan_flags_val.get("building_metrics")
        building_metrics = raw_metrics if isinstance(raw_metrics, dict) else None
        market_signals = _normalize_market_signals(scan_flags_val.get("market_signals"))

        v3_breakdown = scan_flags_val.get("score_breakdown")
        if isinstance(v3_breakdown, dict):
            first_val = next(iter(v3_breakdown.values()), None)
            if isinstance(first_val, dict) and "categorie" in first_val:
                score_breakdown = v3_breakdown
                v3_scores = scan_flags_val.get("scores")
                if isinstance(v3_scores, dict):
                    raw_pot = v3_scores.get("potentie")
                    if isinstance(raw_pot, (int, float)) and not isinstance(raw_pot, bool):
                        potentie_score = float(raw_pot)
                    raw_ris = v3_scores.get("risico")
                    if isinstance(raw_ris, (int, float)) and not isinstance(raw_ris, bool):
                        risico_score = float(raw_ris)
            else:
                score_breakdown = v3_breakdown if v3_breakdown else None
        else:
            factors = scan_flags_val.get("factors")
            if isinstance(factors, dict):
                score_breakdown = {"factors": factors}
                raw_subscores = scan_flags_val.get("subscores")
                if isinstance(raw_subscores, dict):
                    score_breakdown["subscores"] = raw_subscores
                model_version = scan_flags_val.get("score_model_version")
                if isinstance(model_version, str) and model_version:
                    score_breakdown["model_version"] = model_version
            else:
                legacy_breakdown = {k: v for k, v in scan_flags_val.items() if k != "category"}
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

    # Live reverse geocode on click RD coords (D046: closest BAG address)
    resolved_address: str | None = None
    if (
        isinstance(x_rd, (int, float))
        and isinstance(y_rd, (int, float))
        and request is not None
        and isinstance(getattr(getattr(request, "app", None), "state", None), object)
    ):
        http_client = getattr(getattr(request, "app", None).state, "http_client", None)
        if isinstance(http_client, httpx.AsyncClient):
            resolved_address = await reverse_geocode_rd_point(
                (float(x_rd), float(y_rd)), http_client,
            )
            logger.debug(
                "Live reverse geocode for click (%s, %s): %s",
                x_rd, y_rd, resolved_address,
            )

    # Fallback: resolve from cached parcel centroid
    if resolved_address is None:
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

    resolved_parcel_code = row.get("parcel_code")
    if pdok_parcel_code and not resolved_parcel_code:
        resolved_parcel_code = pdok_parcel_code

    resolved_lng = float(centroid_match.group(1))
    resolved_lat = float(centroid_match.group(2))
    if (
        isinstance(pdok_centroid_wgs84, tuple)
        and len(pdok_centroid_wgs84) == 2
        and all(isinstance(v, (int, float)) for v in pdok_centroid_wgs84)
    ):
        resolved_lng = float(pdok_centroid_wgs84[0])
        resolved_lat = float(pdok_centroid_wgs84[1])

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
        primary_bestemming_type=(
            _best_bestemming_type({"bestemmingen": row["bestemmingen"]})
            if isinstance(row["bestemmingen"], list) and row["bestemmingen"]
            else None
        ),
        has_report=bool(row["has_report"]),
        uses_custom_weights=uses_custom_weights,
        geometry=geometry,
    )


async def get_parcel_eigendom(
    db: AsyncSession,
    parcel_id: uuid.UUID,
) -> dict:
    """On-demand BRK eigendom lookup for a parcel.

    Response is ephemeral — never cached, never stored in database.
    """
    from app.schemas.brk_ownership import BRKOwnership
    from app.schemas.property import CadastralParcel
    from app.services.property_aggregator import fetch_brk_ownership

    result = await db.execute(
        select(ParcelCache.id).where(ParcelCache.id == parcel_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perceel niet gevonden",
        )

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

    try:
        async with httpx.AsyncClient() as client:
            features = await pdok_cadastral_client.get_parcels_by_point(x, y, client, distance=1.0)
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

    logger.info("Eigendom lookup: parcel=%s, identificatie=%s", parcel_id, identificatie)
    parcel_obj = CadastralParcel(identificatie=identificatie)
    ownership = await fetch_brk_ownership([parcel_obj])

    return ownership.model_dump(mode="json")


async def resolve_parcel_by_address(
    db: AsyncSession,
    street: str,
    huisnummer: int,
    postcode: str | None = None,
) -> dict:
    """Resolve a ParcelCache UUID from address hints for map-focused navigation."""
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

    chosen = None
    exact_address_match = False
    if rows:
        exact_matches = [r for r in rows if _extract_huisnummer(r[1] or "") == huisnummer]
        if exact_matches:
            chosen = exact_matches[0]
            exact_address_match = True

    if chosen is None:
        # No exact huisnummer in our cache → geocode the address and do a
        # spatial lookup, same as Kadastrale Kaart does.  This handles the
        # common case where a parcel has multiple BAG addresses but we only
        # stored one (the reverse-geocode of the pand centroid).
        locatieserver = PDOKLocatieserver()
        async with httpx.AsyncClient(timeout=20.0) as client:
            coords = await locatieserver.geocode_address(
                street=street,
                huisnummer=huisnummer,
                postcode=normalized_postcode,
                client=client,
            )
        if coords is not None:
            parcel_id = await find_parcel_at_point(coords[0], coords[1], db)
            if parcel_id is not None:
                centroid_query = select(
                    ParcelCache.id,
                    ParcelCache.address,
                    ST_AsText(ST_Transform(ST_Centroid(ParcelCache.geometry), 4326)),
                ).where(ParcelCache.id == parcel_id)
                centroid_row = (await db.execute(centroid_query)).one_or_none()
                if centroid_row is not None:
                    chosen = centroid_row

    # Last resort: if geocode failed but DB had rows, pick the first one
    if chosen is None and rows:
        chosen = rows[0]

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

    # When we found the parcel via geocode (not exact address match), the
    # DB address may differ from what the user searched (e.g. "Houtstraat
    # 15A" stored vs user searched "Houtstraat 13" — same parcel, different
    # BAG address on the building).  Return None so the frontend uses the
    # searched address from the PDOK autocomplete suggestion instead.
    display_address = chosen[1] if exact_address_match else None

    return {
        "parcel_id": str(chosen[0]),
        "address": display_address,
        "lng": float(wkt_match.group(1)),
        "lat": float(wkt_match.group(2)),
    }


async def get_aerial_crop(
    db: AsyncSession,
    parcel_id: uuid.UUID,
    http_client: httpx.AsyncClient,
) -> tuple[bytes, str]:
    """Return aerial image crop bytes and media type for a parcel.

    Returns ``(content_bytes, media_type)`` — the router wraps these
    in a ``Response`` object.
    """
    from geoalchemy2.functions import ST_X, ST_Y, ST_Centroid

    query = select(
        ST_X(ST_Centroid(ParcelCache.geometry)),
        ST_Y(ST_Centroid(ParcelCache.geometry)),
    ).where(ParcelCache.id == parcel_id)
    result = await db.execute(query)
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parcel not found",
        )

    cx, cy = float(row[0]), float(row[1])

    half_w = 75.0
    half_h = 75.0 * 180.0 / 420.0
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

    try:
        resp = await http_client.get(wms_url, params=params, timeout=10.0)
        resp.raise_for_status()
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        logger.warning("PDOK WMS aerial crop failed for parcel %s: %s", parcel_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Aerial imagery service unavailable",
        ) from exc

    return resp.content, "image/jpeg"
