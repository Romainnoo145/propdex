"""DSO Spatial Plans API client for bestemmingsplan data."""

import logging

import httpx

from app.government_apis.base import (
    APITimeoutError,
    GovernmentAPIError,
    handle_api_response,
)

logger = logging.getLogger(__name__)


class DSOSpatialPlansClient:
    """
    Client for DSO Ruimtelijke Plannen API v4.

    Provides access to spatial planning data (bestemmingsplannen):
    - Plans at location via POST with GeoJSON Point
    - Bestemmingsvlakken (zoning areas) with permitted functions
    - Bouwvlakken (building envelopes) with dimensional constraints
    - Maatvoeringen (dimension specifications) for height/coverage limits

    API documentation: https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/
    """

    BASE_URL = "https://ruimte.omgevingswet.overheid.nl/ruimtelijke-plannen/api/opvragen/v4"

    def __init__(self, api_key: str = ""):
        """
        Initialize DSO Spatial Plans client.

        Args:
            api_key: Optional API key for authenticated access. If empty, no auth header sent.
        """
        self.api_key = api_key

    @property
    def _headers(self) -> dict[str, str]:
        """
        Get headers for DSO API requests.

        Returns:
            dict: Headers including Content-Type, CRS headers, and optional API key
        """
        headers = {
            "Content-Type": "application/json",
            "Content-Crs": "EPSG:28992",  # Input coordinate system (RD New)
            "Accept-Crs": "EPSG:28992",  # Output coordinate system (RD New)
        }
        if self.api_key:
            headers["X-Api-Key"] = self.api_key
        return headers

    async def find_plans_at_location(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
    ) -> list[dict]:
        """
        Find spatial plans at a specific RD coordinate location.

        Args:
            x: X coordinate in EPSG:28992 (RD New)
            y: Y coordinate in EPSG:28992 (RD New)
            client: Shared httpx AsyncClient from app.state

        Returns:
            list[dict]: List of spatial plans at this location

        Raises:
            APITimeoutError: If request times out
            GovernmentAPIError: If API request fails
        """
        url = f"{self.BASE_URL}/plannen/_zoek"
        body = {
            "type": "Point",
            "coordinates": [x, y],
        }

        logger.info(f"DSO find_plans_at_location: ({x}, {y})")

        try:
            # Fetch first page
            response = await client.post(
                url,
                headers=self._headers,
                json=body,
                timeout=30.0,
            )
            data = handle_api_response(response, source="dso-spatial-plans")

            # Extract plans from HAL+JSON response
            plans = data.get("_embedded", {}).get("plannen", [])

            # Handle pagination (up to 5 pages)
            page_count = 1
            while page_count < 5:
                next_link = data.get("_links", {}).get("next", {}).get("href")
                if not next_link:
                    break

                logger.info(f"DSO fetching page {page_count + 1}")
                response = await client.get(
                    next_link,
                    headers=self._headers,
                    timeout=30.0,
                )
                data = handle_api_response(response, source="dso-spatial-plans")
                plans.extend(data.get("_embedded", {}).get("plannen", []))
                page_count += 1

            logger.info(f"Found {len(plans)} spatial plans")
            return plans

        except httpx.TimeoutException as e:
            raise APITimeoutError("dso-spatial-plans", "Request timed out") from e
        except httpx.HTTPError as e:
            raise GovernmentAPIError(
                "dso-spatial-plans",
                f"HTTP error: {str(e)}",
            ) from e

    async def get_bestemmingsvlakken(
        self,
        plan_id: str,
        client: httpx.AsyncClient,
    ) -> list[dict]:
        """
        Get bestemmingsvlakken (zoning areas) for a plan.

        Args:
            plan_id: DSO plan identifier
            client: Shared httpx AsyncClient from app.state

        Returns:
            list[dict]: List of bestemmingsvlakken with geometries and functions

        Raises:
            APITimeoutError: If request times out
            GovernmentAPIError: If API request fails
        """
        url = f"{self.BASE_URL}/plannen/{plan_id}/bestemmingsvlakken"
        params = {
            "expand": "geometrie",
            "pageSize": 100,
        }

        logger.info(f"DSO get_bestemmingsvlakken: {plan_id}")

        try:
            # Fetch first page
            response = await client.get(
                url,
                headers=self._headers,
                params=params,
                timeout=30.0,
            )
            data = handle_api_response(response, source="dso-spatial-plans")

            # Extract bestemmingsvlakken from HAL+JSON response
            vlakken = data.get("_embedded", {}).get("bestemmingsvlakken", [])

            # Handle pagination (up to 5 pages)
            page_count = 1
            while page_count < 5:
                next_link = data.get("_links", {}).get("next", {}).get("href")
                if not next_link:
                    break

                logger.info(f"DSO fetching bestemmingsvlakken page {page_count + 1}")
                response = await client.get(
                    next_link,
                    headers=self._headers,
                    timeout=30.0,
                )
                data = handle_api_response(response, source="dso-spatial-plans")
                vlakken.extend(data.get("_embedded", {}).get("bestemmingsvlakken", []))
                page_count += 1

            logger.info(f"Found {len(vlakken)} bestemmingsvlakken")
            return vlakken

        except httpx.TimeoutException as e:
            raise APITimeoutError("dso-spatial-plans", "Request timed out") from e
        except httpx.HTTPError as e:
            raise GovernmentAPIError(
                "dso-spatial-plans",
                f"HTTP error: {str(e)}",
            ) from e

    async def get_bouwvlakken(
        self,
        plan_id: str,
        client: httpx.AsyncClient,
    ) -> list[dict]:
        """
        Get bouwvlakken (building envelopes) for a plan.

        Args:
            plan_id: DSO plan identifier
            client: Shared httpx AsyncClient from app.state

        Returns:
            list[dict]: List of bouwvlakken with geometries

        Raises:
            APITimeoutError: If request times out
            GovernmentAPIError: If API request fails
        """
        url = f"{self.BASE_URL}/plannen/{plan_id}/bouwvlakken"
        params = {
            "expand": "geometrie",
            "pageSize": 100,
        }

        logger.info(f"DSO get_bouwvlakken: {plan_id}")

        try:
            # Fetch first page
            response = await client.get(
                url,
                headers=self._headers,
                params=params,
                timeout=30.0,
            )
            data = handle_api_response(response, source="dso-spatial-plans")

            # Extract bouwvlakken from HAL+JSON response
            vlakken = data.get("_embedded", {}).get("bouwvlakken", [])

            # Handle pagination (up to 5 pages)
            page_count = 1
            while page_count < 5:
                next_link = data.get("_links", {}).get("next", {}).get("href")
                if not next_link:
                    break

                logger.info(f"DSO fetching bouwvlakken page {page_count + 1}")
                response = await client.get(
                    next_link,
                    headers=self._headers,
                    timeout=30.0,
                )
                data = handle_api_response(response, source="dso-spatial-plans")
                vlakken.extend(data.get("_embedded", {}).get("bouwvlakken", []))
                page_count += 1

            logger.info(f"Found {len(vlakken)} bouwvlakken")
            return vlakken

        except httpx.TimeoutException as e:
            raise APITimeoutError("dso-spatial-plans", "Request timed out") from e
        except httpx.HTTPError as e:
            raise GovernmentAPIError(
                "dso-spatial-plans",
                f"HTTP error: {str(e)}",
            ) from e

    async def get_maatvoeringen(
        self,
        plan_id: str,
        client: httpx.AsyncClient,
    ) -> list[dict]:
        """
        Get maatvoeringen (dimension specifications) for a plan.

        Args:
            plan_id: DSO plan identifier
            client: Shared httpx AsyncClient from app.state

        Returns:
            list[dict]: List of maatvoeringen with geometries and dimension values

        Raises:
            APITimeoutError: If request times out
            GovernmentAPIError: If API request fails
        """
        url = f"{self.BASE_URL}/plannen/{plan_id}/maatvoeringen"
        params = {
            "expand": "geometrie",
            "pageSize": 100,
        }

        logger.info(f"DSO get_maatvoeringen: {plan_id}")

        try:
            # Fetch first page
            response = await client.get(
                url,
                headers=self._headers,
                params=params,
                timeout=30.0,
            )
            data = handle_api_response(response, source="dso-spatial-plans")

            # Extract maatvoeringen from HAL+JSON response
            maatvoeringen = data.get("_embedded", {}).get("maatvoeringen", [])

            # Handle pagination (up to 5 pages)
            page_count = 1
            while page_count < 5:
                next_link = data.get("_links", {}).get("next", {}).get("href")
                if not next_link:
                    break

                logger.info(f"DSO fetching maatvoeringen page {page_count + 1}")
                response = await client.get(
                    next_link,
                    headers=self._headers,
                    timeout=30.0,
                )
                data = handle_api_response(response, source="dso-spatial-plans")
                maatvoeringen.extend(data.get("_embedded", {}).get("maatvoeringen", []))
                page_count += 1

            logger.info(f"Found {len(maatvoeringen)} maatvoeringen")
            return maatvoeringen

        except httpx.TimeoutException as e:
            raise APITimeoutError("dso-spatial-plans", "Request timed out") from e
        except httpx.HTTPError as e:
            raise GovernmentAPIError(
                "dso-spatial-plans",
                f"HTTP error: {str(e)}",
            ) from e


# Module-level singleton
_dso_client: DSOSpatialPlansClient | None = None


def get_dso_client() -> DSOSpatialPlansClient:
    """
    Get or create the singleton DSO Spatial Plans client.

    Returns:
        DSOSpatialPlansClient: Initialized client instance
    """
    global _dso_client
    if _dso_client is None:
        from app.core.config import settings

        _dso_client = DSOSpatialPlansClient(api_key=settings.DSO_API_KEY)
    return _dso_client
