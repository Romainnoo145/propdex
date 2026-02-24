"""Monument aggregation service with multi-source conflict detection."""

from __future__ import annotations

import asyncio
import logging
import uuid

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.base import GovernmentAPIError
from app.government_apis.rce_linked_data import rce_linked_data_client
from app.government_apis.rce_monuments import _rce_client
from app.schemas.monument import MonumentSourceResult, MonumentStatus, RCEMonumentDetail
from app.services.cache_manager import get_cached_or_fetch

logger = logging.getLogger(__name__)


async def _fetch_rce(
    x: float,
    y: float,
    client: httpx.AsyncClient,
    organization_id: uuid.UUID,
    session: AsyncSession,
    force_refresh: bool = False,
) -> MonumentSourceResult:
    """
    Fetch monument status from RCE Rijksmonument API.

    Args:
        x: RD X coordinate
        y: RD Y coordinate
        client: httpx AsyncClient for connection pooling
        organization_id: Tenant ID
        session: SQLAlchemy async session for cache
        force_refresh: If True, bypass cache

    Returns:
        MonumentSourceResult from RCE
    """
    cache_key = f"rce:monument:{x}:{y}"

    try:
        # Define fetch function for cache manager
        async def fetch_fn() -> dict:
            docs = await _rce_client.query_by_location(x, y, client)
            # Return first monument found or empty dict
            return docs[0] if docs else {}

        cache_result = await get_cached_or_fetch(
            cache_key=cache_key,
            source="rce",
            organization_id=organization_id,
            fetch_fn=fetch_fn,
            session=session,
            force_refresh=force_refresh,
        )

        data = cache_result.data

        # Parse RCE response
        if data:
            return MonumentSourceResult(
                source="RCE",
                is_monument=True,
                monument_type="rijksmonument",
                monument_nummer=data.get("rce_objrijksnr"),
                monument_naam=data.get("rce_objnaam") or data.get("abc_beschrijving"),
                cached_at=cache_result.cached_at,
                age_seconds=cache_result.age_seconds,
            )
        else:
            # No monument found at this location
            return MonumentSourceResult(
                source="RCE",
                is_monument=False,
                cached_at=cache_result.cached_at,
                age_seconds=cache_result.age_seconds,
            )

    except Exception as e:
        return MonumentSourceResult(
            source="RCE",
            error=f"RCE API error: {str(e)}",
        )


async def _fetch_bag_monument(
    verblijfsobject_id: str | None,
    organization_id: uuid.UUID,  # noqa: ARG001
    session: AsyncSession,  # noqa: ARG001
    force_refresh: bool = False,  # noqa: ARG001
) -> MonumentSourceResult:
    """
    Fetch monument status from BAG indicators.

    For MVP: BAG API doesn't provide monument status in standard fields.
    Returns error indicating this limitation.

    Args:
        verblijfsobject_id: BAG verblijfsobject identifier
        organization_id: Tenant ID (unused in MVP)
        session: SQLAlchemy async session (unused in MVP)
        force_refresh: If True, bypass cache (unused in MVP)

    Returns:
        MonumentSourceResult from BAG
    """
    if verblijfsobject_id is None:
        return MonumentSourceResult(
            source="BAG",
            error="Geen verblijfsobject ID beschikbaar",
        )

    # For MVP: BAG doesn't provide monument indicators in standard API
    # In future implementation, could check cached BAG data for monument field
    return MonumentSourceResult(
        source="BAG",
        error="Monument status niet beschikbaar via BAG API",
    )


async def _fetch_kadaster_monument(
    organization_id: uuid.UUID,  # noqa: ARG001
    session: AsyncSession,  # noqa: ARG001
    force_refresh: bool = False,  # noqa: ARG001
) -> MonumentSourceResult:
    """
    Fetch monument status from Kadaster indicators.

    For MVP: Kadaster API doesn't provide monument status in standard fields.
    Returns error indicating this limitation.

    Args:
        organization_id: Tenant ID (unused in MVP)
        session: SQLAlchemy async session (unused in MVP)
        force_refresh: If True, bypass cache (unused in MVP)

    Returns:
        MonumentSourceResult from Kadaster
    """
    # For MVP: Kadaster doesn't provide monument indicators in standard API
    # In future implementation, could check cached cadastral data for monument field
    return MonumentSourceResult(
        source="Kadaster",
        error="Monument status niet beschikbaar via Kadaster API",
    )


