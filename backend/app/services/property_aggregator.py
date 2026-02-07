"""Property data aggregation service with parallel API fetching."""

import asyncio
import logging
import uuid
from datetime import datetime

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.base import APINotFoundError, GovernmentAPIError
from app.government_apis.pdok_cadastral import PDOKCadastralClient
from app.government_apis.rce_monuments import rd_to_wgs84
from app.schemas.address import AddressInput
from app.schemas.monument import MonumentStatus
from app.schemas.property import (
    CadastralParcel,
    DataSourceInfo,
    MapData,
    PropertyReportResponse,
    SectionSourceInfo,
)
from app.schemas.zoning import ZoningData
from app.services.address_resolver import resolve_address
from app.services.cache_manager import get_cached_or_fetch
from app.services.monument_aggregator import fetch_monument_status
from app.services.zoning_aggregator import fetch_zoning_data

logger = logging.getLogger(__name__)

# Module-level singleton
_cadastral_client = PDOKCadastralClient()


async def aggregate_property_data(
    input_data: AddressInput,
    client: httpx.AsyncClient,
    organization_id: uuid.UUID,
    session: AsyncSession,
    force_refresh: bool = False,
) -> PropertyReportResponse:
    """
    Aggregate property data from multiple government APIs with parallel fetching.

    Flow:
    1. Sequential: Resolve address via BAG (MUST succeed)
    2. Parallel: Fetch cadastral parcels, zoning, and monuments if coordinates available

    Args:
        input_data: Address input with postcode and house number
        client: Shared httpx AsyncClient
        organization_id: Tenant ID for cache isolation
        session: SQLAlchemy async session for cache operations
        force_refresh: If True, bypass all caches and fetch fresh data

    Returns:
        PropertyReportResponse: Aggregated property data with zoning, monuments, map data, and source attribution

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

    # STEP 2 (PARALLEL): Fetch cadastral parcels if we have geometry coordinates
    # Extract coordinates from building geometry if available
    coordinates: tuple[float, float] | None = None
    if building and building.geometry:
        # Extract centroid from GeoJSON geometry
        geometry_type = building.geometry.get("type")
        coordinates_data = building.geometry.get("coordinates")

        if geometry_type == "Point" and coordinates_data:
            # Point geometry: [x, y]
            coordinates = (coordinates_data[0], coordinates_data[1])
        elif geometry_type == "Polygon" and coordinates_data:
            # Polygon geometry: calculate simple centroid from first coordinate
            # For MVP, use first coordinate as approximation
            if coordinates_data and coordinates_data[0]:
                first_point = coordinates_data[0][0]
                coordinates = (first_point[0], first_point[1])

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
                    distance=1.0,
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

                parcel = CadastralParcel(
                    kadastrale_aanduiding=props.get("kadastraleAanduiding"),
                    perceelnummer=props.get("perceelnummer"),
                    sectie=props.get("sectie"),
                    oppervlakte=props.get("oppervlakte"),
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

    # Execute ALL fetches in parallel
    results = await asyncio.gather(
        fetch_cadastral_parcels(),
        fetch_zoning(),
        fetch_monuments(),
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

    # Calculate completeness score
    # Sections: address (always 1), building (0 or 1), parcels (0 or 1), zoning (0 or 1), monuments (0 or 1)
    sections_available = 1  # Address always available
    if building:
        sections_available += 1
    if cadastral_parcels:
        sections_available += 1
    if zoning_data:
        sections_available += 1
    if monument_status:
        sections_available += 1

    total_sections = 5
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
    )
