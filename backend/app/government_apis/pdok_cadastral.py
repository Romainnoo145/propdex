"""PDOK Cadastral (BRK) API client for parcel data."""

import logging

import httpx

from app.government_apis.base import handle_api_response

logger = logging.getLogger(__name__)


class PDOKCadastralClient:
    """
    Client for PDOK Cadastral OGC API (BRK Kadastrale Kaart).

    Provides access to cadastral parcel (perceel) data via OGC API Features.
    Free public API, no authentication required.
    """

    BASE_URL = "https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1"

    async def get_parcels_by_bbox(
        self,
        bbox: str,
        client: httpx.AsyncClient,
        limit: int = 10,
    ) -> list[dict]:
        """
        Get cadastral parcels within bounding box.

        Args:
            bbox: Bounding box in format "minx,miny,maxx,maxy" (EPSG:28992 - RD New)
            client: Shared httpx AsyncClient
            limit: Maximum number of parcels to return

        Returns:
            list[dict]: List of parcel features, each with properties and geometry

        Raises:
            GovernmentAPIError: If API request fails
        """
        url = f"{self.BASE_URL}/collections/perceel/items"
        params = {
            "bbox": bbox,
            "limit": limit,
            "f": "json",
        }

        logger.info(f"Fetching cadastral parcels for bbox: {bbox}")

        try:
            response = await client.get(url, params=params, timeout=30.0)
            data = handle_api_response(response, source="pdok-cadastral")

            features = data.get("features", [])
            logger.info(f"Found {len(features)} cadastral parcels")

            return features

        except httpx.TimeoutException as e:
            from app.government_apis.base import APITimeoutError

            raise APITimeoutError("pdok-cadastral", "Request timed out") from e
        except httpx.HTTPError as e:
            from app.government_apis.base import GovernmentAPIError

            raise GovernmentAPIError(
                "pdok-cadastral",
                f"HTTP error fetching parcels: {str(e)}",
            ) from e

    async def get_parcels_by_point(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
        distance: float = 1.0,
    ) -> list[dict]:
        """
        Get cadastral parcels near a point by constructing a bounding box.

        Args:
            x: X coordinate (EPSG:28992 - RD New)
            y: Y coordinate (EPSG:28992 - RD New)
            client: Shared httpx AsyncClient
            distance: Distance in meters to expand bbox around point

        Returns:
            list[dict]: List of parcel features near the point

        Raises:
            GovernmentAPIError: If API request fails
        """
        # Construct bbox from point +/- distance
        bbox = f"{x-distance},{y-distance},{x+distance},{y+distance}"

        logger.info(f"Fetching cadastral parcels for point ({x}, {y}) with distance {distance}m")

        return await self.get_parcels_by_bbox(bbox=bbox, client=client)
