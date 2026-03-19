"""Address resolution service chaining BAG API calls."""

import logging
from datetime import datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.bag_api import BAGAPIClient
from app.government_apis.base import APINotFoundError, GovernmentAPIError
from app.schemas.address import (
    AddressInput,
    AddressResolution,
    BAGAddressResponse,
    BuildingData,
)
from app.services.cache_manager import get_cached_or_fetch

logger = logging.getLogger(__name__)

# Module-level BAG API client instance
_bag_client = BAGAPIClient()


async def resolve_address(
    input_data: AddressInput,
    client: httpx.AsyncClient,
    session: AsyncSession,
) -> AddressResolution:
    """
    Resolve address through BAG API hierarchy with caching.

    Chains BAG API calls: address → verblijfsobject → pand
    Each step is cached individually for cross-address reuse.

    Args:
        input_data: Address input with postcode and house number
        client: Shared httpx AsyncClient from app.state
        session: SQLAlchemy async session for cache operations

    Returns:
        AddressResolution: Complete address and building data with metadata

    Raises:
        APINotFoundError: If address not found in BAG
        GovernmentAPIError: If BAG API request fails
    """
    logger.info(
        f"Resolving address: {input_data.postcode} {input_data.huisnummer}"
        f"{input_data.huisletter or ''}{input_data.toevoeging or ''}"
    )

    # Step 1: Get address data (throws APINotFoundError if not found)
    cache_key_address = f"bag:address:{input_data.postcode.replace(' ', '')}:{input_data.huisnummer}"
    if input_data.huisletter:
        cache_key_address += f":{input_data.huisletter}"
    if input_data.toevoeging:
        cache_key_address += f":{input_data.toevoeging}"

    address_cache_result = await get_cached_or_fetch(
        cache_key=cache_key_address,
        source="bag",
        fetch_fn=lambda: _bag_client.get_address(
            postcode=input_data.postcode,
            huisnummer=input_data.huisnummer,
            client=client,
            huisletter=input_data.huisletter,
            toevoeging=input_data.toevoeging,
        ),
        session=session,
    )
    address_data = address_cache_result.data

    # Extract core address fields
    nummeraanduiding_id = address_data.get("nummeraanduidingIdentificatie")
    verblijfsobject_id = address_data.get("adresseerbaarObjectIdentificatie")
    straat = address_data.get("openbareRuimteNaam", "")
    woonplaats = address_data.get("woonplaatsNaam", "")

    bag_address = BAGAddressResponse(
        nummeraanduiding_id=nummeraanduiding_id,
        verblijfsobject_id=verblijfsobject_id,
        straat=straat,
        huisnummer=input_data.huisnummer,
        huisletter=input_data.huisletter,
        toevoeging=input_data.toevoeging,
        postcode=input_data.postcode,
        woonplaats=woonplaats,
    )

    building_data: BuildingData | None = None

    # Step 2: Get verblijfsobject data if available
    if verblijfsobject_id:
        try:
            cache_key_vbo = f"bag:verblijfsobject:{verblijfsobject_id}"
            vbo_cache_result = await get_cached_or_fetch(
                cache_key=cache_key_vbo,
                source="bag",
                fetch_fn=lambda: _bag_client.get_verblijfsobject(
                    verblijfsobject_id=verblijfsobject_id,
                    client=client,
                ),
                session=session,
            )
            vbo_data = vbo_cache_result.data

            # Extract verblijfsobject fields
            oppervlakte = vbo_data.get("oppervlakte")
            gebruiksdoel = vbo_data.get("gebruiksdoelen", [])

            # Get pand references (Step 3)
            pand_ids = vbo_data.get("_embedded", {}).get("pandIdentificaties", [])
            if pand_ids:
                # Use first pand (most verblijfsobjecten have one pand)
                pand_id = pand_ids[0]

                try:
                    cache_key_pand = f"bag:pand:{pand_id}"
                    pand_cache_result = await get_cached_or_fetch(
                        cache_key=cache_key_pand,
                        source="bag",
                        fetch_fn=lambda: _bag_client.get_pand(
                            pand_id=pand_id,
                            client=client,
                        ),
                        session=session,
                    )
                    pand_data = pand_cache_result.data

                    # Extract pand fields
                    bouwjaar = pand_data.get("oorspronkelijkBouwjaar")
                    status = pand_data.get("status")
                    geometry = pand_data.get("geometrie")
                    documentdatum = pand_data.get("documentdatum")
                    documentnummer = pand_data.get("documentnummer")
                    voorkomen = pand_data.get("voorkomen", {})
                    status_datum = voorkomen.get("beginGeldigheid") if voorkomen else None

                    building_data = BuildingData(
                        pand_id=pand_id,
                        bouwjaar=bouwjaar,
                        status=status,
                        status_datum=status_datum,
                        documentdatum=documentdatum,
                        documentnummer=documentnummer,
                        oppervlakte=oppervlakte,
                        gebruiksdoel=gebruiksdoel,
                        geometry=geometry,
                    )
                    logger.info(f"Successfully resolved building data for pand {pand_id}")

                except (APINotFoundError, GovernmentAPIError) as e:
                    # Partial failure: address + verblijfsobject data, but no pand
                    logger.warning(f"Failed to fetch pand {pand_id}: {e}")
                    building_data = BuildingData(
                        pand_id=pand_id,
                        oppervlakte=oppervlakte,
                        gebruiksdoel=gebruiksdoel,
                    )

        except (APINotFoundError, GovernmentAPIError) as e:
            # Partial failure: address data only, no building data
            logger.warning(f"Failed to fetch verblijfsobject {verblijfsobject_id}: {e}")

    return AddressResolution(
        address=bag_address,
        building=building_data,
        resolved_at=datetime.utcnow().isoformat() + "Z",
        source="bag",
    )
