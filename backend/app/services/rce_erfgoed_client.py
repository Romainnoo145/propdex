"""RCE Erfgoed client — fetches beschermde stadsgezichten from RCE WFS.

Source: https://services.rce.geovoorziening.nl/rce/wfs
Feature type: rce:Townscapes (473 beschermde stads-/dorpsgezichten)
No authentication required. Cached 24h — data is static.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

RCE_WFS_URL = "https://services.rce.geovoorziening.nl/rce/wfs"


@dataclass
class BeschermdGezicht:
    """A beschermd stads- or dorpsgezicht from RCE."""

    naam: str
    type: str  # "stadsgezicht" or "dorpsgezicht"
    aangewezen: str | None  # date
    oppervlakte_ha: float | None
    bron_id: str


# Module-level cache
_cache: tuple[datetime, list[BeschermdGezicht]] | None = None
_CACHE_TTL_SECONDS = 86400  # 24h


def _classify_type(jurstatus: str | None) -> str:
    """Classify as stadsgezicht or dorpsgezicht from JURSTATUS."""
    if not jurstatus:
        return "stadsgezicht"
    lower = jurstatus.lower()
    if "dorpsgezicht" in lower:
        return "dorpsgezicht"
    return "stadsgezicht"


async def _fetch_all_townscapes(timeout: float = 30.0) -> list[BeschermdGezicht]:
    """Fetch all beschermde stadsgezichten from RCE WFS."""
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "rce:Townscapes",
        "outputFormat": "application/json",
        "count": "1000",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(RCE_WFS_URL, params=params)

        if resp.status_code != 200:
            logger.warning("RCE WFS returned %d", resp.status_code)
            return []

        data = resp.json()
        features = data.get("features", [])

        results: list[BeschermdGezicht] = []
        for f in features:
            props = f.get("properties", {})
            naam = props.get("NAAM")
            if not naam:
                continue
            results.append(
                BeschermdGezicht(
                    naam=naam,
                    type=_classify_type(props.get("JURSTATUS")),
                    aangewezen=props.get("AANGEWEZEN"),
                    oppervlakte_ha=props.get("OPPERV_HA"),
                    bron_id=str(props.get("BRON_ID", "")),
                )
            )

        logger.info("Fetched %d beschermde gezichten from RCE WFS", len(results))
        return results

    except httpx.TimeoutException:
        logger.warning("RCE WFS timed out")
        return []
    except Exception:
        logger.exception("RCE WFS error")
        return []


async def get_beschermde_gezichten(gemeente_naam: str) -> list[BeschermdGezicht]:
    """Get beschermde stadsgezichten for a gemeente.

    Fetches all townscapes from RCE WFS (cached 24h), then filters
    by name similarity. Uses substring matching since townscape names
    often contain the gemeente or place name.

    Args:
        gemeente_naam: Municipality display name (e.g., "Amsterdam")

    Returns:
        List of BeschermdGezicht matching the gemeente.
    """
    global _cache

    if _cache is not None:
        cached_at, all_gezichten = _cache
        if (datetime.utcnow() - cached_at).total_seconds() < _CACHE_TTL_SECONDS:
            return _filter_by_gemeente(all_gezichten, gemeente_naam)

    all_gezichten = await _fetch_all_townscapes()
    _cache = (datetime.utcnow(), all_gezichten)
    return _filter_by_gemeente(all_gezichten, gemeente_naam)


def _filter_by_gemeente(
    gezichten: list[BeschermdGezicht], gemeente_naam: str
) -> list[BeschermdGezicht]:
    """Filter townscapes by gemeente name.

    Townscape NAAM is often a place/neighborhood name within a gemeente,
    not the gemeente name itself. For a reliable match we'd need spatial
    intersection, but for MVP we match on the gemeente name appearing
    in the townscape name or vice versa.
    """
    lower = gemeente_naam.lower()
    return [g for g in gezichten if lower in g.naam.lower() or g.naam.lower() in lower]
