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


# In-memory cache: cache_key → (timestamp, result | None)
_cache: dict[str, tuple[datetime, VerordeningResult | None]] = {}
_CACHE_TTL_SECONDS = 3600

# Beleidsdocument type → search title terms
BELEID_DOCUMENT_TYPES: dict[str, list[str]] = {
    "omgevingsvisie": ["omgevingsvisie"],
    "woonvisie": ["woonvisie"],
    "welstandsnota": ["welstandsnota"],
    "parkeernormen": ["parkeernormen", "parkeerbeleid"],
    "grondbeleid": ["grondbeleid", "nota grondbeleid"],
}


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


async def search_huisvestingsverordening(
    gemeente_naam: str,
    *,
    timeout: float = 15.0,
) -> VerordeningResult | None:
    """Search KOOP SRU for the most recent huisvestingsverordening of a gemeente.

    Args:
        gemeente_naam: Municipality display name (e.g., "Amsterdam", "Venlo")
        timeout: HTTP timeout in seconds

    Returns:
        Most recent VerordeningResult, or None if not found.
    """
    # Check cache
    cached = _cache.get(gemeente_naam)
    if cached is not None:
        cached_at, result = cached
        if (datetime.utcnow() - cached_at).total_seconds() < _CACHE_TTL_SECONDS:
            return result

    # SRU query: title="huisvestingsverordening" AND creator="{gemeente}"
    query = f'title="huisvestingsverordening" AND creator="{gemeente_naam}"'

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
                "KOOP SRU failed for %s: HTTP %d", gemeente_naam, resp.status_code
            )
            _cache[gemeente_naam] = (datetime.utcnow(), None)
            return None

        results = _parse_sru_response(resp.text)

        if not results:
            logger.info("No huisvestingsverordening found for %s", gemeente_naam)
            _cache[gemeente_naam] = (datetime.utcnow(), None)
            return None

        # Return the most recent one
        best = results[0]
        logger.info(
            "Found huisvestingsverordening for %s: %s (%s)",
            gemeente_naam,
            best.title,
            best.modified,
        )
        _cache[gemeente_naam] = (datetime.utcnow(), best)
        return best

    except httpx.TimeoutException:
        logger.warning("KOOP SRU timed out for %s", gemeente_naam)
        return None
    except Exception:
        logger.exception("KOOP SRU error for %s", gemeente_naam)
        return None


async def search_beleidsdocument(
    gemeente_naam: str,
    title_terms: list[str],
    *,
    timeout: float = 15.0,
) -> VerordeningResult | None:
    """Search KOOP SRU for a beleidsdocument matching any of the title terms.

    Builds a CQL query: (title="term1" OR title="term2") AND creator="{gemeente}"
    Returns the most recent matching result, or None.

    Args:
        gemeente_naam: Municipality display name (e.g., "Amsterdam")
        title_terms: List of title search terms (OR-combined)
        timeout: HTTP timeout in seconds
    """
    cache_key = f"beleid:{gemeente_naam}:{','.join(sorted(title_terms))}"

    cached = _cache.get(cache_key)
    if cached is not None:
        cached_at, result = cached
        if (datetime.utcnow() - cached_at).total_seconds() < _CACHE_TTL_SECONDS:
            return result

    # Build CQL: (title="term1" OR title="term2") AND creator="{gemeente}"
    if len(title_terms) == 1:
        title_clause = f'title="{title_terms[0]}"'
    else:
        parts = " OR ".join(f'title="{t}"' for t in title_terms)
        title_clause = f"({parts})"

    query = f'{title_clause} AND creator="{gemeente_naam}"'

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
                "KOOP SRU beleid search failed for %s (%s): HTTP %d",
                gemeente_naam,
                title_terms,
                resp.status_code,
            )
            _cache[cache_key] = (datetime.utcnow(), None)
            return None

        results = _parse_sru_response(resp.text)

        if not results:
            logger.info("No beleidsdocument found for %s (%s)", gemeente_naam, title_terms)
            _cache[cache_key] = (datetime.utcnow(), None)
            return None

        best = results[0]
        logger.info(
            "Found beleidsdocument for %s: %s (%s)",
            gemeente_naam,
            best.title,
            best.modified,
        )
        _cache[cache_key] = (datetime.utcnow(), best)
        return best

    except httpx.TimeoutException:
        logger.warning("KOOP SRU beleid timed out for %s (%s)", gemeente_naam, title_terms)
        return None
    except Exception:
        logger.exception("KOOP SRU beleid error for %s (%s)", gemeente_naam, title_terms)
        return None


async def search_omgevingsvisie(gemeente_naam: str) -> VerordeningResult | None:
    """Search for the most recent omgevingsvisie of a gemeente."""
    return await search_beleidsdocument(gemeente_naam, ["omgevingsvisie"])


async def search_woonvisie(gemeente_naam: str) -> VerordeningResult | None:
    """Search for the most recent woonvisie of a gemeente."""
    return await search_beleidsdocument(gemeente_naam, ["woonvisie"])


async def search_welstandsnota(gemeente_naam: str) -> VerordeningResult | None:
    """Search for the most recent welstandsnota of a gemeente."""
    return await search_beleidsdocument(gemeente_naam, ["welstandsnota"])


async def search_parkeernormen(gemeente_naam: str) -> VerordeningResult | None:
    """Search for parkeernormen or parkeerbeleid of a gemeente."""
    return await search_beleidsdocument(gemeente_naam, ["parkeernormen", "parkeerbeleid"])


async def search_grondbeleid(gemeente_naam: str) -> VerordeningResult | None:
    """Search for grondbeleid or nota grondbeleid of a gemeente."""
    return await search_beleidsdocument(gemeente_naam, ["grondbeleid", "nota grondbeleid"])
