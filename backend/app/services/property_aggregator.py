"""Property data aggregation service with parallel API fetching."""

import asyncio
import logging
import uuid
from datetime import datetime

import httpx
from arq import ArqRedis
from fastapi import HTTPException, status
from shapely.geometry import shape
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas import AIParsingSection
from app.government_apis.base import APINotFoundError, GovernmentAPIError
from app.government_apis.brk_bevragen import brk_client
from app.government_apis.ep_online import ep_online_client
from app.government_apis.pdok_cadastral import PDOKCadastralClient
from app.government_apis.rce_monuments import rd_to_wgs84
from app.government_apis.woz_waardeloket import woz_waardeloket_client
from app.schemas.address import AddressInput
from app.schemas.brk_ownership import BRKOwnership, PerceelOwnership, ZakelijkGerechtigde
from app.schemas.energy_label import EnergyLabel
from app.schemas.monument import MonumentStatus
from app.schemas.property import (
    CadastralParcel,
    DataSourceInfo,
    MapData,
    PropertyReportResponse,
    SectionSourceInfo,
)
from app.schemas.woz import WOZData
from app.schemas.zoning import ZoningData
from app.services.address_resolver import resolve_address
from app.services.cache_manager import get_cached_or_fetch
from app.services.monument_aggregator import fetch_monument_status
from app.services.plan_aggregator import get_or_parse_plan, get_primary_plan_idn
from app.services.zoning_aggregator import fetch_zoning_data

logger = logging.getLogger(__name__)

# Module-level singleton
_cadastral_client = PDOKCadastralClient()


def _extract_rd_coordinates(geometry: dict | None) -> tuple[float, float] | None:
    """
    Extract a robust RD point from BAG GeoJSON geometry.

    Prefer geometric centroid for polygons/multipolygons. This avoids selecting
    an edge vertex (old behavior) that can miss parcel-level DSO intersections.
    """
    if not isinstance(geometry, dict):
        return None

    coordinates_data = geometry.get("coordinates")
    geometry_type = geometry.get("type")

    if geometry_type == "Point" and isinstance(coordinates_data, list) and len(coordinates_data) >= 2:
        try:
            return float(coordinates_data[0]), float(coordinates_data[1])
        except (TypeError, ValueError):
            return None

    try:
        geom = shape(geometry)
        if geom.is_empty:
            return None
        centroid = geom.centroid
        return float(centroid.x), float(centroid.y)
    except Exception:
        # Fallback for malformed polygon payloads.
        if geometry_type == "Polygon" and coordinates_data:
            try:
                first_point = coordinates_data[0][0]
                return float(first_point[0]), float(first_point[1])
            except Exception:
                return None
        return None


def _parse_perceel_ownership(raw: dict, perceel_id: str) -> PerceelOwnership:
    """Parse a single perceel's BRK eigendom response into PerceelOwnership.

    CRITICAL: Never log response payload — only log parse outcome count.
    Extracts gerechtigden (rights holders) and hypotheek indicator from BRK V2 response.

    Args:
        raw: Raw dict from BRK get_eigendom() response
        perceel_id: kadastraalOnroerendeZaakIdentificatie for this perceel

    Returns:
        PerceelOwnership: Parsed ownership data for this perceel
    """
    embedded = raw.get("_embedded", {})
    raw_gerechtigden = embedded.get("zakelijkGerechtigden", [])

    gerechtigden: list[ZakelijkGerechtigde] = []
    heeft_hypotheek = False

    for item in raw_gerechtigden:
        # Determine eigenaar_type from persoon.type
        persoon = item.get("persoon", {})
        persoon_type = persoon.get("type", "")
        if persoon_type == "NatuurlijkPersoon":
            eigenaar_type = "natuurlijk_persoon"
        elif persoon_type == "NietNatuurlijkPersoon":
            eigenaar_type = "rechtspersoon"
        else:
            eigenaar_type = "onbekend"

        # Extract right type
        zakelijk_recht_type = item.get("type")

        # Extract aandeel fraction
        aandeel_data = item.get("aandeel", {})
        aandeel: str | None = None
        if aandeel_data:
            teller = aandeel_data.get("teller")
            noemer = aandeel_data.get("noemer")
            if teller is not None and noemer is not None:
                aandeel = f"{teller}/{noemer}"

        # Check if this is a hypotheek registration
        if zakelijk_recht_type and "Hypotheek" in zakelijk_recht_type:
            heeft_hypotheek = True

        gerechtigden.append(
            ZakelijkGerechtigde(
                eigenaar_type=eigenaar_type,  # type: ignore[arg-type]
                zakelijk_recht_type=zakelijk_recht_type,
                aandeel=aandeel,
            )
        )

    logger.info(
        "BRK parse outcome: perceel=%s, gerechtigden=%d, heeft_hypotheek=%s",
        perceel_id,
        len(gerechtigden),
        heeft_hypotheek,
    )

    return PerceelOwnership(
        perceel_identificatie=perceel_id,
        gerechtigden=gerechtigden,
        heeft_hypotheek=heeft_hypotheek,
    )