async def fetch_monument_status(
    x: float,
    y: float,
    pand_id: str | None,  # noqa: ARG001
    verblijfsobject_id: str | None,
    client: httpx.AsyncClient,
    organization_id: uuid.UUID,
    session: AsyncSession,
    force_refresh: bool = False,
) -> MonumentStatus | None:
    """
    Aggregate monument status from multiple sources with conflict detection.

    Queries RCE, BAG, and Kadaster in parallel. Detects conflicts when sources
    disagree on monument status. Generates consensus status and plain-language
    Dutch restriction summaries.

    Args:
        x: RD X coordinate
        y: RD Y coordinate
        pand_id: BAG pand identifier (unused in MVP)
        verblijfsobject_id: BAG verblijfsobject identifier
        client: httpx AsyncClient for connection pooling
        organization_id: Tenant ID
        session: SQLAlchemy async session
        force_refresh: If True, bypass cache for all sources

    Returns:
        MonumentStatus with aggregated data and conflict detection, or None if all sources failed
    """
    # Fetch from all three sources in parallel
    rce_task = _fetch_rce(x, y, client, organization_id, session, force_refresh)
    bag_task = _fetch_bag_monument(verblijfsobject_id, organization_id, session, force_refresh)
    kadaster_task = _fetch_kadaster_monument(organization_id, session, force_refresh)

    results = await asyncio.gather(rce_task, bag_task, kadaster_task, return_exceptions=True)

    # Convert exceptions to error results
    sources: list[MonumentSourceResult] = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            source_name = ["RCE", "BAG", "Kadaster"][i]
            sources.append(
                MonumentSourceResult(
                    source=source_name,
                    error=f"Fetch error: {str(result)}",
                )
            )
        else:
            sources.append(result)

    # Conflict detection: collect definitive sources (is_monument not None)
    definitive_sources = [s for s in sources if s.is_monument is not None and s.error is None]

    has_conflict = False
    conflict_note = None

    if len(definitive_sources) > 1:
        # Check if sources disagree
        monument_statuses = {s.is_monument for s in definitive_sources}
        if len(monument_statuses) > 1:
            has_conflict = True
            conflict_note = (
                f"Bronnen zijn het niet eens: "
                f"{sum(1 for s in definitive_sources if s.is_monument)} bronnen zeggen monument, "
                f"{sum(1 for s in definitive_sources if not s.is_monument)} bronnen zeggen geen monument"
            )

    # Consensus status: only if all agree
    consensus_status = None
    if definitive_sources and not has_conflict:
        if all(s.is_monument for s in definitive_sources):
            # Check monument type
            monument_types = {s.monument_type for s in definitive_sources if s.monument_type}
            if "rijksmonument" in monument_types:
                consensus_status = "rijksmonument"
            else:
                consensus_status = "gemeentelijk_monument"
        elif all(not s.is_monument for s in definitive_sources):
            consensus_status = "geen_monument"

    # Generate restrictions summary (standard guidance text in Dutch)
    restrictions_summary: list[str] = []

    if consensus_status == "rijksmonument":
        restrictions_summary = [
            "Voor verbouwing of wijziging is een omgevingsvergunning van de gemeente nodig, met advies van de monumentencommissie",
            "Sloop van een rijksmonument is alleen toegestaan in uitzonderlijke gevallen",
            "Onderhoud moet worden uitgevoerd volgens de richtlijnen voor monumentenbescherming",
            "Er zijn subsidies en fiscale voordelen beschikbaar voor monumentenonderhoud",
        ]
    elif consensus_status == "gemeentelijk_monument":
        restrictions_summary = [
            "Voor verbouwing of wijziging is een omgevingsvergunning van de gemeente nodig",
            "Wijzigingen moeten in overeenstemming zijn met het beschermde karakter",
            "Er kunnen gemeentelijke subsidies beschikbaar zijn voor onderhoud",
        ]

    # Two-step enrichment: fetch RCE detail when rijksmonument detected (AGG-04)
    rce_detail: RCEMonumentDetail | None = None
    if consensus_status == "rijksmonument":
        rce_source = next(
            (s for s in sources if s.source == "RCE" and s.monument_nummer is not None),
            None,
        )
        if rce_source:
            monument_nr_str = str(rce_source.monument_nummer)
            cache_key = f"rce_detail:monument:{monument_nr_str}"
            try:
                async def _fetch_rce_detail() -> dict:
                    detail = await rce_linked_data_client.get_detail_by_monument_number(
                        monument_nr_str, client
                    )
                    return detail.model_dump() if detail is not None else {}

                detail_cache = await get_cached_or_fetch(
                    cache_key=cache_key,
                    source="rce_detail",
                    organization_id=organization_id,
                    fetch_fn=_fetch_rce_detail,
                    session=session,
                    force_refresh=force_refresh,
                )
                if detail_cache.data:
                    rce_detail = RCEMonumentDetail.model_validate(detail_cache.data)
            except GovernmentAPIError as e:
                logger.warning(
                    "RCE detail fetch failed for monument %s: %s", monument_nr_str, e.message
                )
            except Exception as e:
                logger.warning(
                    "RCE detail unexpected error for monument %s: %s", monument_nr_str, str(e)
                )

    # Build final status
    monument_status = MonumentStatus(
        sources=sources,
        has_conflict=has_conflict,
        conflict_note=conflict_note,
        consensus_status=consensus_status,
        restrictions_summary=restrictions_summary,
        rce_detail=rce_detail,
    )

    return monument_status
