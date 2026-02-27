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
    PAGE_SIZE = 1000
    MAX_FEATURES = 50000

    async def get_parcels_by_bbox(
        self,
        bbox: str,
        client: httpx.AsyncClient,
        limit: int = PAGE_SIZE,
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
        page_size = max(1, min(int(limit), self.PAGE_SIZE))
        url = f"{self.BASE_URL}/collections/perceel/items"
        params = {
            "bbox": bbox,
            "bbox-crs": "http://www.opengis.net/def/crs/EPSG/0/28992",
            # Ask PDOK to return geometries in RD to match scan storage/query CRS.
            # (Some deployments may still return CRS84; callers should stay defensive.)
            "crs": "http://www.opengis.net/def/crs/EPSG/0/28992",
            "limit": page_size,
            "f": "json",
        }

        logger.info(f"Fetching cadastral parcels for bbox: {bbox}")

        try:
            all_features: list[dict] = []
            page_num = 0
            next_url: str | None = url
            next_params: dict | None = params
            seen_next: set[str] = set()

            while next_url:
                page_num += 1
                response = await client.get(next_url, params=next_params, timeout=30.0)
                data = handle_api_response(response, source="pdok-cadastral")

                page_features = data.get("features", [])
                if isinstance(page_features, list):
                    all_features.extend(page_features)

                logger.debug(
                    "PDOK cadastral page %s fetched %s features (total=%s)",
                    page_num,
                    len(page_features) if isinstance(page_features, list) else 0,
                    len(all_features),
                )

                if len(all_features) >= self.MAX_FEATURES:
                    logger.warning(
                        "PDOK cadastral: capped at %s parcels for bbox %s",
                        self.MAX_FEATURES,
                        bbox,
                    )
                    break

                next_href = None
                links = data.get("links", [])
                if isinstance(links, list):
                    for link in links:
                        if not isinstance(link, dict):
                            continue
                        if link.get("rel") == "next" and isinstance(link.get("href"), str):
                            next_href = link["href"]
                            break

                if not next_href:
                    break
                if next_href in seen_next:
                    logger.warning("PDOK cadastral pagination loop detected, stopping")
                    break

                seen_next.add(next_href)
                next_url = next_href
                next_params = None

            logger.info(f"Found {len(all_features)} cadastral parcels")
            return all_features

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
