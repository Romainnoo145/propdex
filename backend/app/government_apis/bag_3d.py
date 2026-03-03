"""3D BAG OGC API Features client for actual building heights and floor counts.

Fetches building dimension data from the TU Delft 3D BAG dataset — a nationwide
3D model of all BAG panden derived from AHN LiDAR point clouds.

Key fields:
- b3_h_dak_50p: Median roof height in NAP meters (50th percentile — robust against
  outliers/antennas). Used as the primary roof height indicator.
- b3_h_maaiveld: Ground level (maaiveld) height in NAP meters.
- b3_bouwlagen: Floor count as modelled from the 3D geometry.

Building height formula:
    actual_bouwhoogte = b3_h_dak_50p - b3_h_maaiveld

Registration: https://3dbag.nl (free, HTTP Basic Auth)
API docs: https://api.3dbag.nl
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import bag_3d_limiter

logger = logging.getLogger(__name__)

# OGC API Features endpoint for BAG pand items
BASE_URL = "https://api.3dbag.nl/collections/pand/items"

# Page size for bbox queries — 3D BAG supports up to 1000 per request
_PAGE_SIZE = 1000

# Sanity bounds for derived building height (metres)
_HEIGHT_MIN = 1.5
_HEIGHT_MAX = 200.0

# Sanity bounds for floor count
_BOUWLAGEN_MIN = 1
_BOUWLAGEN_MAX = 100

# Single-item endpoint for per-pand lookup
_ITEM_URL = "https://api.3dbag.nl/collections/pand/items/{pand_id}"


class BAG3DClient:
    """OGC API Features client for TU Delft 3D BAG building data.

    Fetches actual building heights and floor counts for all BAG panden within
    a given EPSG:28992 bounding box. Uses HTTP Basic Auth with credentials from
    settings (BAG_3D_USERNAME / BAG_3D_PASSWORD).

    Pagination is handled automatically: requests are repeated with increasing
    offsets until fewer than _PAGE_SIZE features are returned.

    Rate limiting via bag_3d_limiter (max_concurrent=2, max_per_hour=200).
    """

    async def get_panden_in_bbox(
        self,
        minx: float,
        miny: float,
        maxx: float,
        maxy: float,
        client: httpx.AsyncClient,
    ) -> dict[str, dict[str, Any]]:
        """Fetch 3D BAG building data for all panden in the given EPSG:28992 bbox.

        Args:
            minx: Minimum X coordinate in RD New (EPSG:28992)
            miny: Minimum Y coordinate in RD New (EPSG:28992)
            maxx: Maximum X coordinate in RD New (EPSG:28992)
            maxy: Maximum Y coordinate in RD New (EPSG:28992)
            client: Shared httpx AsyncClient for connection pooling

        Returns:
            Dict keyed by BAG pand identificatie (e.g. "NL.IMBAG.Pand.0363100012345678").
            Each value: {"actual_bouwhoogte": float | None, "actual_bouwlagen": int | None}
            Empty dict if no panden found in bbox.

        Raises:
            GovernmentAPIError: On HTTP 401 (auth failure) or other HTTP errors.
        """
        # Build auth tuple — skip if both credentials are empty (allow unauthenticated)
        username = settings.BAG_3D_USERNAME
        password = settings.BAG_3D_PASSWORD
        auth: tuple[str, str] | None = (username, password) if (username or password) else None

        bbox_str = f"{minx},{miny},{maxx},{maxy}"
        logger.debug("3D BAG bbox query: %s", bbox_str)

        results: dict[str, dict[str, Any]] = {}
        offset = 0

        while True:
            params: dict[str, Any] = {
                "bbox": bbox_str,
                "limit": _PAGE_SIZE,
                "offset": offset,
            }

            async with bag_3d_limiter:
                kwargs: dict[str, Any] = {"params": params, "timeout": 30.0}
                if auth is not None:
                    kwargs["auth"] = auth

                # Capture kwargs in default arg to avoid closure over loop variable (B023)
                response = await retry_with_backoff(
                    lambda kw=kwargs: client.get(BASE_URL, **kw),
                    source="bag-3d",
                    retry_on_errors=True,
                )

            if response.status_code == 401:
                raise GovernmentAPIError(
                    "bag-3d",
                    "Authentication required — set BAG_3D_USERNAME and BAG_3D_PASSWORD (register at 3dbag.nl)",
                    status_code=401,
                )
            if response.status_code != 200:
                raise GovernmentAPIError(
                    "bag-3d",
                    f"HTTP {response.status_code}",
                    status_code=response.status_code,
                )

            data = response.json()
            features: list[dict[str, Any]] = data.get("features", [])

            # 3D BAG returns CityJSON format: each feature has a CityObjects
            # dict keyed by pand ID. Child geometry features have "-N" suffix
            # (e.g. "NL.IMBAG.Pand.xxx-0") — skip those.
            for feature in features:
                city_objects: dict[str, Any] = feature.get("CityObjects", {})
                for pand_id, obj in city_objects.items():
                    # Skip child geometry features (e.g. "-0", "-1")
                    if "-" in pand_id.split(".")[-1]:
                        continue
                    attrs: dict[str, Any] = obj.get("attributes", {})

                    actual_bouwhoogte = _derive_height(attrs)
                    actual_bouwlagen = _derive_bouwlagen(attrs)

                    results[pand_id] = {
                        "actual_bouwhoogte": actual_bouwhoogte,
                        "actual_bouwlagen": actual_bouwlagen,
                    }

            feature_count = len(features)
            logger.debug(
                "3D BAG page offset=%d: %d features (total so far: %d)",
                offset,
                feature_count,
                len(results),
            )

            if feature_count < _PAGE_SIZE:
                # Last page — no more results
                break

            offset += _PAGE_SIZE

        logger.info("3D BAG bbox query complete: %d panden found", len(results))
        return results

    async def get_pand_by_id(
        self,
        pand_id: str,
        client: httpx.AsyncClient,
    ) -> dict[str, Any] | None:
        """Fetch 3D BAG data for a single pand by identificatie.

        Returns:
            {"actual_bouwhoogte": float | None, "actual_bouwlagen": int | None}
            or None if pand not found (404).
        """
        url = _ITEM_URL.format(pand_id=pand_id)

        async with bag_3d_limiter:
            try:
                response = await retry_with_backoff(
                    lambda: client.get(url, timeout=15.0),
                    source="bag-3d",
                    retry_on_errors=True,
                )
            except Exception:
                return None

        if response.status_code == 404:
            return None
        if response.status_code != 200:
            return None

        data = response.json()
        feature = data.get("feature", data)
        city_objects: dict[str, Any] = feature.get("CityObjects", {})

        for obj_id, obj in city_objects.items():
            if "-" in obj_id.split(".")[-1]:
                continue
            attrs = obj.get("attributes", {})
            return {
                "actual_bouwhoogte": _derive_height(attrs),
                "actual_bouwlagen": _derive_bouwlagen(attrs),
            }

        return None


def _derive_height(props: dict[str, Any]) -> float | None:
    """Compute actual building height from 3D BAG properties.

    Returns:
        Height in metres (rounded to 1 decimal), or None if data is missing
        or outside sanity bounds [1.5m, 200m].
    """
    dak = props.get("b3_h_dak_50p")
    maaiveld = props.get("b3_h_maaiveld")

    if dak is None or maaiveld is None:
        return None

    try:
        hoogte = float(dak) - float(maaiveld)
    except (TypeError, ValueError):
        return None

    if not (_HEIGHT_MIN <= hoogte <= _HEIGHT_MAX):
        return None

    return round(hoogte, 1)


def _derive_bouwlagen(props: dict[str, Any]) -> int | None:
    """Extract floor count from 3D BAG properties.

    Returns:
        Floor count as int (rounded), or None if data is missing or outside
        sanity bounds [1, 100].
    """
    raw = props.get("b3_bouwlagen")
    if raw is None:
        return None

    try:
        bouwlagen = int(round(float(raw)))
    except (TypeError, ValueError):
        return None

    if not (_BOUWLAGEN_MIN <= bouwlagen <= _BOUWLAGEN_MAX):
        return None

    return bouwlagen


# Module-level singleton — reuse across requests for connection efficiency
bag_3d_client = BAG3DClient()