# CRITICAL LOGGING REMINDER: Never log BRK response payloads below.
# Only log request metadata (endpoint, perceel ID) and parse outcomes.
# Kadaster Tier 3 terms prohibit storing or logging eigendomsdata.
async def fetch_brk_ownership(
    cadastral_parcels: list[CadastralParcel],
) -> BRKOwnership:
    """Fetch BRK Bevragen V2 ownership for all matching percelen.

    Runs as Step 2b — sequential after Step 2a cadastral fetch completes.
    Requires perceel identificatie from CadastralParcel to look up eigendomsdata.

    Always returns BRKOwnership — never raises, never returns None.
    Uses a single mTLS client for all percelen in this call.

    CRITICAL: Never cache or store this data (Kadaster Tier 3 never-store terms).
    Never log BRK response payloads — only log request metadata and parse outcomes.

    Args:
        cadastral_parcels: Parcels from Step 2a cadastral fetch

    Returns:
        BRKOwnership: Three-state ownership result (available/unavailable/error)
    """
    # Check configuration before attempting fetch
    if not brk_client.is_configured:
        return BRKOwnership(
            status="unavailable",
            reason="BRK Bevragen niet geconfigureerd",
            admin_hint=(
                "Configureer PKIOverheid mTLS-certificaat "
                "(BRK_CLIENT_CERT_PATH, BRK_CLIENT_KEY_PATH, BRK_CA_BUNDLE_PATH) "
                "om eigendomsdata op te vragen."
            ),
        )

    # Extract perceel identificaties — skip parcels without identificatie
    perceel_ids = [
        p.identificatie for p in cadastral_parcels if p.identificatie is not None
    ]
    if not perceel_ids:
        return BRKOwnership(
            status="unavailable",
            reason="Geen kadastraal perceel gevonden voor dit adres",
        )

    fetched_at = datetime.utcnow().isoformat() + "Z"

    try:
        # ONE client for all percelen — avoids repeated SSL handshakes
        async with brk_client.create_client() as client:
            perceel_results: list[PerceelOwnership] = []
            for perceel_id in perceel_ids:
                # CRITICAL: log request metadata only — never log response payload
                logger.info(
                    "BRK fetch: endpoint=zakelijkegerechtigden, perceel=%s",
                    perceel_id,
                )
                raw = await brk_client.get_eigendom(perceel_id, client)
                perceel_results.append(_parse_perceel_ownership(raw, perceel_id))

        return BRKOwnership(
            status="available",
            data=perceel_results,
            fetched_at=fetched_at,
        )

    except GovernmentAPIError as e:
        logger.warning("BRK fetch failed: %s", e.message)
        return BRKOwnership(
            status="error",
            reason=f"BRK Bevragen fout: {e.message}",
        )
    except Exception as e:
        logger.warning("BRK fetch unexpected error: %s", str(e))
        return BRKOwnership(
            status="error",
            reason="Onverwachte fout bij ophalen eigendomsdata",
        )


