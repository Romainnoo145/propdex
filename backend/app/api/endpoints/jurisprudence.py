"""Jurisprudence API endpoints -- Rechtspraak Open Data integration + AI analysis.

Endpoints are scoped to omgevingsrecht (environmental/planning law) domain.
Authentication uses the standard project auth dependency (JWT bearer token).
HTTP client is retrieved from request.app.state.http_client (shared AsyncClient).
"""

import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.api.endpoints.jurisprudence_schemas import (
    AnalysisStatusResponse,
    AnalysisTriggerResponse,
    DoorlooptijdResponse,
    ExplorerResponse,
    GemeenteRulingsResponse,
    JurisprudenceDocResponse,
    JurisprudenceSearchResponse,
    TrendResponse,
)
from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.government_apis.base import GovernmentAPIError
from app.government_apis.ecli_registry import get_court_codes_for_gemeente
from app.government_apis.rechtspraak import rechtspraak_client, validate_ecli
from app.middleware.rate_limit import limiter
from app.models.ruling_cache import RulingCache
from app.services.doorlooptijd import get_doorlooptijd_stats
from app.services.ruling_aggregator import aggregate_dev_type_rulings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jurisprudence", tags=["Jurisprudence"])

# 7-day TTL for ruling cache freshness check
RULING_CACHE_TTL_SECONDS = 7 * 24 * 3600


@router.get("/search", response_model=JurisprudenceSearchResponse)
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


@router.get("/rulings/{gemeente_naam}", response_model=GemeenteRulingsResponse)
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
        arq_pool = getattr(request.app.state, "arq_pool", None)
        if arq_pool is not None:
            try:
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
        else:
            logger.warning("ARQ pool not available — skipping ruling ingestion for %s", gemeente_naam)

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


@router.get("/doc/{ecli:path}", response_model=JurisprudenceDocResponse)
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


@router.post("/analyze/{gemeente_naam}", response_model=AnalysisTriggerResponse)
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

    # Dev-type filter: only aggregate over rulings that match developer-relevant
    # vergunningstypen (nieuwbouw, sloop, bestemmingswijziging, uitbreiding).
    # See app.services.ruling_aggregator and M046/S01 for rationale.
    aggregation = aggregate_dev_type_rulings(ruling_analyses)

    job_id = None
    if needs_analysis:
        # Enqueue ARQ job for un-analyzed rulings
        ecli_list = [r.ecli for r in needs_analysis]
        arq_pool = getattr(request.app.state, "arq_pool", None)
        if arq_pool is not None:
            try:
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
        else:
            logger.warning("ARQ pool not available — skipping ruling analysis for %s", gemeente_naam)

    return {
        "status": "complete" if not needs_analysis else "partial",
        "gemeente_naam": gemeente_naam,
        "juridisch_klimaat_score": aggregation.klimaat_score,
        "vergunnings_succeskans": aggregation.succeskans,
        "succeskans_missing": aggregation.missing,
        "succeskans_reason": aggregation.reason,
        "dev_type_ruling_count": aggregation.ruling_count_dev_types,
        "total_ruling_count": aggregation.ruling_count_total,
        "ruling_analyses": ruling_analyses,
        "analyzed_count": len(analyzed),
        "pending_count": len(needs_analysis),
        "total_count": len(all_rulings),
        "job_id": job_id,
        "analyzed_at": datetime.utcnow().isoformat(),
    }


@router.get("/analyze/status/{gemeente_naam}", response_model=AnalysisStatusResponse)
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

    # Dev-type filter: same aggregator as trigger endpoint — single source of truth.
    aggregation = aggregate_dev_type_rulings(ruling_analyses)

    return {
        "status": "complete" if not pending else "in_progress",
        "gemeente_naam": gemeente_naam,
        "juridisch_klimaat_score": aggregation.klimaat_score,
        "vergunnings_succeskans": aggregation.succeskans,
        "succeskans_missing": aggregation.missing,
        "succeskans_reason": aggregation.reason,
        "dev_type_ruling_count": aggregation.ruling_count_dev_types,
        "total_ruling_count": aggregation.ruling_count_total,
        "ruling_analyses": ruling_analyses,
        "analyzed_count": len(analyzed),
        "pending_count": len(pending),
        "total_count": len(all_rulings),
    }


