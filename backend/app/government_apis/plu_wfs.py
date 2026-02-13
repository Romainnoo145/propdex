"""PLU WMS client for bestemmingsplan queries via GetFeatureInfo.

Uses PDOK PLU WMS GetFeatureInfo to fetch zoning designation data at specific
locations. PDOK does not offer WFS for PLU data — only WMS is available.

The enkelbestemming layer contains individual zoning designations with
properties including:
- bestemmingshoofdgroep: SVBP2012 category (e.g., "Wonen", "Bedrijven")
- naam: Specific designation name
- planidentificatie: Reference to parent bestemmingsplan

Usage:
    from app.government_apis.plu_wfs import plu_wms_client

    # Fetch bestemmingen at a specific RD coordinate
    bestemmingen = await plu_wms_client.get_bestemming_at_point(
        x=208000, y=376000, client=http_client
    )
"""

import logging

import httpx

logger = logging.getLogger(__name__)


class PLUWMSClient:
    """
    Client for PDOK PLU WMS service (zoning plan queries via GetFeatureInfo).

    Queries bestemmingsplan data at specific RD coordinates by constructing
    a small viewport around the target point and using WMS GetFeatureInfo
    at the center pixel.

    This is a public WMS service (no API key required).
    """

    BASE_URL = "https://service.pdok.nl/kadaster/plu/wms/v1_0"
    VIEWPORT_SIZE = 10  # 10m x 10m viewport around query point

    async def get_bestemming_at_point(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
    ) -> list[dict] | None:
        """
        Get bestemmingen at a specific RD coordinate using WMS GetFeatureInfo.

        Creates a small viewport (10m x 10m) around the point and queries
        the WMS for feature info at the center pixel.

        Args:
            x: X coordinate in EPSG:28992 (RD New)
            y: Y coordinate in EPSG:28992 (RD New)
            client: Shared httpx AsyncClient

        Returns:
            List of bestemming dicts [{"type": "Wonen", "naam": "Wonen - 1"}]
            or None if no bestemmingen found.
        """
        half = self.VIEWPORT_SIZE / 2
        params = {
            "SERVICE": "WMS",
            "VERSION": "1.3.0",
            "REQUEST": "GetFeatureInfo",
            "LAYERS": "enkelbestemming",
            "QUERY_LAYERS": "enkelbestemming",
            "INFO_FORMAT": "application/json",
            "FEATURE_COUNT": "10",
            "CRS": "EPSG:28992",
            "BBOX": f"{x - half},{y - half},{x + half},{y + half}",
            "WIDTH": "256",
            "HEIGHT": "256",
            "I": "128",
            "J": "128",
        }

        try:
            response = await client.get(
                self.BASE_URL, params=params, timeout=15.0
            )
            if response.status_code != 200:
                return None

            data = response.json()
            features = data.get("features", [])
            if not features:
                return None

            bestemmingen: list[dict] = []
            seen: set[str] = set()

            for feature in features:
                props = feature.get("properties", {})
                btype = props.get("bestemmingshoofdgroep", "Onbekend")
                naam = props.get("naam", "")
                key = f"{btype}:{naam}"
                if key not in seen:
                    seen.add(key)
                    bestemmingen.append({"type": btype, "naam": naam})

            return bestemmingen if bestemmingen else None

        except Exception:
            return None


# Module-level singleton instance
plu_wms_client = PLUWMSClient()
