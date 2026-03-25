"""RVO subsidie client — fetches development-relevant subsidies from RVO open data API.

Source: https://www.rvo.nl/api/v1/opendata/subsidies
No authentication required. Returns ~50 subsidies; we filter for bouw/woning relevance.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

RVO_API_URL = "https://www.rvo.nl/api/v1/opendata/subsidies"

# Keywords that indicate relevance for property development
_RELEVANCE_KEYWORDS = [
    "woningbouw",
    "woning",
    "wonen",
    "bouw en infrastructuur",
    "vastgoed",
    "verduurzaming",
    "verduurzamen",
    "isolatie",
    "warmtepomp",
    "aardgasvrij",
    "energielabel",
    "optoppen",
    "transformatie",
    "flexwoning",
    "sloop",
    "gebouwen",
    "nieuwbouw",
    "renovatie",
    "circulair bouwen",
]


@dataclass
class RVOSubsidie:
    """A subsidy from the RVO API."""

    id: str
    title: str
    intro: str | None
    url: str | None
    sectors: list[str]
    targets: list[str]
    changed: str | None  # ISO 8601


# In-memory cache
_cache: tuple[datetime, list[RVOSubsidie]] | None = None
_CACHE_TTL_SECONDS = 3600  # 1 hour


def _parse_list_field(raw: str | list | None) -> list[str]:
    """Parse a stringified list from the RVO API."""
    if isinstance(raw, list):
        return [str(item) for item in raw]
    if isinstance(raw, str):
        # RVO returns stringified Python lists like "['a', 'b']"
        try:
            import ast
            parsed = ast.literal_eval(raw)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except (ValueError, SyntaxError):
            pass
        return [raw]
    return []


def _is_development_relevant(item: dict) -> bool:
    """Check if a subsidy is relevant for property development.

    Focuses on title + intro text only — sector names are too generic
    (e.g. 'Bouw en infrastructuur' matches almost everything).
    """
    # Primary: check title and intro for strong signals
    title_intro = " ".join([
        str(item.get("title", "")),
        str(item.get("intro", "")),
    ]).lower()

    # Strong match: any keyword in title/intro
    if any(kw in title_intro for kw in _RELEVANCE_KEYWORDS):
        return True

    # Secondary: check if 'bouw en infrastructuur' is the PRIMARY sector
    # (not just one of many) and subjects/tags reinforce it
    subjects_tags = " ".join([
        str(item.get("subjects", "")),
        str(item.get("tags", "")),
    ]).lower()

    if any(kw in subjects_tags for kw in _RELEVANCE_KEYWORDS):
        return True

    return False


async def fetch_development_subsidies(
    *, timeout: float = 15.0
) -> list[RVOSubsidie]:
    """Fetch development-relevant subsidies from RVO API.

    Returns cached results if fresh, otherwise fetches from RVO.
    """
    global _cache

    # Check cache
    if _cache is not None:
        cached_at, cached_results = _cache
        if (datetime.utcnow() - cached_at).total_seconds() < _CACHE_TTL_SECONDS:
            logger.debug("Returning cached RVO subsidies (%d items)", len(cached_results))
            return cached_results

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(RVO_API_URL)

        if resp.status_code != 200:
            logger.warning("RVO API returned %d: %s", resp.status_code, resp.text[:300])
            return _cache[1] if _cache else []

        all_items = resp.json()
        if not isinstance(all_items, list):
            logger.warning("RVO API returned non-list: %s", type(all_items))
            return _cache[1] if _cache else []

        # Filter for development relevance
        relevant = [item for item in all_items if _is_development_relevant(item)]

        results: list[RVOSubsidie] = []
        for item in relevant:
            url_path = item.get("url", "")
            full_url = f"https://www.rvo.nl{url_path}" if url_path and url_path.startswith("/") else url_path

            results.append(
                RVOSubsidie(
                    id=item.get("id", ""),
                    title=item.get("title", ""),
                    intro=item.get("intro"),
                    url=full_url or None,
                    sectors=_parse_list_field(item.get("sectors")),
                    targets=_parse_list_field(item.get("targets")),
                    changed=item.get("changed"),
                )
            )

        _cache = (datetime.utcnow(), results)
        logger.info("Fetched %d development-relevant subsidies from RVO (of %d total)", len(results), len(all_items))
        return results

    except httpx.TimeoutException:
        logger.warning("RVO API timed out")
        return _cache[1] if _cache else []
    except Exception:
        logger.exception("RVO API error")
        return _cache[1] if _cache else []
