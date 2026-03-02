"""Bodemloket ArcGIS REST client for WBB spatial queries. Phase 68.

Queries the Bodemloket WBB_locaties layer via ArcGIS MapServer REST API
using EPSG:28992 (RD New) envelope geometry. Returns structured WBB dossier
references with mandatory BODEM-03 disclaimer.

Spike results (SPIKE.md, 2026-03-02):
- BUFFER_M=10 chosen over ±25m to avoid false-positives from adjacent parcels
- Confirmed field names from live response at WBB polygon centroid x=206259,y=610965
- BASE_URL confirmed via live test against Rijkswaterstaat ArcGIS endpoint
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import bodemloket_limiter
from app.schemas.bodem import BodemData, WBBDossierRef

logger = logging.getLogger(__name__)

# ArcGIS MapServer endpoint for Bodemloket WBB_locaties layer 0
BASE_URL = "https://gis.gdngeoservices.nl/standalone/rest/services/blk_gdn/lks_blk_rd_v1/MapServer/0/query"

# Buffer in meters around the query point (SPIKE.md decision: ±10m)
# ±10m hits the directly-intersecting WBB polygon only
# ±25m picked up adjacent contaminated polygon ~25m away (false-positive risk)
BUFFER_M: float = 10.0

# Mandatory disclaimer per Bodemloket usage terms (BODEM-03)
# Confirmed correct from SPIKE.md and RESEARCH.md
DISCLAIMER = (
    "Bodemloket bevat niet alle locaties in Nederland. "
    "Afwezigheid van een dossier is geen bodemkwaliteitsverklaring."
)

# All 9 confirmed field names from live Bodemloket response (SPIKE.md)
_OUT_FIELDS = ",".join([
    "WBB_DOSSIER_DBK",
    "SIKB_ID",
    "TYPE_CD",
    "VERVOLG_WBB",
    "STATUSVER",
    "STATUS_OORD",
    "ADMINISTRATOR_NM",
    "LOCATIECODE_BEVOEGD_GEZAG",
    "BIS_LOCCODE",
])


class BodemloketClient:
    """ArcGIS REST client for Bodemloket WBB spatial queries.

    Queries by envelope (bbox) in EPSG:28992 (RD New) coordinates.
    Uses bodemloket_limiter for polite rate limiting.
    """

    async def query_by_point(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
        buffer_m: float = BUFFER_M,
    ) -> BodemData:
        """Query Bodemloket for WBB dossiers within buffer_m of the given RD point.

        Args:
            x: RD New X coordinate (EPSG:28992)
            y: RD New Y coordinate (EPSG:28992)
            client: httpx AsyncClient for connection pooling
            buffer_m: Search radius in meters (default: BUFFER_M=10 per SPIKE.md)

        Returns:
            BodemData with dossiers list (may be empty) and mandatory disclaimer.
            Empty dossiers list is NOT an error — it means no WBB registrations found.

        Raises:
            GovernmentAPIError: On HTTP errors from the ArcGIS REST endpoint
        """
        # Build envelope bbox: xmin,ymin,xmax,ymax in RD New
        bbox = f"{x - buffer_m},{y - buffer_m},{x + buffer_m},{y + buffer_m}"

        params: dict[str, Any] = {
            "geometry": bbox,
            "geometryType": "esriGeometryEnvelope",
            "inSR": "28992",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": _OUT_FIELDS,
            "returnGeometry": "false",
            "f": "geojson",
        }

        logger.debug("Bodemloket query: x=%.0f, y=%.0f, buffer=%.0fm", x, y, buffer_m)

        async with bodemloket_limiter:
            response = await retry_with_backoff(
                lambda: client.get(BASE_URL, params=params, timeout=30.0),
                source="bodemloket",
            )

        if response.status_code != 200:
            raise GovernmentAPIError(
                "bodemloket",
                f"HTTP {response.status_code}",
                status_code=response.status_code,
            )

        data = response.json()
        features: list[dict[str, Any]] = data.get("features", [])

        dossiers: list[WBBDossierRef] = []
        for feature in features:
            props = feature.get("properties", {})
            dossiers.append(
                WBBDossierRef(
                    wbb_dossier_dbk=props.get("WBB_DOSSIER_DBK"),
                    sikb_id=props.get("SIKB_ID"),
                    type_cd=props.get("TYPE_CD"),
                    vervolg_wbb=props.get("VERVOLG_WBB"),
                    statusver=props.get("STATUSVER"),
                    status_oord=props.get("STATUS_OORD"),
                    administrator_nm=props.get("ADMINISTRATOR_NM"),
                    locatiecode_bevoegd_gezag=props.get("LOCATIECODE_BEVOEGD_GEZAG"),
                    bis_loccode=props.get("BIS_LOCCODE"),
                )
            )

        logger.info(
            "Bodemloket query complete: x=%.0f, y=%.0f, dossiers=%d",
            x,
            y,
            len(dossiers),
        )

        return BodemData(dossiers=dossiers, disclaimer=DISCLAIMER)


# Module-level singleton — reuse across requests for connection efficiency
bodemloket_client = BodemloketClient()
