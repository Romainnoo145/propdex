"""Gemeente API endpoints — municipality-level intelligence."""

import logging

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.ai.factors.woondeal import WoondealPayload
from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.factor_extraction_cache import FactorExtractionCache
from app.schemas.gemeente import (
    BeschermdGezichtResponse,
    ChecklistResponse,
    ErfgoedResponse,
    GemeenteProfile,
    HuisvestingsverordeningResponse,
    RaadsinformatieResponse,
    SubsidieResponse,
    SubsidiesResponse,
    WoondealGemeenteResponse,
    WoondealOpgaveOut,
)
from app.services.cascade_enrichment_service import get_woondeal_document
from app.services.gemeente_profile import build_gemeente_profile
from app.services.koop_sru_client import search_huisvestingsverordening
from app.services.raadsinformatie import get_raadsinformatie
from app.services.rce_erfgoed_client import get_beschermde_gezichten
from app.services.rvo_client import fetch_development_subsidies

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gemeente", tags=["Gemeente"])


# ── Static routes MUST come before /{gemeente_naam} wildcard ──


@router.get("/subsidies/development", response_model=SubsidiesResponse)
@limiter.limit("60/minute")
async def get_development_subsidies(
    request: Request,
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


@router.get("/checklists/{use_case}", response_model=ChecklistResponse)
@limiter.limit("60/minute")
async def get_checklist_for_use_case(
    request: Request,
    use_case: str,
    current_user=Depends(get_current_active_user),
) -> dict:
    """Get vergunning preparation checklist for a development use case.

    Returns a checklist of required documents, checks, and steps.
    Available use cases: optoppen, splitsen, transformatie, nieuwbouw.
    """
    from dataclasses import asdict

    from app.services.checklists import PHASE_ORDER, get_checklist

    items = get_checklist(use_case)
    if not items:
        return {"use_case": use_case, "items": [], "total": 0, "phases": PHASE_ORDER, "error": f"Unknown use case: {use_case}"}
    return {
        "use_case": use_case,
        "items": [asdict(item) for item in items],
        "total": len(items),
        "phases": PHASE_ORDER,
    }


# ── Gemeente-scoped routes ──


@router.get("/{gemeente_naam}/profile", response_model=GemeenteProfile)
@limiter.limit("60/minute")
async def get_gemeente_profile(
    request: Request,
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
@limiter.limit("60/minute")
async def get_gemeente_raadsinformatie(
    request: Request,
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
@limiter.limit("60/minute")
async def get_huisvestingsverordening(
    request: Request,
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
@limiter.limit("60/minute")
async def get_gemeente_erfgoed(
    request: Request,
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


def _normalize_naam(naam: str) -> str:
    return " ".join(naam.lower().split())


@router.get("/{gemeente_code}/woondeal", response_model=WoondealGemeenteResponse)
@limiter.limit("60/minute")
async def get_woondeal(
    request: Request,
    gemeente_code: str,
    gemeente_naam: str,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> WoondealGemeenteResponse:
    """Woondeal context for a gemeente (context-only — no score).

    Reads the extraction cache only; production is warmed by
    `python -m app.tools.reextract_woondeal`.

    Args:
        gemeente_code: CBS gemeente code (e.g., "GM0983")
        gemeente_naam: Municipality display name for per-gemeente row lookup
    """
    gm = gemeente_code if gemeente_code.startswith("GM") else f"GM{gemeente_code}"
    doc = await get_woondeal_document(
        db, gemeente_code=gm, organization_id=current_user.organization_id
    )
    if doc is None:
        return WoondealGemeenteResponse(gemeente_naam=gemeente_naam, heeft_woondeal=False)

    cached = (
        await db.execute(
            select(FactorExtractionCache)
            .where(
                FactorExtractionCache.policy_document_id == doc.id,
                FactorExtractionCache.parcel_id == DOCUMENT_SENTINEL,
                FactorExtractionCache.factor_id == "woondeal",
                FactorExtractionCache.schema_version == SCHEMA_VERSION,
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if cached is None:
        return WoondealGemeenteResponse(
            gemeente_naam=gemeente_naam,
            heeft_woondeal=False,
            document_title=doc.filename,
        )

    payload = WoondealPayload.model_validate(cached.extracted_payload)
    needle = _normalize_naam(gemeente_naam)
    row = next(
        (g for g in payload.gemeenten if _normalize_naam(g.gemeente_naam) == needle),
        None,
    )
    opgave = None
    if row is not None:
        gat = (
            row.toevoegingen - row.plancapaciteit
            if row.toevoegingen is not None and row.plancapaciteit is not None
            else None
        )
        opgave = WoondealOpgaveOut(
            gemeente_naam=row.gemeente_naam,
            toevoegingen=row.toevoegingen,
            plancapaciteit=row.plancapaciteit,
            gat=gat,
            sleutelprojecten_aantal=row.sleutelprojecten_aantal,
            sleutelprojecten_woningen=row.sleutelprojecten_woningen,
        )

    return WoondealGemeenteResponse(
        gemeente_naam=gemeente_naam,
        heeft_woondeal=True,
        regio_naam=payload.regio_naam or None,
        periode=payload.periode,
        opgave=opgave,
        aandeel_betaalbaar=payload.aandeel_betaalbaar,
        betaalbaar_definitie=payload.betaalbaar_definitie,
        regelingen=payload.regelingen,
        doelgroepen=payload.doelgroepen,
        document_title=doc.filename,
    )
