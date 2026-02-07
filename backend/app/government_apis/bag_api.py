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

        Args:
            postcode: Dutch postcode (e.g., "1234 AB" or "1234AB")
            huisnummer: House number (e.g., 42)
            client: Shared httpx AsyncClient from app.state
            huisletter: Optional house letter (e.g., "A")
            toevoeging: Optional addition (e.g., "bis")

        Returns:
            dict: Address data including nummeraanduidingId and street name

        Raises:
            APINotFoundError: If no address found for given combination
            httpx.HTTPStatusError: If API request fails
        """
        url = f"{self.BASE_URL}/adressen"
        params = {
            "postcode": postcode.replace(" ", ""),  # Remove space for API
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
        """
        Look up nummeraanduiding (address identifier) by ID.

        Args:
            nummeraanduiding_id: BAG nummeraanduiding identifier
            client: Shared httpx AsyncClient from app.state

        Returns:
            dict: Nummeraanduiding details linking address to building

        Raises:
            APINotFoundError: If nummeraanduiding not found
            httpx.HTTPStatusError: If API request fails
        """
        url = f"{self.BASE_URL}/nummeraanduidingen/{nummeraanduiding_id}"

        logger.info(f"BAG get_nummeraanduiding: {nummeraanduiding_id}")
        response = await client.get(url, headers=self._headers)
        return handle_api_response(response, source="bag")

    async def get_verblijfsobject(
        self, verblijfsobject_id: str, client: httpx.AsyncClient
    ) -> dict:
        """
        Look up verblijfsobject (residential/commercial unit) by ID.

        Args:
            verblijfsobject_id: BAG verblijfsobject identifier
            client: Shared httpx AsyncClient from app.state

        Returns:
            dict: Verblijfsobject details including surface area, usage, and pand references

        Raises:
            APINotFoundError: If verblijfsobject not found
            httpx.HTTPStatusError: If API request fails
        """
        url = f"{self.BASE_URL}/verblijfsobjecten/{verblijfsobject_id}"

        logger.info(f"BAG get_verblijfsobject: {verblijfsobject_id}")
        response = await client.get(url, headers=self._headers)
        return handle_api_response(response, source="bag")

    async def get_pand(self, pand_id: str, client: httpx.AsyncClient) -> dict:
        """
        Look up pand (building) by ID.

        Args:
            pand_id: BAG pand identifier
            client: Shared httpx AsyncClient from app.state

        Returns:
            dict: Pand details including construction year, status, and geometry

        Raises:
            APINotFoundError: If pand not found
            httpx.HTTPStatusError: If API request fails
        """
        url = f"{self.BASE_URL}/panden/{pand_id}"

        logger.info(f"BAG get_pand: {pand_id}")
        response = await client.get(url, headers=self._headers)
        return handle_api_response(response, source="bag")
