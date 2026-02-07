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
from app.schemas.address import AddressInput
from app.schemas.property import (
    CadastralParcel,
    DataSourceInfo,
    PropertyLookupResponse,
)
from app.services.address_resolver import resolve_address
from app.services.cache_manager import get_cached_or_fetch

logger = logging.getLogger(__name__)

# Module-level singleton
_cadastral_client = PDOKCadastralClient()


async def aggregate_property_data(
    input_data: AddressInput,
    client: httpx.AsyncClient,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> PropertyLookupResponse:
    """
    Aggregate property data from multiple government APIs with parallel fetching.

    Flow:
    1. Sequential: Resolve address via BAG (MUST succeed)
    2. Parallel: Fetch cadastral parcels if coordinates available

    Args:
        input_data: Address input with postcode and house number
        client: Shared httpx AsyncClient
        organization_id: Tenant ID for cache isolation
        session: SQLAlchemy async session for cache operations

    Returns:
        PropertyLookupResponse: Aggregated property data with source attribution

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

    # Parallel fetch: cadastral parcels
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

    # Execute parallel fetch with exception handling
    results = await asyncio.gather(
        fetch_cadastral_parcels(),
        return_exceptions=True,
    )

    # Process results
    cadastral_result = results[0]
    if isinstance(cadastral_result, Exception):
        logger.error(f"Cadastral fetch failed: {cadastral_result}")
        errors.append(f"Cadastral data fetch failed: {str(cadastral_result)}")
    else:
        cadastral_parcels = cadastral_result

    # Calculate completeness score
    # Sections: address (always 1), building (0 or 1), parcels (0 or 1)
    sections_available = 1  # Address always available
    if building:
        sections_available += 1
    if cadastral_parcels:
        sections_available += 1

    total_sections = 3
    completeness_score = sections_available / total_sections

    logger.info(
        f"Property aggregation complete. Completeness: {completeness_score:.1%}, "
        f"Errors: {len(errors)}"
    )

    return PropertyLookupResponse(
        address=address,
        building=building,
        cadastral_parcels=cadastral_parcels,
        data_sources=data_sources,
        completeness_score=completeness_score,
        errors=errors,
        resolved_at=datetime.utcnow().isoformat() + "Z",
    )
