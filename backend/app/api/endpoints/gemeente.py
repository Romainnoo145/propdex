"""Gemeente API endpoints — municipality-level intelligence."""

import asyncio
import logging

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.schemas.gemeente import (
    BeleidsdocumentItem,
    BeleidsdocumentenIngestResponse,
    BeleidsdocumentenResponse,
    BeschermdGezichtResponse,
    ChecklistResponse,
    ErfgoedResponse,
    GemeenteProfile,
    HuisvestingsverordeningResponse,
    IngestedDocumentItem,
    RaadsinformatieResponse,
    SubsidieResponse,
    SubsidiesResponse,
)
from app.services.gemeente_profile import build_gemeente_profile
from app.services.koop_sru_client import (
    BELEID_DOCUMENT_TYPES,
    search_beleidsdocument,
    search_huisvestingsverordening,
)
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


@router.get("/{gemeente_naam}/beleidsdocumenten", response_model=BeleidsdocumentenResponse)
@limiter.limit("60/minute")
async def get_beleidsdocumenten(
    request: Request,
    gemeente_naam: str,
    current_user=Depends(get_current_active_user),
) -> BeleidsdocumentenResponse:
    """Fetch all available beleidsdocumenten for a municipality.

    Searches KOOP SRU (CVDR) in parallel for: omgevingsvisie, woonvisie,
    welstandsnota, parkeernormen, grondbeleid, and huisvestingsverordening.
    Returns metadata + links for each document type found. Cached 1 hour.

    Args:
        gemeente_naam: Municipality display name (e.g., "Amsterdam", "Venlo")
    """
    # Search all beleidsdocument types + huisvestingsverordening in parallel
    all_types = {**BELEID_DOCUMENT_TYPES, "huisvestingsverordening": ["huisvestingsverordening"]}

    search_tasks = {
        doc_type: search_beleidsdocument(gemeente_naam, title_terms)
        for doc_type, title_terms in all_types.items()
    }

    results = await asyncio.gather(*search_tasks.values(), return_exceptions=True)

    documenten: list[BeleidsdocumentItem] = []
    for doc_type, result in zip(search_tasks.keys(), results):
        if isinstance(result, Exception):
            logger.warning("Beleidsdocument search failed for %s/%s: %s", gemeente_naam, doc_type, result)
            result = None

        if result is not None:
            documenten.append(
                BeleidsdocumentItem(
                    document_type=doc_type,
                    gevonden=True,
                    title=result.title,
                    identifier=result.identifier,
                    modified=result.modified,
                    subject=result.subject,
                    url=result.url,
                )
            )
        else:
            documenten.append(
                BeleidsdocumentItem(document_type=doc_type, gevonden=False)
            )

    total_gevonden = sum(1 for d in documenten if d.gevonden)
    return BeleidsdocumentenResponse(
        gemeente_naam=gemeente_naam,
        documenten=documenten,
        total_gevonden=total_gevonden,
        total_types=len(all_types),
    )


@router.post("/{gemeente_naam}/beleidsdocumenten/ingest", response_model=BeleidsdocumentenIngestResponse)
@limiter.limit("5/minute")
async def ingest_beleidsdocumenten(
    request: Request,
    gemeente_naam: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
) -> BeleidsdocumentenIngestResponse:
    """Download and store all beleidsdocumenten for a municipality.

    Searches KOOP SRU for all document types, downloads PDFs from
    officielebekendmakingen.nl, stores them in gemeente_documents,
    and triggers AI summarization. Skips already-ingested documents.

    Rate limited to 5/minute due to external downloads.

    Args:
        gemeente_naam: Municipality display name (e.g., "Amsterdam", "Venlo")
    """
    from app.services.beleid_ingest import ingest_all_beleidsdocumenten

    docs = await ingest_all_beleidsdocumenten(gemeente_naam, db)
    return BeleidsdocumentenIngestResponse(
        gemeente_naam=gemeente_naam,
        ingested=[
            IngestedDocumentItem(
                id=str(doc.id),
                gemeente_naam=doc.gemeente_naam,
                document_type=doc.document_type,
                filename=doc.filename,
                content_type=doc.content_type,
                file_size=doc.file_size,
                source_url=doc.source_url,
                koop_identifier=doc.koop_identifier,
                ai_summary=doc.ai_summary,
            )
            for doc in docs
        ],
        total_ingested=len(docs),
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