@router.get("/doorlooptijd/{gemeente_naam}", response_model=DoorlooptijdResponse)
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
        # JSONB array containment — use CAST() not :: to avoid
        # conflict with SQLAlchemy's :param syntax
        clauses.append(
            text(
                "ruling_cache.rechtsgronden @> CAST(:rg AS jsonb)"
            ).bindparams(rg=f'["{rechtsgrond}"]')
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
        gemeente_col = func.coalesce(
            RulingCache.extracted_gemeente, RulingCache.gemeente_query
        )
        stmt = (
            select(gemeente_col.label("value"), func.count().label("count"))
            .where(gemeente_col.isnot(None))
            .group_by(gemeente_col)
            .order_by(func.count().desc())
        )
    elif dimension == "vergunningstype":
        stmt = (
            select(RulingCache.vergunningstype.label("value"), func.count().label("count"))
            .where(RulingCache.vergunningstype.isnot(None))
            .group_by(RulingCache.vergunningstype)
            .order_by(func.count().desc())
        )
    elif dimension == "uitkomst":
        stmt = (
            select(RulingCache.uitkomst.label("value"), func.count().label("count"))
            .where(RulingCache.uitkomst.isnot(None))
            .group_by(RulingCache.uitkomst)
            .order_by(func.count().desc())
        )
    elif dimension == "rechtsgrond":
        # Raw SQL for JSONB unnest — SQLAlchemy can't properly join
        # set-returning functions with asyncpg.
        where_parts = ["ruling_cache.rechtsgronden IS NOT NULL"]
        params: dict[str, Any] = {}
        # Apply cross-filter clauses manually (exclude_dimension=rechtsgrond
        # means rechtsgrond filter is already excluded by _build_explorer_filters)
        f = filters
        if f.get("gemeente"):
            where_parts.append(
                "(ruling_cache.extracted_gemeente = :gemeente "
                "OR ruling_cache.gemeente_query = :gemeente)"
            )
            params["gemeente"] = f["gemeente"]
        if f.get("vergunningstype"):
            where_parts.append("ruling_cache.vergunningstype = :vtype")
            params["vtype"] = f["vergunningstype"]
        if f.get("uitkomst"):
            where_parts.append("ruling_cache.uitkomst = :uitkomst")
            params["uitkomst"] = f["uitkomst"]
        if f.get("rechtbank_niveau"):
            niveau_map = {
                "Rechtbank": "Rechtbank%",
                "Gerechtshof": "Gerechtshof%",
                "Raad van State": "%Raad van State%",
            }
            pattern = niveau_map.get(f["rechtbank_niveau"])
            if pattern:
                where_parts.append("ruling_cache.instantie ILIKE :niveau")
                params["niveau"] = pattern
        if f.get("periode"):
            date_from = _periode_to_date(f["periode"])
            if date_from:
                where_parts.append("ruling_cache.datum_uitspraak >= :date_from")
                params["date_from"] = date_from

        where_sql = " AND ".join(where_parts)
        raw = text(
            "SELECT grond AS value, count(*) AS count "
            "FROM ruling_cache, jsonb_array_elements_text(ruling_cache.rechtsgronden) AS grond "
            f"WHERE {where_sql} "
            "GROUP BY grond ORDER BY count(*) DESC"
        )
        result = await db.execute(raw, params)
        return [{"value": row.value, "count": row.count} for row in result.all()]
    elif dimension == "rechtbank_niveau":
        niveau = case(
            (RulingCache.instantie.ilike("Rechtbank%"), "Rechtbank"),
            (RulingCache.instantie.ilike("Gerechtshof%"), "Gerechtshof"),
            (RulingCache.instantie.ilike("%Raad van State%"), "Raad van State"),
            else_="Overig",
        )
        stmt = (
            select(niveau.label("value"), func.count().label("count"))
            .where(RulingCache.instantie.isnot(None))
            .group_by(niveau)
            .order_by(func.count().desc())
        )
    else:
        return []

    if clauses:
        stmt = stmt.where(*clauses)

    result = await db.execute(stmt)
    return [{"value": row.value, "count": row.count} for row in result.all()]


@router.get("/explorer", response_model=ExplorerResponse)
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
    stmt = select(RulingCache).order_by(
        RulingCache.datum_uitspraak.desc().nulls_last()
    ).offset(offset).limit(limit + 1)
    if all_clauses:
        stmt = stmt.where(*all_clauses)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    has_more = len(rows) > limit
    rulings = rows[:limit]

    # Total count
    count_stmt = select(func.count()).select_from(RulingCache)
    if all_clauses:
        count_stmt = count_stmt.where(*all_clauses)
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

    # Doorlooptijd stats per vergunningstype (using same filter set)
    dl_stmt = (
        select(
            RulingCache.vergunningstype,
            func.count(RulingCache.doorlooptijd_dagen).label("count"),
            func.avg(RulingCache.doorlooptijd_dagen).label("avg_dagen"),
            func.min(RulingCache.doorlooptijd_dagen).label("min_dagen"),
            func.max(RulingCache.doorlooptijd_dagen).label("max_dagen"),
        )
        .where(
            RulingCache.doorlooptijd_dagen.isnot(None),
            RulingCache.vergunningstype.isnot(None),
        )
        .group_by(RulingCache.vergunningstype)
    )
    if all_clauses:
        dl_stmt = dl_stmt.where(*all_clauses)
    dl_rows = (await db.execute(dl_stmt)).all()

    doorlooptijd_per_type = [
        {
            "vergunningstype": row.vergunningstype,
            "count": row.count,
            "avg_dagen": round(float(row.avg_dagen)) if row.avg_dagen else None,
            "min_dagen": row.min_dagen,
            "max_dagen": row.max_dagen,
        }
        for row in dl_rows
        if row.count >= 2
    ]

    # Opponent profiles: aggregate tegenstanders WITHOUT uitkomst filter
    # (uitkomst filter only affects ruling cards, not opponent stats)
    opp_clauses = _build_explorer_filters(
        gemeente=gemeente,
        vergunningstype=vergunningstype,
        uitkomst=None,  # exclude uitkomst from opponent filtering
        rechtsgrond=rechtsgrond,
        rechtbank_niveau=rechtbank_niveau,
        periode=periode,
    )
    opp_stmt = (
        select(RulingCache.tegenstanders, RulingCache.ecli, RulingCache.uitkomst)
        .where(RulingCache.tegenstanders.isnot(None))
    )
    if opp_clauses:
        opp_stmt = opp_stmt.where(*opp_clauses)
    opp_rows = (await db.execute(opp_stmt)).all()

    # Normalize opponent names (case-insensitive dedup, keep first-seen casing)
    opponent_map: dict[str, dict[str, Any]] = {}
    name_canonical: dict[str, str] = {}  # lowered → first-seen original
    for row in opp_rows:
        opponents = row.tegenstanders
        if not isinstance(opponents, list):
            continue
        for name in opponents:
            key = name.lower().strip()
            if key not in name_canonical:
                name_canonical[key] = name
            canonical = name_canonical[key]
            if canonical not in opponent_map:
                opponent_map[canonical] = {"naam": canonical, "zaken": 0, "gewonnen": 0, "verloren": 0}
            opponent_map[canonical]["zaken"] += 1
            if row.uitkomst == "afgewezen":
                # Beroep afgewezen = tegenstander (bestuursorgaan) wint
                opponent_map[canonical]["gewonnen"] += 1
            elif row.uitkomst == "toegewezen":
                # Beroep toegewezen = tegenstander verliest
                opponent_map[canonical]["verloren"] += 1

    opponent_profiles = sorted(
        opponent_map.values(), key=lambda x: x["zaken"], reverse=True
    )

    return {
        "results": results,
        "total_count": total_count,
        "has_more": has_more,
        "facets": facets,
        "doorlooptijd_per_type": doorlooptijd_per_type,
        "opponent_profiles": opponent_profiles,
    }


# --- Trend endpoint ---


@router.get("/trend/{gemeente_naam}", response_model=TrendResponse)
@limiter.limit("30/minute")
async def get_trend(
    gemeente_naam: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get rolling 12-month trend data for a gemeente's juridisch klimaat.

    Returns monthly buckets with klimaat_score, outcome counts, and avg
    doorlooptijd, plus an aggregated summary across all months.
    Only months with actual rulings are included (no zero-filled gaps).
    """
    twelve_months_ago = (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d")

    # Monthly aggregation query on ruling_cache
    month_col = func.to_char(
        func.to_date(RulingCache.datum_uitspraak, text("'YYYY-MM-DD'")),
        text("'YYYY-MM'"),
    ).label("month")

    gemeente_filter = (
        (RulingCache.gemeente_query == gemeente_naam)
        | (RulingCache.extracted_gemeente == gemeente_naam)
    )

    stmt = (
        select(
            month_col,
            func.count().label("total"),
            func.sum(
                case((RulingCache.uitkomst == "toegewezen", 1), else_=0)
            ).label("toegewezen"),
            func.sum(
                case((RulingCache.uitkomst == "afgewezen", 1), else_=0)
            ).label("afgewezen"),
            func.sum(
                case((RulingCache.uitkomst == "gedeeltelijk", 1), else_=0)
            ).label("gedeeltelijk"),
            func.avg(RulingCache.doorlooptijd_dagen).label("avg_doorlooptijd"),
        )
        .where(gemeente_filter)
        .where(RulingCache.datum_uitspraak.isnot(None))
        .where(RulingCache.datum_uitspraak >= twelve_months_ago)
        .group_by(month_col)
        .order_by(month_col)
    )

    result = await db.execute(stmt)
    rows = result.all()

    # Build per-month response with klimaat_score
    months = []
    total_rulings = 0
    total_toegewezen = 0
    weighted_doorlooptijd_sum = 0.0
    doorlooptijd_count = 0

    for row in rows:
        total = row.total or 0
        toegewezen = row.toegewezen or 0
        afgewezen = row.afgewezen or 0
        gedeeltelijk = row.gedeeltelijk or 0
        avg_dl = row.avg_doorlooptijd

        klimaat_score = round(100 - (100 * afgewezen / max(total, 1)))

        month_entry: dict[str, Any] = {
            "month": row.month,
            "total": total,
            "toegewezen": toegewezen,
            "afgewezen": afgewezen,
            "gedeeltelijk": gedeeltelijk,
            "klimaat_score": klimaat_score,
            "avg_doorlooptijd": round(float(avg_dl)) if avg_dl is not None else None,
        }
        months.append(month_entry)

        # Accumulate for summary
        total_rulings += total
        total_toegewezen += toegewezen
        if avg_dl is not None:
            weighted_doorlooptijd_sum += float(avg_dl) * total
            doorlooptijd_count += total

    # Compute summary stats
    summary = {
        "total_rulings": total_rulings,
        "avg_doorlooptijd": (
            round(weighted_doorlooptijd_sum / doorlooptijd_count)
            if doorlooptijd_count > 0
            else None
        ),
        "succes_pct": round(100 * total_toegewezen / max(total_rulings, 1)),
        "months_with_data": len(months),
    }

    return {
        "gemeente_naam": gemeente_naam,
        "months": months,
        "summary": summary,
    }
