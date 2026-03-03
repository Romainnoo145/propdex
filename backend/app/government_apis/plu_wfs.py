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
import re

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
            # Query both layers in one request to avoid doubling API calls.
            "LAYERS": "enkelbestemming,maatvoering",
            "QUERY_LAYERS": "enkelbestemming,maatvoering",
            "INFO_FORMAT": "application/json",
            "FEATURE_COUNT": "20",
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

            metrics = self._extract_metrics_from_features(features)

            bestemmingen: list[dict] = []
            seen: set[str] = set()

            for feature in features:
                props = feature.get("properties", {})
                if "bestemmingshoofdgroep" not in props:
                    continue
                btype = props.get("bestemmingshoofdgroep", "Onbekend")
                naam = props.get("naam", "")
                key = f"{btype}:{naam}"
                if key not in seen:
                    seen.add(key)
                    entry: dict[str, str | float | int] = {"type": btype, "naam": naam}
                    if metrics["max_bebouwingspercentage"] is not None:
                        entry["max_bebouwingspercentage"] = metrics["max_bebouwingspercentage"]
                    if metrics["max_floor_area_ratio"] is not None:
                        entry["max_floor_area_ratio"] = metrics["max_floor_area_ratio"]
                    if metrics["max_bouwhoogte"] is not None:
                        entry["max_bouwhoogte"] = metrics["max_bouwhoogte"]
                    if metrics["max_bouwlagen"] is not None:
                        entry["max_bouwlagen"] = metrics["max_bouwlagen"]
                    bestemmingen.append(entry)

            return bestemmingen if bestemmingen else None

        except Exception:
            return None

    def _extract_metrics_from_features(
        self,
        features: list[dict],
    ) -> dict[str, float | int | None]:
        """Extract build intensity metrics from maatvoering features."""
        max_bebouwingspercentage: float | None = None
        max_floor_area_ratio: float | None = None
        max_bouwhoogte: float | None = None
        max_bouwlagen: int | None = None

        for feature in features:
            props = feature.get("properties", {})
            if "maatvoering" not in props:
                continue

            text = " ".join(
                str(props.get(k, ""))
                for k in ("naam", "maatvoering", "aanduiding")
            ).lower()

            values = self._extract_numeric_values(text)
            if not values:
                continue

            if "bebouwingspercentage" in text:
                candidate = max(values)
                max_bebouwingspercentage = (
                    candidate
                    if max_bebouwingspercentage is None
                    else max(max_bebouwingspercentage, candidate)
                )

            if any(
                token in text
                for token in ("fsi", "far", "floor area", "vloeroppervlakte")
            ):
                candidate = max(values)
                max_floor_area_ratio = (
                    candidate
                    if max_floor_area_ratio is None
                    else max(max_floor_area_ratio, candidate)
                )

            # Parse bouwhoogte from maatvoering text (excluding goothoogte)
            if any(kw in text for kw in ("bouwhoogte", "bouwhogte")) and "goot" not in text:
                candidates = [v for v in values if 2.0 <= v <= 100.0]
                if candidates:
                    candidate = max(candidates)
                    max_bouwhoogte = candidate if max_bouwhoogte is None else max(max_bouwhoogte, candidate)

            # Parse bouwlagen from maatvoering text
            if any(kw in text for kw in ("bouwlagen", "bouwlaag", "verdieping", "woonlagen")) and values:
                bl_candidates = [int(round(v)) for v in values if 1 < v <= 50]
                if bl_candidates:
                    candidate_bl = max(bl_candidates)
                    max_bouwlagen = candidate_bl if max_bouwlagen is None else max(max_bouwlagen, candidate_bl)

        return {
            "max_bebouwingspercentage": max_bebouwingspercentage,
            "max_floor_area_ratio": max_floor_area_ratio,
            "max_bouwhoogte": max_bouwhoogte,
            "max_bouwlagen": max_bouwlagen,
        }

    @staticmethod
    def _extract_numeric_values(text: str) -> list[float]:
        values: list[float] = []
        for match in re.findall(r"-?\d+(?:[.,]\d+)?", text):
            try:
                values.append(float(match.replace(",", ".")))
            except ValueError:
                continue
        return values


# Module-level singleton instance
plu_wms_client = PLUWMSClient()
