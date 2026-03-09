"""Jurisprudence API endpoints -- Rechtspraak Open Data integration + AI analysis.

Endpoints are scoped to omgevingsrecht (environmental/planning law) domain.
Authentication uses the standard project auth dependency (JWT bearer token).
HTTP client is retrieved from request.app.state.http_client (shared AsyncClient).
"""

import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, literal_column, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.government_apis.base import GovernmentAPIError
from app.government_apis.ecli_registry import get_court_codes_for_gemeente
from app.government_apis.rechtspraak import rechtspraak_client, validate_ecli
from app.middleware.rate_limit import limiter
from app.models.ruling_cache import RulingCache
from app.services.doorlooptijd import get_doorlooptijd_stats

logger = logging.getLogger(__name__)

router = APIRouter()

# 7-day TTL for ruling cache freshness check
RULING_CACHE_TTL_SECONDS = 7 * 24 * 3600


@router.get("/search")
async def search_jurisprudence(
    request: Request,
    q: str = Query(..., description="Search query string"),
    max_results: int = Query(10, description="Max results to fetch", le=50),
    sort: str = Query("DESC", description="Sort order (ASC or DESC)"),
    current_user=Depends(get_current_active_user),
):
    """Search jurisprudentie via the Rechtspraak Open Data API.

    Results are automatically filtered to the omgevingsrecht domain.
    Returns up to `max_results` entries sorted by date.
    """
    client = request.app.state.http_client
    try:
        results = await rechtspraak_client.search_jurisprudence(
            query=q,
            client=client,
            max_results=max_results,
            sort=sort,
        )
        return {"status": "success", "results": results}
    except GovernmentAPIError as exc:
        logger.warning("Rechtspraak search error: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Unexpected error in search_jurisprudence: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.get("/rulings/{gemeente_naam}")
async def get_gemeente_rulings(
    gemeente_naam: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
    date_from: str | None = Query(None, description="Filter from date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Filter to date YYYY-MM-DD"),
):
    """Get cached omgevingsrecht rulings for a gemeente.

    Returns cached rulings immediately. If cache is stale (>7 days) or empty,
    enqueues a background ingestion job to refresh. Org-agnostic -- court
    rulings are public data.

    Returns ingestion_status:
      - fresh: cache hit within 7-day TTL
      - refreshing: stale cache returned, background job enqueued
      - pending: no cache, background job enqueued (returns empty list)
    """
    # Validate gemeente is known
    court_codes = get_court_codes_for_gemeente(gemeente_naam)
    if not court_codes:
        raise HTTPException(status_code=404, detail=f"Unknown gemeente: {gemeente_naam}")

    # Compute geo-relevance: gemeente-matched rulings rank higher
    geo_relevance_expr = case(
        (RulingCache.extracted_gemeente == gemeente_naam, "gemeente"),
        else_="arrondissement",
    )

    # Query cached rulings -- include RVS rulings geo-tagged to this gemeente
    stmt = (
        select(RulingCache, geo_relevance_expr.label("geo_relevance"))
        .where(
            (RulingCache.gemeente_query == gemeente_naam)
            | (RulingCache.extracted_gemeente == gemeente_naam)
        )
    )
    if date_from:
        stmt = stmt.where(RulingCache.datum_uitspraak >= date_from)
    if date_to:
        stmt = stmt.where(RulingCache.datum_uitspraak <= date_to)
    # Sort: gemeente-matched first, then by date descending
    stmt = stmt.order_by(
        case((RulingCache.extracted_gemeente == gemeente_naam, 0), else_=1),
        RulingCache.datum_uitspraak.desc(),
    )

    result = await db.execute(stmt)
    rows = result.all()
    rulings = [row[0] for row in rows]
    geo_relevance_map = {row[0].ecli: row[1] for row in rows}

    # Determine cache freshness and ingestion status
    ingestion_status = "fresh"
    if not rulings:
        ingestion_status = "pending"
    else:
        # Check most recent fetched_at
        most_recent = max(r.fetched_at for r in rulings)
        age_seconds = (datetime.utcnow() - most_recent).total_seconds()
        if age_seconds > RULING_CACHE_TTL_SECONDS:
            ingestion_status = "refreshing"

    # Enqueue background ingestion if stale or empty
    if ingestion_status in ("pending", "refreshing"):
        try:
            arq_pool = request.app.state.arq_pool
            await arq_pool.enqueue_job(
                "ruling_ingestion_job",
                gemeente_naam,
                _job_id=f"ruling_ingest:{gemeente_naam}",
            )
            logger.info(
                "Enqueued ruling ingestion job for %s (status: %s)",
                gemeente_naam,
                ingestion_status,
            )
        except Exception as exc:
            logger.warning(
                "Failed to enqueue ruling ingestion for %s: %s",
                gemeente_naam,
                exc,
            )

    # Win/loss ratio aggregation from uitkomst column
    win_loss: dict[str, int] = {
        "toegewezen": 0,
        "afgewezen": 0,
        "gedeeltelijk": 0,
        "onbekend": 0,
        "total": 0,
    }
    for r in rulings:
        uitkomst = r.uitkomst or "onbekend"
        win_loss[uitkomst] = win_loss.get(uitkomst, 0) + 1
        win_loss["total"] += 1

    # Serialize rulings with geo-relevance and uitkomst
    ruling_list = [
        {
            "ecli": r.ecli,
            "court_code": r.court_code,
            "instantie": r.instantie,
            "datum_uitspraak": r.datum_uitspraak,
            "title": r.title,
            "summary": r.summary,
            "extracted_gemeente": r.extracted_gemeente,
            "geo_relevance": geo_relevance_map.get(r.ecli, "arrondissement"),
            "uitkomst": r.uitkomst,
            "vergunningstype": r.vergunningstype,
            "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
        }
        for r in rulings
    ]

    # Include doorlooptijd stats inline
    doorlooptijd = await get_doorlooptijd_stats(db, gemeente_naam)

    return {
        "status": "success",
        "rulings": ruling_list,
        "win_loss": win_loss,
        "doorlooptijd": doorlooptijd,
        "ingestion_status": ingestion_status,
        "count": len(ruling_list),
    }


@router.get("/doc/{ecli:path}")
async def get_jurisprudence_doc(
    ecli: str,
    request: Request,
    current_user=Depends(get_current_active_user),
):
    """Fetch full jurisprudentie document content by ECLI identifier.

    Validates ECLI format before making any HTTP request.
    Returns 400 for invalid ECLI, 404 if not found, 502 on upstream error.
    """
    if not validate_ecli(ecli):
        raise HTTPException(status_code=400, detail="Invalid ECLI format")

    client = request.app.state.http_client
    try:
        doc = await rechtspraak_client.get_jurisprudence_document(
            ecli=ecli,
            client=client,
        )
        if doc is None:
            raise HTTPException(status_code=404, detail="Document not found")

        return {"status": "success", "document": doc}
    except GovernmentAPIError as exc:
        logger.warning("Rechtspraak document error for %s: %s", ecli, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error in get_jurisprudence_doc for %s: %s", ecli, exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@router.post("/analyze/{gemeente_naam}")
@limiter.limit("10/minute")
async def trigger_ruling_analysis(
    gemeente_naam: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Trigger per-ruling AI analysis for a municipality.

    Queries RulingCache for geo-filtered rulings. Splits into already-analyzed
    and needs-analysis sets. Returns complete result from analyzed rulings
    immediately, enqueues ARQ job for un-analyzed rulings if any.
    """
    # Query all geo-filtered rulings for this gemeente
    stmt = select(RulingCache).where(
        (RulingCache.gemeente_query == gemeente_naam)
        | (RulingCache.extracted_gemeente == gemeente_naam)
    )
    result = await db.execute(stmt)
    all_rulings = result.scalars().all()

    if not all_rulings:
        raise HTTPException(
            status_code=404,
            detail=f"No rulings found for gemeente: {gemeente_naam}",
        )

    # Split: analyzed vs needs-analysis
    analyzed = [r for r in all_rulings if r.ai_analysis is not None]
    needs_analysis = [
        r for r in all_rulings
        if r.ai_analysis is None and r.full_text is not None
    ]

    # Build aggregated result from already-analyzed rulings
    ruling_analyses = []
    for r in analyzed:
        analysis = r.ai_analysis
        if analysis:
            ruling_analyses.append(analysis)

    # Compute scores from analyzed rulings
    total = max(len(ruling_analyses), 1)
    toegewezen = sum(
        1 for ra in ruling_analyses if ra.get("uitkomst") == "toegewezen"
    )
    afgewezen = sum(
        1 for ra in ruling_analyses if ra.get("uitkomst") == "afgewezen"
    )
    klimaat_score = round(100 - (100 * afgewezen / total))
    succeskans = round(100 * toegewezen / total)

    job_id = None
    if needs_analysis:
        # Enqueue ARQ job for un-analyzed rulings
        ecli_list = [r.ecli for r in needs_analysis]
        try:
            arq_pool = request.app.state.arq_pool
            arq_job = await arq_pool.enqueue_job(
                "ruling_analysis_job",
                gemeente_naam,
                ecli_list,
                _job_id=f"ruling_analyze:{gemeente_naam}",
            )
            job_id = arq_job.job_id if arq_job else None
            logger.info(
                "Enqueued ruling analysis job for %s (%d un-analyzed)",
                gemeente_naam,
                len(ecli_list),
            )
        except Exception as exc:
            logger.warning(
                "Failed to enqueue ruling analysis for %s: %s",
                gemeente_naam,
                exc,
            )

    return {
        "status": "complete" if not needs_analysis else "partial",
        "gemeente_naam": gemeente_naam,
        "juridisch_klimaat_score": klimaat_score,
        "vergunnings_succeskans": succeskans,
        "ruling_analyses": ruling_analyses,
        "analyzed_count": len(analyzed),
        "pending_count": len(needs_analysis),
        "total_count": len(all_rulings),
        "job_id": job_id,
        "analyzed_at": datetime.utcnow().isoformat(),
    }


@router.get("/analyze/status/{gemeente_naam}")
async def poll_ruling_analysis(
    gemeente_naam: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Poll status of ruling analysis for a gemeente.

    Returns current analysis state by checking RulingCache directly.
    No dependency on JuridischAnalyseJob or CachedAPIResponse.
    """
    stmt = select(RulingCache).where(
        (RulingCache.gemeente_query == gemeente_naam)
        | (RulingCache.extracted_gemeente == gemeente_naam)
    )
    result = await db.execute(stmt)
    all_rulings = result.scalars().all()

    if not all_rulings:
        return {"status": "not_found", "gemeente_naam": gemeente_naam}

    analyzed = [r for r in all_rulings if r.ai_analysis is not None]
    pending = [
        r for r in all_rulings
        if r.ai_analysis is None and r.full_text is not None
    ]

    ruling_analyses = [r.ai_analysis for r in analyzed if r.ai_analysis]

    total = max(len(ruling_analyses), 1)
    toegewezen = sum(
        1 for ra in ruling_analyses if ra.get("uitkomst") == "toegewezen"
    )
    afgewezen = sum(
        1 for ra in ruling_analyses if ra.get("uitkomst") == "afgewezen"
    )

    return {
        "status": "complete" if not pending else "in_progress",
        "gemeente_naam": gemeente_naam,
        "juridisch_klimaat_score": round(100 - (100 * afgewezen / total)),
        "vergunnings_succeskans": round(100 * toegewezen / total),
        "ruling_analyses": ruling_analyses,
        "analyzed_count": len(analyzed),
        "pending_count": len(pending),
        "total_count": len(all_rulings),
    }


@router.get("/doorlooptijd/{gemeente_naam}")
async def get_doorlooptijd(
    gemeente_naam: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get procedure duration statistics per vergunningstype for a gemeente.

    Returns avg/min/max doorlooptijd per permit type category.
    Uses minimum sample size of 3; below that returns insufficient_data: true.
    """
    stats = await get_doorlooptijd_stats(db, gemeente_naam)
    return {"status": "success", **stats}


# --- Explorer endpoint ---

# Rechtbank niveau derivation via CASE expression
_rechtbank_niveau_expr = case(
    (RulingCache.instantie.ilike("Rechtbank%"), "Rechtbank"),
    (RulingCache.instantie.ilike("Gerechtshof%"), "Gerechtshof"),
    (RulingCache.instantie.ilike("%Raad van State%"), "Raad van State"),
    else_="Overig",
).label("rechtbank_niveau")


def _build_explorer_filters(
    *,
    gemeente: str | None,
    vergunningstype: str | None,
    uitkomst: str | None,
    rechtsgrond: str | None,
    rechtbank_niveau: str | None,
    periode: str | None,
    exclude_dimension: str | None = None,
) -> list:
    """Build WHERE clause list, optionally excluding one dimension for cross-faceting."""
    clauses = []

    if gemeente and exclude_dimension != "gemeente":
        clauses.append(
            (RulingCache.extracted_gemeente == gemeente)
            | (RulingCache.gemeente_query == gemeente)
        )

    if vergunningstype and exclude_dimension != "vergunningstype":
        clauses.append(RulingCache.vergunningstype == vergunningstype)

    if uitkomst and exclude_dimension != "uitkomst":
        clauses.append(RulingCache.uitkomst == uitkomst)

    if rechtsgrond and exclude_dimension != "rechtsgrond":
        # JSONB array containment: rechtsgronden @> '["procedurefout"]'
        clauses.append(
            RulingCache.rechtsgronden.op("@>")(f'["{rechtsgrond}"]')
        )

    if rechtbank_niveau and exclude_dimension != "rechtbank_niveau":
        if rechtbank_niveau == "Rechtbank":
            clauses.append(RulingCache.instantie.ilike("Rechtbank%"))
        elif rechtbank_niveau == "Gerechtshof":
            clauses.append(RulingCache.instantie.ilike("Gerechtshof%"))
        elif rechtbank_niveau == "Raad van State":
            clauses.append(RulingCache.instantie.ilike("%Raad van State%"))

    if periode and exclude_dimension != "periode":
        date_from = _periode_to_date(periode)
        if date_from:
            clauses.append(RulingCache.datum_uitspraak >= date_from)

    return clauses


def _periode_to_date(periode: str) -> str | None:
    """Convert periode string to YYYY-MM-DD date_from string."""
    now = datetime.utcnow()
    if periode == "1jaar":
        return (now - timedelta(days=365)).strftime("%Y-%m-%d")
    if periode == "3jaar":
        return (now - timedelta(days=3 * 365)).strftime("%Y-%m-%d")
    if periode == "5jaar":
        return (now - timedelta(days=5 * 365)).strftime("%Y-%m-%d")
    return None  # "alles" or unknown


async def _compute_facet(
    db: AsyncSession,
    dimension: str,
    filters: dict[str, Any],
) -> list[dict[str, Any]]:
    """Compute facet counts for a single dimension with cross-filtering."""
    clauses = _build_explorer_filters(**filters, exclude_dimension=dimension)

    if dimension == "gemeente":
        # Coalesce extracted_gemeente and gemeente_query for grouping
        gemeente_col = func.coalesce(
            RulingCache.extracted_gemeente, RulingCache.gemeente_query
        )
        stmt = (
            select(gemeente_col.label("value"), func.count().label("count"))
            .where(*clauses)
            .where(gemeente_col.isnot(None))
            .group_by(gemeente_col)
            .order_by(func.count().desc())
        )
    elif dimension == "vergunningstype":
        stmt = (
            select(
                RulingCache.vergunningstype.label("value"),
                func.count().label("count"),
            )
            .where(*clauses)
            .where(RulingCache.vergunningstype.isnot(None))
            .group_by(RulingCache.vergunningstype)
            .order_by(func.count().desc())
        )
    elif dimension == "uitkomst":
        stmt = (
            select(
                RulingCache.uitkomst.label("value"),
                func.count().label("count"),
            )
            .where(*clauses)
            .where(RulingCache.uitkomst.isnot(None))
            .group_by(RulingCache.uitkomst)
            .order_by(func.count().desc())
        )
    elif dimension == "rechtsgrond":
        # Unnest JSONB array for grouping
        unnested = func.jsonb_array_elements_text(
            RulingCache.rechtsgronden
        ).column_valued("grond")
        stmt = (
            select(
                literal_column("grond").label("value"),
                func.count().label("count"),
            )
            .select_from(RulingCache)
            .join(unnested, text("true"))
            .where(*clauses)
            .where(RulingCache.rechtsgronden.isnot(None))
            .group_by(literal_column("grond"))
            .order_by(func.count().desc())
        )
    elif dimension == "rechtbank_niveau":
        niveau = case(
            (RulingCache.instantie.ilike("Rechtbank%"), "Rechtbank"),
            (RulingCache.instantie.ilike("Gerechtshof%"), "Gerechtshof"),
            (RulingCache.instantie.ilike("%Raad van State%"), "Raad van State"),
            else_="Overig",
        )
        stmt = (
            select(niveau.label("value"), func.count().label("count"))
            .where(*clauses)
            .where(RulingCache.instantie.isnot(None))
            .group_by(niveau)
            .order_by(func.count().desc())
        )
    else:
        return []

    result = await db.execute(stmt)
    return [{"value": row.value, "count": row.count} for row in result.all()]


@router.get("/explorer")
async def explore_rulings(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
    gemeente: str | None = Query(None, description="Filter by gemeente"),
    vergunningstype: str | None = Query(None, description="Filter by vergunningstype"),
    uitkomst: str | None = Query(None, description="Filter by uitkomst"),
    rechtsgrond: str | None = Query(None, description="Filter by rechtsgrond"),
    rechtbank_niveau: str | None = Query(None, description="Filter by court level"),
    periode: str | None = Query(None, description="Time period: 1jaar, 3jaar, 5jaar, alles"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=50, description="Page size"),
) -> dict[str, Any]:
    """Explore all court rulings with faceted filtering and pagination.

    Returns paginated results with cross-faceted counts for each filter
    dimension. Cross-faceted means each dimension's counts are computed
    with all OTHER active filters applied, but not its own.
    """
    filter_params: dict[str, Any] = {
        "gemeente": gemeente,
        "vergunningstype": vergunningstype,
        "uitkomst": uitkomst,
        "rechtsgrond": rechtsgrond,
        "rechtbank_niveau": rechtbank_niveau,
        "periode": periode,
    }

    # Main query: all filters applied
    all_clauses = _build_explorer_filters(**filter_params)

    # Fetch limit+1 for has_more detection
    stmt = (
        select(RulingCache)
        .where(*all_clauses)
        .order_by(RulingCache.datum_uitspraak.desc().nulls_last())
        .offset(offset)
        .limit(limit + 1)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    has_more = len(rows) > limit
    rulings = rows[:limit]

    # Total count
    count_stmt = select(func.count()).select_from(RulingCache).where(*all_clauses)
    total_count = (await db.execute(count_stmt)).scalar() or 0

    # Serialize results
    results = [
        {
            "ecli": r.ecli,
            "court_code": r.court_code,
            "instantie": r.instantie,
            "datum_uitspraak": r.datum_uitspraak,
            "title": r.title,
            "summary": r.summary,
            "extracted_gemeente": r.extracted_gemeente,
            "uitkomst": r.uitkomst,
            "vergunningstype": r.vergunningstype,
            "rechtsgronden": r.rechtsgronden or [],
            "doorlooptijd_dagen": r.doorlooptijd_dagen,
            "ai_analysis": r.ai_analysis,
        }
        for r in rulings
    ]

    # Cross-faceted counts for all 5 dimensions
    facets: dict[str, list[dict[str, Any]]] = {}
    for dim in ("gemeente", "vergunningstype", "uitkomst", "rechtsgrond", "rechtbank_niveau"):
        facets[dim] = await _compute_facet(db, dim, filter_params)

    return {
        "results": results,
        "total_count": total_count,
        "has_more": has_more,
        "facets": facets,
    }
