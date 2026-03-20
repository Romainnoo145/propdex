"""Gemeente API endpoints — municipality-level intelligence."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.schemas.gemeente import (
    BeschermdGezichtResponse,
    ErfgoedResponse,
    GemeenteProfile,
    HuisvestingsverordeningResponse,
    RaadsinformatieResponse,
    SubsidieResponse,
    SubsidiesResponse,
)
from app.services.gemeente_profile import build_gemeente_profile
from app.services.koop_sru_client import search_huisvestingsverordening
from app.services.raadsinformatie import get_raadsinformatie
from app.services.rce_erfgoed_client import get_beschermde_gezichten
from app.services.rvo_client import fetch_development_subsidies

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Static routes MUST come before /{gemeente_naam} wildcard ──


@router.get("/subsidies/development", response_model=SubsidiesResponse)
async def get_development_subsidies(
    current_user=Depends(get_current_active_user),
) -> SubsidiesResponse:
    """Get development-relevant national subsidies from RVO.

    Fetches subsidies from the RVO open data API, filtered for
    bouw/woning/verduurzaming relevance. Cached for 1 hour.
    """
    results = await fetch_development_subsidies()
    return SubsidiesResponse(
        subsidies=[
            SubsidieResponse(
                id=s.id,
                title=s.title,
                intro=s.intro,
                url=s.url,
                sectors=s.sectors,
                targets=s.targets,
            )
            for s in results
        ],
        total=len(results),
        source="RVO",
    )


@router.get("/checklists/{use_case}")
async def get_checklist_for_use_case(
    use_case: str,
    current_user=Depends(get_current_active_user),
) -> dict:
    """Get vergunning preparation checklist for a development use case.

    Returns a checklist of required documents, checks, and steps.
    Available use cases: optoppen, splitsen, transformatie, nieuwbouw.
    """
    from dataclasses import asdict

    from app.services.checklists import get_checklist

    items = get_checklist(use_case)
    if not items:
        return {"use_case": use_case, "items": [], "total": 0, "error": f"Unknown use case: {use_case}"}
    return {
        "use_case": use_case,
        "items": [asdict(item) for item in items],
        "total": len(items),
    }


# ── Gemeente-scoped routes ──


@router.get("/{gemeente_naam}/profile", response_model=GemeenteProfile)
async def get_gemeente_profile(
    gemeente_naam: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
) -> GemeenteProfile:
    """Get aggregated regulatory posture profile for a municipality.

    Aggregates permit outcomes, bekendmakingen activity, and court
    procedure doorlooptijd from existing data. No external API calls.

    Args:
        gemeente_naam: Municipality display name (e.g., "Venlo", "Amsterdam")
    """
    return await build_gemeente_profile(gemeente_naam, db)


@router.get("/{gemeente_naam}/raadsinformatie", response_model=RaadsinformatieResponse)
async def get_gemeente_raadsinformatie(
    gemeente_naam: str,
    limit: int = Query(default=10, ge=1, le=25),
    current_user=Depends(get_current_active_user),
) -> RaadsinformatieResponse:
    """Search Open Raadsinformatie for development-relevant council documents.

    Queries the ORI Elasticsearch API for vergaderstukken matching
    development keywords (omgevingsvergunning, bestemmingsplan, etc.).
    Results cached for 1 hour.

    Args:
        gemeente_naam: Municipality display name (e.g., "Venlo", "Amsterdam")
        limit: Maximum number of documents to return (1-25, default 10)
    """
    return await get_raadsinformatie(gemeente_naam, limit=limit)


@router.get("/{gemeente_naam}/huisvestingsverordening", response_model=HuisvestingsverordeningResponse)
async def get_huisvestingsverordening(
    gemeente_naam: str,
    current_user=Depends(get_current_active_user),
) -> HuisvestingsverordeningResponse:
    """Search for a gemeente's huisvestingsverordening via KOOP SRU.

    Queries officielebekendmakingen.nl for the most recent
    huisvestingsverordening. Returns metadata + link. Cached 1 hour.

    Args:
        gemeente_naam: Municipality display name (e.g., "Amsterdam", "Venlo")
    """
    result = await search_huisvestingsverordening(gemeente_naam)
    if result is None:
        return HuisvestingsverordeningResponse(
            gemeente_naam=gemeente_naam,
            heeft_verordening=False,
        )
    return HuisvestingsverordeningResponse(
        gemeente_naam=gemeente_naam,
        heeft_verordening=True,
        title=result.title,
        identifier=result.identifier,
        modified=result.modified,
        subject=result.subject,
        url=result.url,
    )


@router.get("/{gemeente_naam}/erfgoed", response_model=ErfgoedResponse)
async def get_gemeente_erfgoed(
    gemeente_naam: str,
    current_user=Depends(get_current_active_user),
) -> ErfgoedResponse:
    """Get beschermde stadsgezichten for a municipality from RCE WFS.

    Fetches all townscapes from RCE (cached 24h) and filters
    by gemeente name. Returns matching beschermde gezichten.

    Args:
        gemeente_naam: Municipality display name (e.g., "Amsterdam")
    """
    gezichten = await get_beschermde_gezichten(gemeente_naam)
    return ErfgoedResponse(
        gemeente_naam=gemeente_naam,
        beschermde_gezichten=[
            BeschermdGezichtResponse(
                naam=g.naam,
                type=g.type,
                aangewezen=g.aangewezen,
                oppervlakte_ha=g.oppervlakte_ha,
            )
            for g in gezichten
        ],
        total=len(gezichten),
    )
