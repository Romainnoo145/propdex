"""BAG API client for Dutch address and building data."""

import logging

import httpx

from app.core.config import settings
from app.government_apis.base import APINotFoundError, handle_api_response

logger = logging.getLogger(__name__)


class BAGAPIClient:
    """
    Client for Kadaster BAG (Basisregistratie Adressen en Gebouwen) API.

    Provides access to official Dutch address and building registry data:
    - Adressen: Official addresses with postcodes and house numbers
    - Nummeraanduidingen: Address identifiers linking to buildings
    - Verblijfsobjecten: Residential/commercial units with usage and surface area
    - Panden: Buildings with construction year and geometry

    Requires API key from https://lvbag.github.io/BAG-API/

    BAG API v2 wraps individual resource responses in a type key
    (e.g. {"verblijfsobject": {...}}, {"pand": {...}}).
    This client unwraps them to return flat dicts and normalizes field names
    so downstream code (address_resolver) gets a consistent interface.
    """

    BASE_URL = "https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2"

    @property
    def _headers(self) -> dict[str, str]:
        """Get authentication and coordinate system headers."""
        return {
            "X-Api-Key": settings.BAG_API_KEY,
            "Accept-Crs": "epsg:28992",  # Dutch RD coordinate system
        }

    async def get_address(
        self,
        postcode: str,
        huisnummer: int,
        client: httpx.AsyncClient,
        huisletter: str | None = None,
        toevoeging: str | None = None,
    ) -> dict:
        """
        Look up address by postcode and house number.

        Returns:
            dict: Address data including nummeraanduidingIdentificatie and openbareRuimteNaam

        Raises:
            APINotFoundError: If no address found for given combination
        """
        url = f"{self.BASE_URL}/adressen"
        params = {
            "postcode": postcode.replace(" ", ""),
            "huisnummer": huisnummer,
        }
        if huisletter:
            params["huisletter"] = huisletter
        if toevoeging:
            params["huisnummertoevoeging"] = toevoeging

        logger.info(
            f"BAG get_address: {postcode} {huisnummer}{huisletter or ''}{toevoeging or ''}"
        )
        response = await client.get(url, headers=self._headers, params=params)
        data = handle_api_response(response, source="bag")

        addresses = data.get("_embedded", {}).get("adressen", [])
        if not addresses:
            raise APINotFoundError(
                "bag",
                f"No address found for {postcode} {huisnummer}{huisletter or ''}{toevoeging or ''}",
            )

        return addresses[0]

    async def get_nummeraanduiding(
        self, nummeraanduiding_id: str, client: httpx.AsyncClient
    ) -> dict:
        """Look up nummeraanduiding (address identifier) by ID."""
        url = f"{self.BASE_URL}/nummeraanduidingen/{nummeraanduiding_id}"

        logger.info(f"BAG get_nummeraanduiding: {nummeraanduiding_id}")
        response = await client.get(url, headers=self._headers)
        return handle_api_response(response, source="bag")

    async def get_verblijfsobject(
        self, verblijfsobject_id: str, client: httpx.AsyncClient
    ) -> dict:
        """
        Look up verblijfsobject (residential/commercial unit) by ID.

        BAG API v2 returns: {"verblijfsobject": {...}, "_links": {...}}
        This method unwraps and normalizes the response to a flat dict with:
        - oppervlakte, gebruiksdoelen, status (from inner object)
        - _embedded.pandIdentificaties (normalized from maaktDeelUitVan)
        - geometrie (normalized from geometrie.punt or geometrie.vlak)

        Returns:
            dict: Normalized VBO details
        """
        url = f"{self.BASE_URL}/verblijfsobjecten/{verblijfsobject_id}"

        logger.info(f"BAG get_verblijfsobject: {verblijfsobject_id}")
        response = await client.get(url, headers=self._headers)
        data = handle_api_response(response, source="bag")

        # Unwrap: BAG v2 nests under "verblijfsobject" key
        vbo = data.get("verblijfsobject", data)

        # Normalize pand references: BAG v2 uses "maaktDeelUitVan" (list of pand IDs)
        # Put them in _embedded.pandIdentificaties for backward compatibility
        pand_ids = vbo.get("maaktDeelUitVan", [])
        vbo["_embedded"] = {"pandIdentificaties": pand_ids}

        # Normalize geometry: BAG v2 nests as geometrie.punt or geometrie.vlak
        raw_geom = vbo.get("geometrie")
        if raw_geom and not raw_geom.get("type"):
            # Nested format — extract inner GeoJSON
            inner = raw_geom.get("punt") or raw_geom.get("vlak") or raw_geom.get("multivlak")
            if inner:
                vbo["geometrie"] = inner

        logger.info(
            f"BAG VBO {verblijfsobject_id}: oppervlakte={vbo.get('oppervlakte')}, "
            f"pand_ids={pand_ids}, has_geometry={vbo.get('geometrie') is not None}"
        )
        return vbo

    async def get_pand(self, pand_id: str, client: httpx.AsyncClient) -> dict:
        """
        Look up pand (building) by ID.

        BAG API v2 returns: {"pand": {...}, "_links": {...}}
        This method unwraps to a flat dict with:
        - oorspronkelijkBouwjaar, status (from inner object)
        - geometrie (GeoJSON Polygon — already correct format in BAG v2)

        Returns:
            dict: Normalized pand details
        """
        url = f"{self.BASE_URL}/panden/{pand_id}"

        logger.info(f"BAG get_pand: {pand_id}")
        response = await client.get(url, headers=self._headers)
        data = handle_api_response(response, source="bag")

        # Unwrap: BAG v2 nests under "pand" key
        pand = data.get("pand", data)

        logger.info(
            f"BAG pand {pand_id}: bouwjaar={pand.get('oorspronkelijkBouwjaar')}, "
            f"status={pand.get('status')}, has_geometry={pand.get('geometrie') is not None}"
        )
        return pand
