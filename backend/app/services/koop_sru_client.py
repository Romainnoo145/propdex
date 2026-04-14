"""KOOP SRU client — searches officielebekendmakingen.nl for local regulations.

Queries the SRU (Search/Retrieve via URL) endpoint at
https://zoek.officielebekendmakingen.nl/sru/Search
with x-connection=cvdr for consolidated local regulations (CVDR).

No authentication required.
"""

from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

KOOP_SRU_URL = "https://zoek.officielebekendmakingen.nl/sru/Search"

_NS = {
    "srw": "http://www.loc.gov/zing/srw/",
    "dc": "http://purl.org/dc/terms/",
}


@dataclass
class VerordeningResult:
    """A local regulation found via KOOP SRU."""

    title: str
    identifier: str  # e.g. "gmb-2023-540795"
    creator: str  # gemeente name
    modified: str | None  # ISO date
    subject: str | None
    url: str  # link to officielebekendmakingen.nl


# In-memory cache: (title, gemeente_naam) → (timestamp, result | None)
_cache: dict[tuple[str, str], tuple[datetime, VerordeningResult | None]] = {}
_CACHE_TTL_SECONDS = 3600


def _build_url(identifier: str) -> str:
    """Build a URL to the document on officielebekendmakingen.nl."""
    return f"https://zoek.officielebekendmakingen.nl/{identifier}"


def _parse_sru_response(xml_text: str) -> list[VerordeningResult]:
    """Parse SRU XML response into VerordeningResult list."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        logger.warning("Failed to parse SRU XML response")
        return []

    results: list[VerordeningResult] = []

    for record_data in root.findall(".//srw:recordData", _NS):
        raw = ET.tostring(record_data, encoding="unicode")

        # Extract fields via regex — more robust than deep namespace traversal
        title_match = re.search(r"<[^>]*title[^>]*>([^<]+)<", raw)
        id_match = re.search(r"<[^>]*identifier[^>]*>([^<]+)<", raw)
        creator_match = re.search(r"<[^>]*creator[^>]*>([^<]+)<", raw)
        modified_match = re.search(r"<[^>]*modified[^>]*>([^<]+)<", raw)
        subject_match = re.search(r"<[^>]*subject[^>]*>([^<]+)<", raw)

        title = title_match.group(1) if title_match else None
        identifier = id_match.group(1) if id_match else None

        if not title or not identifier:
            continue

        results.append(
            VerordeningResult(
                title=title,
                identifier=identifier,
                creator=creator_match.group(1) if creator_match else "",
                modified=modified_match.group(1) if modified_match else None,
                subject=subject_match.group(1) if subject_match else None,
                url=_build_url(identifier),
            )
        )

    return results


async def search_policy_document(
    title: str,
    gemeente_naam: str,
    *,
    timeout: float = 15.0,
) -> VerordeningResult | None:
    """Search KOOP SRU CVDR for the most recent local regulation matching a title.

    Args:
        title: CVDR document title search term (e.g. "huisvestingsverordening", "omgevingsvisie")
        gemeente_naam: Municipality display name (e.g. "Amsterdam", "Venlo")
        timeout: HTTP timeout in seconds

    Returns:
        Most recent VerordeningResult, or None if not found / HTTP error / parse failure.
    """
    cache_key = (title, gemeente_naam)

    # Check cache
    cached = _cache.get(cache_key)
    if cached is not None:
        cached_at, result = cached
        if (datetime.utcnow() - cached_at).total_seconds() < _CACHE_TTL_SECONDS:
            return result

    # SRU query: title="{title}" AND creator="{gemeente}"
    query = f'title="{title}" AND creator="{gemeente_naam}"'

    params = {
        "version": "1.2",
        "operation": "searchRetrieve",
        "x-connection": "cvdr",
        "query": query,
        "maximumRecords": "5",
        "sortKeys": "modified,,0",  # most recent first
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(KOOP_SRU_URL, params=params)

        if resp.status_code != 200:
            logger.warning(
                "KOOP SRU failed for %s/%s: HTTP %d", title, gemeente_naam, resp.status_code
            )
            _cache[cache_key] = (datetime.utcnow(), None)
            return None

        results = _parse_sru_response(resp.text)

        if not results:
            logger.info("No %s found for %s", title, gemeente_naam)
            _cache[cache_key] = (datetime.utcnow(), None)
            return None

        # Return the most recent one
        best = results[0]
        logger.info(
            "Found %s for %s: %s (%s)",
            title,
            gemeente_naam,
            best.title,
            best.modified,
        )
        _cache[cache_key] = (datetime.utcnow(), best)
        return best

    except httpx.TimeoutException:
        logger.warning("KOOP SRU timed out for %s/%s", title, gemeente_naam)
        return None
    except Exception:
        logger.exception("KOOP SRU error for %s/%s", title, gemeente_naam)
        return None


async def search_huisvestingsverordening(
    gemeente_naam: str,
    *,
    timeout: float = 15.0,
) -> VerordeningResult | None:
    """Backwards-compatible wrapper for huisvestingsverordening lookups.

    New callers should use `search_policy_document(title, gemeente_naam)` directly.
    """
    return await search_policy_document(
        "huisvestingsverordening",
        gemeente_naam,
        timeout=timeout,
    )
