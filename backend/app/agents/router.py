"""FastAPI router for the bulk query agent endpoints."""

import csv
import io
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.bulk_query_service import execute_bulk_query, parse_nl_query
from app.agents.schemas import (
    BulkQueryDetailResponse,
    BulkQueryHistoryResponse,
    BulkQueryRequest,
    BulkQueryResponse,
    BulkQuerySummary,
    BulkRequestCreate,
    BulkRequestListResponse,
    BulkRequestResponse,
    BulkResult,
    ParsedQuery,
)
from app.ai.claude_client import AIParsingError
from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.bulk_query import BulkQuery
from app.models.bulk_request import BulkRequest
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["Agents"])


# ---------------------------------------------------------------------------
# POST /bulk-query — execute a new natural-language query
# ---------------------------------------------------------------------------


@router.post("/bulk-query", response_model=BulkQueryResponse)
@limiter.limit("30/minute")
async def bulk_query(
    request: Request,
    body: BulkQueryRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> BulkQueryResponse:
    """Translate a natural-language query into structured parcel filters and return results."""
    try:
        parsed, reason = await parse_nl_query(body.query)
    except AIParsingError as e:
        record = BulkQuery(
            user_id=user.id, query_text=body.query,
            parsed_query=None, result_count=0, status="failed", results=None,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        logger.error("Bulk query failed (id=%s): %s", record.id, e.message)
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {e.message}") from e

    if parsed is None:
        record = BulkQuery(
            user_id=user.id, query_text=body.query,
            parsed_query=None, result_count=0, status="unsupported", results=None,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return BulkQueryResponse(type="unsupported", query_id=str(record.id), reason=reason)

    try:
        results, total = await execute_bulk_query(parsed, db)
    except ValueError as e:
        record = BulkQuery(
            user_id=user.id, query_text=body.query,
            parsed_query=parsed.model_dump(), result_count=0, status="failed", results=None,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        raise HTTPException(status_code=422, detail=str(e)) from e

    record = BulkQuery(
        user_id=user.id, query_text=body.query,
        parsed_query=parsed.model_dump(), result_count=total,
        status="completed", results=[r.model_dump() for r in results],
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return BulkQueryResponse(
        type="results", query_id=str(record.id),
        results=results, total=total, parsed=parsed,
    )


# ---------------------------------------------------------------------------
# GET /bulk-queries — paginated history
# ---------------------------------------------------------------------------


@router.get("/bulk-queries", response_model=BulkQueryHistoryResponse)
@limiter.limit("30/minute")
async def list_bulk_queries(
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> BulkQueryHistoryResponse:
    """Return paginated history of the current user's bulk queries."""
    base = select(BulkQuery).where(BulkQuery.user_id == user.id)

    total = (await db.execute(
        select(func.count()).select_from(BulkQuery).where(BulkQuery.user_id == user.id)
    )).scalar_one()

    rows = (await db.execute(
        base.order_by(BulkQuery.created_at.desc()).offset(offset).limit(limit)
    )).scalars().all()

    return BulkQueryHistoryResponse(
        queries=[
            BulkQuerySummary(
                id=str(q.id),
                query_text=q.query_text,
                result_count=q.result_count,
                status=q.status,
                created_at=q.created_at.isoformat(),
            )
            for q in rows
        ],
        total=total,
    )


# ---------------------------------------------------------------------------
# GET /bulk-queries/{id} — single query with full results
# ---------------------------------------------------------------------------


@router.get("/bulk-queries/{query_id}", response_model=BulkQueryDetailResponse)
@limiter.limit("30/minute")
async def get_bulk_query(
    request: Request,
    query_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> BulkQueryDetailResponse:
    """Return full details and results for a single bulk query."""
    row = (await db.execute(
        select(BulkQuery).where(BulkQuery.id == query_id)
    )).scalar_one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="Query not found")
    if row.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    results = [BulkResult.model_validate(r) for r in (row.results or [])]
    parsed = ParsedQuery.model_validate(row.parsed_query) if row.parsed_query else None

    return BulkQueryDetailResponse(
        id=str(row.id),
        query_text=row.query_text,
        result_count=row.result_count,
        status=row.status,
        parsed=parsed,
        results=results,
        created_at=row.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# GET /bulk-queries/{id}/csv — CSV download
# ---------------------------------------------------------------------------


CSV_COLUMNS = ["parcel_id", "address", "municipality", "build_year", "area_m2", "bestemming", "pand_status"]
CSV_HEADERS = ["Perceel ID", "Adres", "Gemeente", "Bouwjaar", "Oppervlakte (m²)", "Bestemming", "Pandstatus"]


@router.get("/bulk-queries/{query_id}/csv")
@limiter.limit("30/minute")
async def export_bulk_query_csv(
    request: Request,
    query_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Download bulk query results as CSV."""
    row = (await db.execute(
        select(BulkQuery).where(BulkQuery.id == query_id)
    )).scalar_one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="Query not found")
    if row.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(CSV_HEADERS)

    for r in (row.results or []):
        writer.writerow([r.get(col, "") for col in CSV_COLUMNS])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="bulk-query-{query_id}.csv"'},
    )


# ---------------------------------------------------------------------------
# POST /bulk-request — submit manual request for unsupported query
# ---------------------------------------------------------------------------


@router.post("/bulk-request", response_model=BulkRequestResponse)
@limiter.limit("30/minute")
async def create_bulk_request(
    request: Request,
    body: BulkRequestCreate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> BulkRequestResponse:
    """Submit a manual request for a query that can't be auto-resolved."""
    record = BulkRequest(
        user_id=user.id,
        query_text=body.query_text,
        status="pending",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    logger.info("Bulk request created (id=%s): %s", record.id, body.query_text[:80])

    return BulkRequestResponse(
        id=str(record.id),
        query_text=record.query_text,
        status=record.status,
        admin_note=record.admin_note,
        results_query_id=str(record.results_query_id) if record.results_query_id else None,
        created_at=record.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# GET /bulk-requests — admin list of pending requests
# ---------------------------------------------------------------------------


@router.get("/bulk-requests", response_model=BulkRequestListResponse)
@limiter.limit("30/minute")
async def list_bulk_requests(
    request: Request,
    status: str | None = Query(None, description="Filter by status: pending, completed, rejected"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> BulkRequestListResponse:
    """List manual bulk requests. Currently visible to all authenticated users — admin restriction deferred to S04."""
    base = select(BulkRequest)
    count_q = select(func.count()).select_from(BulkRequest)

    if status:
        base = base.where(BulkRequest.status == status)
        count_q = count_q.where(BulkRequest.status == status)

    total = (await db.execute(count_q)).scalar_one()

    rows = (await db.execute(
        base.order_by(BulkRequest.created_at.desc()).offset(offset).limit(limit)
    )).scalars().all()

    return BulkRequestListResponse(
        requests=[
            BulkRequestResponse(
                id=str(r.id),
                query_text=r.query_text,
                status=r.status,
                admin_note=r.admin_note,
                results_query_id=str(r.results_query_id) if r.results_query_id else None,
                created_at=r.created_at.isoformat(),
            )
            for r in rows
        ],
        total=total,
    )
