"""Raadsinformatie service — ORI search + optional AI summarization.

Searches Open Raadsinformatie for development-relevant council documents
per gemeente, optionally summarizes with Claude.
"""

from __future__ import annotations

import logging
from datetime import datetime

from app.schemas.gemeente import RaadsinformatieResponse, RaadsstukResponse
from app.services.ori_client import search_raadsinformatie

logger = logging.getLogger(__name__)

# In-memory cache: gemeente_naam → (timestamp, response)
_summary_cache: dict[str, tuple[datetime, RaadsinformatieResponse]] = {}
_CACHE_TTL_SECONDS = 3600  # 1 hour


def _is_cache_fresh(gemeente_naam: str) -> RaadsinformatieResponse | None:
    """Return cached response if still fresh, else None."""
    entry = _summary_cache.get(gemeente_naam)
    if entry is None:
        return None
    cached_at, response = entry
    if (datetime.utcnow() - cached_at).total_seconds() > _CACHE_TTL_SECONDS:
        del _summary_cache[gemeente_naam]
        return None
    return response


async def get_raadsinformatie(
    gemeente_naam: str,
    *,
    limit: int = 10,
    summarize: bool = False,
) -> RaadsinformatieResponse:
    """Get development-relevant raadsinformatie for a gemeente.

    Fetches from ORI Elasticsearch, optionally AI-summarizes.
    Results cached for 1 hour.

    Args:
        gemeente_naam: Municipality display name
        limit: Max documents to return
        summarize: Whether to AI-summarize (adds latency + cost)

    Returns:
        RaadsinformatieResponse with documents and metadata
    """
    # Check cache
    cached = _is_cache_fresh(gemeente_naam)
    if cached is not None:
        logger.debug("Returning cached raadsinformatie for %s", gemeente_naam)
        return cached

    # Search ORI
    dekking, documents = await search_raadsinformatie(
        gemeente_naam, limit=limit
    )

    if not dekking:
        response = RaadsinformatieResponse(
            gemeente_naam=gemeente_naam,
            dekking=False,
            stukken=[],
            total_found=0,
        )
        _summary_cache[gemeente_naam] = (datetime.utcnow(), response)
        return response

    # Convert to response schema
    stukken: list[RaadsstukResponse] = []
    for doc in documents:
        # Extract a short preview from description
        samenvatting: str | None = None
        if summarize and doc.description:
            # AI summarization: defer to future iteration
            # For now, use first ~300 chars of description as preview
            samenvatting = doc.description[:300]
            if len(doc.description) > 300:
                samenvatting += "..."
        elif doc.description:
            samenvatting = doc.description[:300]
            if len(doc.description) > 300:
                samenvatting += "..."

        stukken.append(
            RaadsstukResponse(
                doc_id=doc.doc_id,
                titel=doc.name,
                datum=doc.date,
                type=doc.doc_type,
                samenvatting=samenvatting,
                bron_url=doc.source_url,
            )
        )

    response = RaadsinformatieResponse(
        gemeente_naam=gemeente_naam,
        dekking=True,
        stukken=stukken,
        total_found=len(stukken),
    )

    _summary_cache[gemeente_naam] = (datetime.utcnow(), response)
    return response
