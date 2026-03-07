"""Jurisprudence API endpoints — Rechtspraak Open Data integration + AI analysis.

Endpoints are scoped to omgevingsrecht (environmental/planning law) domain.
Authentication uses the standard project auth dependency (JWT bearer token).
HTTP client is retrieved from request.app.state.http_client (shared AsyncClient).
"""

import hashlib
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.government_apis.base import GovernmentAPIError
from app.government_apis.rechtspraak import rechtspraak_client, validate_ecli
from app.middleware.rate_limit import limiter
from app.models.cached_response import CachedAPIResponse
from app.models.jurisprudence_job import JuridischAnalyseJob

logger = logging.getLogger(__name__)

router = APIRouter()


class JurisprudenceAnalyzeRequest(BaseModel):
    """Request body for triggering jurisprudence AI analysis."""

    ecli_list: list[str] = Field(
        ..., description="List of ECLI identifiers to analyze", min_length=1
    )
    gemeente_naam: str = Field(
        ..., description="Municipality name for context", min_length=1
    )


def _build_cache_key(organization_id: uuid.UUID, ecli_list: list[str]) -> str:
    """Build deterministic cache key from org ID and sorted ECLI list."""
    ecli_hash = hashlib.sha256(",".join(sorted(ecli_list)).encode()).hexdigest()[:16]
    return f"ai_juridisch:{organization_id}:{ecli_hash}"


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


@router.post("/analyze")
@limiter.limit("10/minute")
async def trigger_jurisprudence_analysis(
    request: Request,
    body: JurisprudenceAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    current_user=Depends(get_current_active_user),
):
    """Trigger AI analysis of court rulings for a municipality.

    Checks cache first. If cached result exists and is not expired, returns it.
    Otherwise enqueues an ARQ job for background analysis.
    """
    # Validate ECLI formats
    for ecli in body.ecli_list:
        if not validate_ecli(ecli):
            raise HTTPException(
                status_code=400, detail=f"Invalid ECLI format: {ecli}"
            )

    # Check cache
    cache_key = _build_cache_key(organization_id, body.ecli_list)
    stmt = select(CachedAPIResponse).where(
        CachedAPIResponse.organization_id == organization_id,
        CachedAPIResponse.cache_key == cache_key,
    )
    result = await db.execute(stmt)
    cached = result.scalar_one_or_none()

    if cached:
        # Check TTL
        from datetime import datetime

        age_seconds = (datetime.utcnow() - cached.fetched_at).total_seconds()
        if age_seconds < cached.ttl_seconds:
            return {
                "status": "complete",
                "result": cached.response_data,
                "job_id": None,
            }

    # Create job record
    job_record = JuridischAnalyseJob(
        organization_id=organization_id,
        gemeente_naam=body.gemeente_naam,
        ecli_list=body.ecli_list,
        status="queued",
    )
    db.add(job_record)
    await db.flush()

    # Enqueue ARQ job
    arq_job = await request.app.state.arq_pool.enqueue_job(
        "jurisprudence_analysis_job",
        str(job_record.id),
        str(organization_id),
    )

    # Store ARQ job_id on record
    job_record.job_id = arq_job.job_id
    db.add(job_record)
    await db.flush()
    await db.commit()

    return {"status": "queued", "job_id": str(job_record.id)}


@router.get("/analyze/{job_id}")
async def poll_jurisprudence_analysis(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    current_user=Depends(get_current_active_user),
):
    """Poll status of a jurisprudence analysis job.

    Returns job status with result data when complete, error message when failed.
    Enforces tenant isolation via organization_id.
    """
    try:
        record_uuid = uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid job ID format") from exc

    stmt = select(JuridischAnalyseJob).where(
        JuridischAnalyseJob.id == record_uuid,
        JuridischAnalyseJob.organization_id == organization_id,
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status == "complete":
        # Look up cached result
        cache_key = _build_cache_key(
            str(organization_id), list(job.ecli_list)  # type: ignore[arg-type]
        )
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == organization_id,
            CachedAPIResponse.cache_key == cache_key,
        )
        result = await db.execute(stmt)
        cached = result.scalar_one_or_none()

        return {
            "status": "complete",
            "result": cached.response_data if cached else None,
        }

    if job.status == "failed":
        return {"status": "failed", "error": job.error_message}

    return {"status": job.status}
