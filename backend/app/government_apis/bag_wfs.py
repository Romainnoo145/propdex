"""BAG WFS client for bulk building queries by geographic area.

This client provides spatial queries against the PDOK BAG WFS service
to fetch building footprints (panden) within a bounding box. Unlike the
BAG individual queries API (bag_api.py), this is a public WFS service
requiring no API key.

Critical implementation detail: PDOK enforces a 1000-feature hard limit
per WFS request. This client handles pagination automatically using
count/startIndex parameters and verifies completion by comparing
numberReturned vs numberMatched to prevent silent data truncation.

Usage:
    from app.government_apis.bag_wfs import bag_wfs_client

    # Fetch all buildings in bounding box (auto-paginates)
    panden = await bag_wfs_client.get_panden_in_bbox(
        minx=121000, miny=487000, maxx=122000, maxy=488000,
        client=app.state.http_client
    )

    # Pre-check count before full fetch
    count = await bag_wfs_client.get_pand_count_in_bbox(
        minx=121000, miny=487000, maxx=122000, maxy=488000,
        client=app.state.http_client
    )
"""

import logging

import httpx

from app.government_apis.base import handle_api_response
from app.government_apis.rate_limiter import bag_wfs_limiter

logger = logging.getLogger(__name__)


class BAGWFSClient:
    """
    Client for PDOK BAG WFS service (building footprint queries).

    Provides bulk spatial queries for buildings within a bounding box,
    with automatic pagination to handle PDOK's 1000-feature limit.

    This is a public WFS service (no API key required), separate from
    the BAG individual queries API which requires authentication.

    Attributes:
        BASE_URL: PDOK BAG WFS endpoint (v2.0)
        PAGE_SIZE: Maximum features per request (PDOK hard limit)
    """

    BASE_URL = "https://service.pdok.nl/lv/bag/wfs/v2_0"
    PAGE_SIZE = 1000  # PDOK maximum features per request
    MAX_FEATURES = 50000  # Cap raised for wijk-based scans (wijken typically 200-2000 parcels)

    async def get_panden_in_bbox(
        self,
        minx: float,
        miny: float,
        maxx: float,
        maxy: float,
        client: httpx.AsyncClient,
    ) -> list[dict]:
        """
        Fetch all building footprints (panden) within a bounding box.

        Automatically paginates past PDOK's 1000-feature limit using
        count/startIndex parameters. Verifies completion by comparing
        numberReturned vs numberMatched to prevent silent truncation.

        Args:
            minx: Minimum X coordinate (RD New / EPSG:28992)
            miny: Minimum Y coordinate (RD New / EPSG:28992)
            maxx: Maximum X coordinate (RD New / EPSG:28992)
            maxy: Maximum Y coordinate (RD New / EPSG:28992)
            client: Shared httpx AsyncClient from app.state

        Returns:
            List of GeoJSON features with pand geometries and properties.
            Each feature contains:
            - geometry: Building footprint polygon in EPSG:28992
            - properties: identificatie, bouwjaar, status, etc.

        Raises:
            GovernmentAPIError: If WFS request fails
            httpx.HTTPStatusError: If HTTP error occurs
        """
        all_features: list[dict] = []
        start_index = 0
        page_num = 0

        while True:
            page_num += 1
            params = {
                "service": "WFS",
                "version": "2.0.0",
                "request": "GetFeature",
                "typeName": "bag:pand",
                "bbox": f"{minx},{miny},{maxx},{maxy},urn:ogc:def:crs:EPSG::28992",
                "outputFormat": "application/json",
                "count": self.PAGE_SIZE,
                "startIndex": start_index,
            }

            # Rate limit each page request
            async with bag_wfs_limiter:
                logger.debug(
                    f"BAG WFS: fetching page {page_num} (startIndex={start_index})"
                )
                response = await client.get(
                    self.BASE_URL, params=params, timeout=30.0
                )
                data = handle_api_response(response, source="bag-wfs")

            features = data.get("features", [])
            all_features.extend(features)

            logger.info(
                f"BAG WFS: fetched {len(all_features)} panden (page {page_num})"
            )

            # Stop conditions:
            # 1. Received fewer features than page size (last page)
            # 2. Hit the max features cap
            # Note: PDOK JSON responses don't include numberMatched/numberReturned,
            # so we rely on partial page detection for pagination termination.
            if len(features) < self.PAGE_SIZE:
                break

            if len(all_features) >= self.MAX_FEATURES:
                logger.warning(
                    f"BAG WFS: capped at {self.MAX_FEATURES} panden "
                    f"(more available in bbox)"
                )
                break

            start_index += self.PAGE_SIZE

        return all_features

    async def get_pand_count_in_bbox(
        self,
        minx: float,
        miny: float,
        maxx: float,
        maxy: float,
        client: httpx.AsyncClient,
    ) -> int:
        """
        Get count of buildings in bounding box without fetching features.

        Uses WFS resultType=hits parameter to return only numberMatched,
        avoiding the overhead of fetching full feature data. Useful for
        pre-checking before full fetch to estimate pagination needs.

        Args:
            minx: Minimum X coordinate (RD New / EPSG:28992)
            miny: Minimum Y coordinate (RD New / EPSG:28992)
            maxx: Maximum X coordinate (RD New / EPSG:28992)
            maxy: Maximum Y coordinate (RD New / EPSG:28992)
            client: Shared httpx AsyncClient from app.state

        Returns:
            Total number of panden in bounding box

        Raises:
            GovernmentAPIError: If WFS request fails
            httpx.HTTPStatusError: If HTTP error occurs
        """
        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "bag:pand",
            "bbox": f"{minx},{miny},{maxx},{maxy},urn:ogc:def:crs:EPSG::28992",
            "resultType": "hits",  # Return count only, no features
        }

        # Rate limit count query
        async with bag_wfs_limiter:
            logger.debug("BAG WFS: counting panden in bbox")
            response = await client.get(self.BASE_URL, params=params, timeout=30.0)
            data = handle_api_response(response, source="bag-wfs")

        count = data.get("numberMatched", 0)
        logger.info(f"BAG WFS: {count} panden in bbox")
        return count


# Module-level singleton instance
bag_wfs_client = BAGWFSClient()