async def aggregate_property_data(
    input_data: AddressInput,
    client: httpx.AsyncClient,
    organization_id: uuid.UUID,
    session: AsyncSession,
    force_refresh: bool = False,
    arq_pool: ArqRedis | None = None,
) -> PropertyReportResponse:
    """
    Aggregate property data from multiple government APIs with parallel fetching.

    Flow:
    1. Sequential: Resolve address via BAG (MUST succeed)
    2a. Parallel: Fetch cadastral parcels, zoning, monuments, energy label, and WOZ if available
    2b. Sequential: Fetch BRK ownership (requires cadastral identificatie from Step 2a)
    3. Trigger AI bestemmingsplan parsing (always, returns immediately with job status)

    Args:
        input_data: Address input with postcode and house number
        client: Shared httpx AsyncClient
        organization_id: Tenant ID for cache isolation
        session: SQLAlchemy async session for cache operations
        force_refresh: If True, bypass all caches and fetch fresh data
        arq_pool: ARQ Redis pool for job enqueueing (required for AI parsing)

    Returns:
        PropertyReportResponse: Aggregated property data with zoning, monuments, map data, AI parsing, and source attribution

    Raises:
        HTTPException 404: If address not found in BAG
        HTTPException 502: If upstream API fails critically
    """
    logger.info(
        f"Starting property data aggregation for {input_data.postcode} {input_data.huisnummer}"
    )

    data_sources: list[DataSourceInfo] = []
    errors: list[str] = []
    cadastral_parcels: list[CadastralParcel] = []
    zoning_data: ZoningData | None = None
    monument_status: MonumentStatus | None = None

    # STEP 1 (SEQUENTIAL): Resolve address via BAG
    # This MUST succeed - if it fails, we can't continue
    try:
        address_resolution = await resolve_address(
            input_data=input_data,
            client=client,
            organization_id=organization_id,
            session=session,
        )
    except APINotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found in BAG registry",
        ) from e
    except GovernmentAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to resolve address: {e.message}",
        ) from e

    # Add BAG source info (address resolution includes caching internally)
    data_sources.append(
        DataSourceInfo(
            source="BAG API v2",
            is_cached=False,  # Address resolver handles caching internally
        )
    )

    address = address_resolution.address
    building = address_resolution.building

    # STEP 2a (PARALLEL): Fetch parcel/zoning/monuments if we have RD coordinates
    coordinates = _extract_rd_coordinates(building.geometry if building else None)

    # Parallel fetch: cadastral parcels, zoning, and monuments
    async def fetch_cadastral_parcels() -> list[CadastralParcel]:
        """Fetch cadastral parcels if coordinates available."""
        if not coordinates:
            logger.info("No coordinates available, skipping cadastral parcel lookup")
            return []

        x, y = coordinates
        cache_key = f"kadaster:parcel:{x}:{y}"

        try:
            cache_result = await get_cached_or_fetch(
                cache_key=cache_key,
                source="kadaster",
                organization_id=organization_id,
                fetch_fn=lambda: _cadastral_client.get_parcels_by_point(
                    x=x,
                    y=y,
                    client=client,
                    distance=5.0,
                ),
                session=session,
                force_refresh=force_refresh,
            )

            # Add cadastral source info
            data_sources.append(
                DataSourceInfo(
                    source="PDOK Cadastral OGC API",
                    cached_at=cache_result.cached_at,
                    age_seconds=cache_result.age_seconds,
                    is_cached=cache_result.is_cached,
                )
            )

            # Parse cadastral features
            parcels = []
            features = cache_result.data or []
            for feature in features:
                props = feature.get("properties", {})
                geometry = feature.get("geometry")

                # PDOK OGC API field names differ from older WFS
                gemeente = props.get("kadastrale_gemeente_waarde", "")
                sectie = props.get("sectie", "")
                perceelnummer = props.get("perceelnummer")
                perceelnr_str = str(perceelnummer) if perceelnummer is not None else None

                # Construct kadastrale aanduiding: "Venlo M 1722"
                kadastrale_aanduiding = None
                if gemeente and sectie and perceelnummer is not None:
                    kadastrale_aanduiding = f"{gemeente} {sectie} {perceelnummer}"

                parcel = CadastralParcel(
                    identificatie=props.get("identificatie"),
                    kadastrale_aanduiding=kadastrale_aanduiding,
                    perceelnummer=perceelnr_str,
                    sectie=sectie,
                    oppervlakte=props.get("kadastrale_grootte_waarde"),
                    geometry=geometry,
                )
                parcels.append(parcel)

            logger.info(f"Fetched {len(parcels)} cadastral parcels")
            return parcels

        except Exception as e:
            logger.warning(f"Failed to fetch cadastral parcels: {str(e)}")
            errors.append(f"Cadastral data unavailable: {str(e)}")
            return []

    async def fetch_zoning() -> ZoningData | None:
        """Fetch zoning data if coordinates available."""
        if not coordinates:
            return None
        x, y = coordinates
        try:
            return await fetch_zoning_data(
                x=x,
                y=y,
                client=client,
                organization_id=organization_id,
                session=session,
                force_refresh=force_refresh,
            )
        except Exception as e:
            logger.warning(f"Failed to fetch zoning data: {e}")
            errors.append(f"Bestemmingsplan data niet beschikbaar: {str(e)}")
            return None

    async def fetch_monuments() -> MonumentStatus | None:
        """Fetch monument status if coordinates available."""
        if not coordinates:
            return None
        x, y = coordinates
        pand_id = building.pand_id if building else None
        vo_id = address.verblijfsobject_id
        try:
            return await fetch_monument_status(
                x=x,
                y=y,
                pand_id=pand_id,
                verblijfsobject_id=vo_id,
                client=client,
                organization_id=organization_id,
                session=session,
                force_refresh=force_refresh,
            )
        except Exception as e:
            logger.warning(f"Failed to fetch monument data: {e}")
            errors.append(f"Monument data niet beschikbaar: {str(e)}")
            return None

    async def fetch_energy_label() -> EnergyLabel | None:
        """Fetch EP-Online energy label if VBO ID available."""
        vbo_id = address.verblijfsobject_id
        if not vbo_id:
            return None
        cache_key = f"ep_online:label:{vbo_id}"
        try:
            async def _fetch_ep() -> dict:
                label = await ep_online_client.get_by_vbo_id(vbo_id, client)
                return label.model_dump() if label is not None else {}

            cache_result = await get_cached_or_fetch(
                cache_key=cache_key,
                source="ep_online",
                organization_id=organization_id,
                fetch_fn=_fetch_ep,
                session=session,
                force_refresh=force_refresh,
            )
            data = cache_result.data
            return EnergyLabel.model_validate(data) if data else None
        except Exception as e:
            logger.warning(f"Failed to fetch energy label: {e}")
            errors.append(f"Energielabel niet beschikbaar: {str(e)}")
            return None

    async def fetch_woz_data() -> WOZData | None:
        """Fetch WOZ valuation data by nummeraanduiding ID."""
        na_id = address.nummeraanduiding_id
        cache_key = f"woz:waarde:{na_id}"
        try:
            async def _fetch_woz() -> dict:
                woz = await woz_waardeloket_client.get_by_nummeraanduiding_id(na_id, client)
                return woz.model_dump() if woz is not None else {}

            cache_result = await get_cached_or_fetch(
                cache_key=cache_key,
                source="woz",
                organization_id=organization_id,
                fetch_fn=_fetch_woz,
                session=session,
                force_refresh=force_refresh,
            )
            data = cache_result.data
            return WOZData.model_validate(data) if data else None
        except Exception as e:
            logger.warning(f"Failed to fetch WOZ data: {e}")
            errors.append(f"WOZ-waarde niet beschikbaar: {str(e)}")
            return None

    # Execute ALL Step 2a fetches in parallel (5 tasks: cadastral, zoning, monuments, energy_label, woz)
    results = await asyncio.gather(
        fetch_cadastral_parcels(),
        fetch_zoning(),
        fetch_monuments(),
        fetch_energy_label(),
        fetch_woz_data(),
        return_exceptions=True,
    )

    # Process results
    cadastral_result = results[0]
    if isinstance(cadastral_result, Exception):
        logger.error(f"Cadastral fetch failed: {cadastral_result}")
        errors.append(f"Cadastral data fetch failed: {str(cadastral_result)}")
    else:
        cadastral_parcels = cadastral_result

    zoning_result = results[1]
    if isinstance(zoning_result, Exception):
        logger.error(f"Zoning fetch failed: {zoning_result}")
        errors.append(f"Zoning data fetch failed: {str(zoning_result)}")
    else:
        zoning_data = zoning_result

    monument_result = results[2]
    if isinstance(monument_result, Exception):
        logger.error(f"Monument fetch failed: {monument_result}")
        errors.append(f"Monument data fetch failed: {str(monument_result)}")
    else:
        monument_status = monument_result

    energy_label: EnergyLabel | None = None
    energy_label_result = results[3]
    if isinstance(energy_label_result, Exception):
        logger.error(f"Energy label fetch failed: {energy_label_result}")
        errors.append(f"Energielabel fetch failed: {str(energy_label_result)}")
    else:
        energy_label = energy_label_result

    woz_data: WOZData | None = None
    woz_result = results[4]
    if isinstance(woz_result, Exception):
        logger.error(f"WOZ fetch failed: {woz_result}")
        errors.append(f"WOZ data fetch failed: {str(woz_result)}")
    else:
        woz_data = woz_result

    # STEP 2b (SEQUENTIAL): BRK ownership — requires cadastral identificatie from Step 2a
    # NOTE: Never cache BRK data (Kadaster Tier 3). fetch_brk_ownership() always returns,
    # never raises, and never logs BRK response payloads.
    brk_ownership = await fetch_brk_ownership(cadastral_parcels)

    # STEP 3: Trigger AI bestemmingsplan parsing (always)
    ai_parsing_section: AIParsingSection | None = None
    if arq_pool is not None:
        plan_idn = get_primary_plan_idn(zoning_data)
        if plan_idn:
            try:
                ai_parsing_section = await get_or_parse_plan(
                    plan_idn=plan_idn,
                    organization_id=organization_id,
                    session=session,
                    arq_pool=arq_pool,
                )
            except Exception as e:
                logger.warning(f"Failed to trigger AI parsing: {e}")
                ai_parsing_section = AIParsingSection(
                    status="not_available",
                    error_message=f"Bestemmingsplan niet digitaal beschikbaar: {str(e)}",
                )
        else:
            ai_parsing_section = AIParsingSection(
                status="not_available",
                error_message="Geen bestemmingsplan gevonden voor deze locatie",
            )
    else:
        logger.warning("ARQ pool not provided, skipping AI parsing trigger")
        ai_parsing_section = AIParsingSection(
            status="not_available",
            error_message="AI parsing niet beschikbaar",
        )

    # Build MapData with WGS84 coordinate transformation
    map_data: MapData | None = None
    if coordinates:
        x, y = coordinates
        lon, lat = rd_to_wgs84(x, y)
        map_data = MapData(
            center_rd=[x, y],
            center_wgs84=[lon, lat],
            property_geometry=building.geometry if building else None,
            parcel_geometries=[p.geometry for p in cadastral_parcels if p.geometry],
            zoning_geometries=[
                rule.geometry
                for plan in (zoning_data.plans if zoning_data else [])
                for rule in plan.rules
                if rule.geometry
            ],
        )

    # Build section_sources with Dutch freshness timestamps
    section_sources: list[SectionSourceInfo] = []

    # Zoning section
    if zoning_data:
        section_sources.append(
            SectionSourceInfo(
                section="zoning",
                sources=[
                    DataSourceInfo(
                        source="DSO Ruimtelijke Plannen API v4",
                        confidence="HIGH",
                        is_cached=True,  # zoning_aggregator uses cache internally
                    )
                ],
            )
        )

    # Monuments section
    if monument_status:
        monument_sources = [
            DataSourceInfo(
                source=source.source,
                cached_at=source.cached_at,
                age_seconds=source.age_seconds,
                is_cached=source.cached_at is not None,
                confidence="HIGH",
            )
            for source in monument_status.sources
            if source.error is None  # Only include successful sources
        ]
        if monument_sources:
            section_sources.append(
                SectionSourceInfo(
                    section="monuments",
                    sources=monument_sources,
                    cached_at=monument_sources[0].cached_at,
                    age_seconds=monument_sources[0].age_seconds,
                )
            )

    # AI parsing section
    if ai_parsing_section and ai_parsing_section.status == "complete":
        section_sources.append(
            SectionSourceInfo(
                section="ai_parsing",
                sources=[
                    DataSourceInfo(
                        source="Claude AI (bestemmingsplan PDF)",
                        confidence="MEDIUM",
                        is_cached=True,  # Parsed data comes from cache
                    )
                ],
            )
        )

    # Calculate completeness score
    # Sections: address (1), building (1), parcels (1), zoning (1), monuments (1), ai_parsing (1),
    #           energy_label (1), woz_data (1), brk_ownership (1) — total 9 — INF-05
    sections_available = 1  # Address always available
    if building:
        sections_available += 1
    if cadastral_parcels:
        sections_available += 1
    if zoning_data:
        sections_available += 1
    if monument_status:
        sections_available += 1
    if ai_parsing_section and ai_parsing_section.status == "complete":
        sections_available += 1
    if energy_label is not None:
        sections_available += 1
    if woz_data is not None:
        sections_available += 1
    if brk_ownership.status == "available":
        sections_available += 1

    total_sections = 9  # Updated from 6 — INF-05
    completeness_score = sections_available / total_sections

    logger.info(
        f"Property aggregation complete. Completeness: {completeness_score:.1%}, "
        f"Errors: {len(errors)}"
    )

    return PropertyReportResponse(
        address=address,
        building=building,
        cadastral_parcels=cadastral_parcels,
        zoning=zoning_data,
        monuments=monument_status,
        map_data=map_data,
        section_sources=section_sources,
        data_sources=data_sources,
        completeness_score=completeness_score,
        errors=errors,
        resolved_at=datetime.utcnow().isoformat() + "Z",
        ai_parsing=ai_parsing_section,
        energy_label=energy_label,
        woz_data=woz_data,
        brk_ownership=brk_ownership,
    )
