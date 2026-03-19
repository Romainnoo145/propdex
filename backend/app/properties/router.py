"""Property lookup API endpoints."""

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas import JobStatusResponse
from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.government_apis.base import APINotFoundError, GovernmentAPIError
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.address import AddressInput
from app.schemas.property import PropertyReportResponse
from app.services.pdf_downloader import (
    PDFDownloadError,
    store_uploaded_pdf,
    validate_imro_identifier,
)
from app.services.plan_aggregator import enqueue_parsing_job, get_job_status
from app.services.property_aggregator import aggregate_property_data

router = APIRouter(prefix="/api/properties", tags=["properties"])

# Module-level PDOK client instance
_pdok_client = PDOKLocatieserver()


@router.post("/lookup", response_model=PropertyReportResponse)
@limiter.limit("30/minute")
async def lookup_property(
    request: Request,
    input_data: AddressInput,
    force_refresh: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PropertyReportResponse:
    """
    Look up property data by Dutch address.

    Aggregates data from multiple government APIs:
    - BAG API: Address and building data
    - PDOK Cadastral API: Parcel/ownership data
    - DSO Ruimtelijke Plannen API: Zoning and building dimensions
    - RCE Rijksmonument API: Monument status

    Returns complete property intelligence report with zoning rules,
    monument status, map data with geometries, section-level source
    attribution, cache metadata, and completeness scoring. Supports
    partial failures (returns partial data if some APIs fail).

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        input_data: Address input (postcode + huisnummer)
        force_refresh: If True, bypass all caches and fetch fresh data (for "Vernieuwen" button)
        current_user: Authenticated user
        organization_id: Tenant ID for cache isolation
        db: Database session

    Returns:
        PropertyReportResponse: Aggregated property intelligence report

    Raises:
        HTTPException 404: Address not found in BAG registry
        HTTPException 502: Upstream API failure
        HTTPException 500: Internal server error
    """
    # Get shared httpx client from app state
    client = request.app.state.http_client

    try:
        result = await aggregate_property_data(
            input_data=input_data,
            client=client,
            session=db,
            force_refresh=force_refresh,
            arq_pool=request.app.state.arq_pool,
        )
        return result

    except HTTPException:
        # Re-raise HTTPExceptions from aggregator (already formatted)
        raise
    except APINotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found in BAG registry",
        ) from e
    except GovernmentAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream API error: {e.message}",
        ) from e
    except Exception as e:
        # Catch-all for unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during property lookup",
        ) from e


@router.get("/suggest")
@limiter.limit("60/minute")
async def suggest_addresses(
    request: Request,
    q: str,
    current_user: User = Depends(get_current_active_user),
) -> list[dict]:
    """
    Get address autocomplete suggestions.

    Provides real-time address suggestions for user input using PDOK Locatieserver.
    Useful for frontend address input forms.

    Requires JWT authentication. Rate limited to 60 requests per minute
    (higher than lookup since autocomplete needs responsive UX).

    Args:
        request: FastAPI request object
        q: Search query (minimum 2 characters)
        current_user: Authenticated user

    Returns:
        list[dict]: List of address suggestions with metadata

    Raises:
        HTTPException 400: Query too short
        HTTPException 502: Upstream API failure
    """
    if len(q) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query must be at least 2 characters",
        )

    # Get shared httpx client from app state
    client = request.app.state.http_client

    try:
        suggestions = await _pdok_client.suggest(query=q, client=client)
        return suggestions
    except GovernmentAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Address suggestion service unavailable: {e.message}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during address suggestion",
        ) from e


@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
@limiter.limit("60/minute")
async def job_status(
    request: Request,
    job_id: str,
    current_user: User = Depends(get_current_active_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> JobStatusResponse:
    """
    Get AI parsing job status for polling.

    Polls ARQ background job status with tenant isolation. Used by frontend
    to track bestemmingsplan PDF parsing progress.

    Requires JWT authentication. Rate limited to 60 requests per minute
    (polling endpoint needs responsive UX).

    Args:
        request: FastAPI request object
        job_id: ARQ job identifier from initial lookup or upload response
        current_user: Authenticated user
        organization_id: Tenant ID for job ownership validation
        db: Database session

    Returns:
        JobStatusResponse: Job status with progress, data if complete, or error

    Raises:
        HTTPException 404: Job not found or doesn't belong to organization
        HTTPException 500: Internal server error
    """
    try:
        # Get job status with tenant isolation
        ai_parsing_section = await get_job_status(
            job_id=job_id,
            session=db,
            arq_pool=request.app.state.arq_pool,
        )

        # Map AIParsingSection to JobStatusResponse
        if ai_parsing_section.status == "complete":
            return JobStatusResponse(
                job_id=job_id,
                status="complete",
                progress_pct=100,
                message="Analyse voltooid",
                data=ai_parsing_section.parsed_plan,
            )
        elif ai_parsing_section.status == "in_progress":
            return JobStatusResponse(
                job_id=job_id,
                status="in_progress",
                progress_pct=50,
                message="Bestemmingsplan wordt geanalyseerd...",
            )
        elif ai_parsing_section.status == "queued":
            return JobStatusResponse(
                job_id=job_id,
                status="queued",
                progress_pct=10,
                message="Wacht op verwerking...",
            )
        elif ai_parsing_section.status == "failed":
            return JobStatusResponse(
                job_id=job_id,
                status="failed",
                progress_pct=0,
                error=ai_parsing_section.error_message,
            )
        else:
            # not_available or not_found
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found or does not belong to your organization",
            )

    except HTTPException:
        # Re-raise HTTPExceptions
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during job status check",
        ) from e


@router.post("/upload-pdf", response_model=JobStatusResponse)
@limiter.limit("10/minute")
async def upload_pdf(
    request: Request,
    plan_idn: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> JobStatusResponse:
    """
    Upload bestemmingsplan PDF for manual parsing (fallback when auto-download fails).

    Accepts user-uploaded bestemmingsplan PDF, validates format, stores in database,
    and enqueues AI parsing job. Used when automatic PDF download from
    Ruimtelijkeplannen.nl fails.

    Requires JWT authentication. Rate limited to 10 requests per minute
    (file uploads are expensive operations).

    Args:
        request: FastAPI request object
        plan_idn: IMRO plan identifier (e.g., NL.IMRO.0363.BP2024CENTRUM-VA01)
        file: PDF file upload
        current_user: Authenticated user
        organization_id: Tenant ID for PDF storage
        db: Database session

    Returns:
        JobStatusResponse: Queued job status with job_id for polling

    Raises:
        HTTPException 400: Invalid plan_idn, file not PDF, or file too large
        HTTPException 500: Internal server error
    """
    try:
        # Validate plan_idn format
        if not validate_imro_identifier(plan_idn):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ongeldige IMRO-identifier. Verwacht formaat: NL.IMRO.{gemeente}.{plan}-{versie}",
            )

        # Read file bytes
        pdf_bytes = await file.read()

        # Validate file type (content_type or filename extension)
        is_pdf_content_type = file.content_type == "application/pdf"
        is_pdf_extension = file.filename and file.filename.lower().endswith(".pdf")

        if not (is_pdf_content_type or is_pdf_extension):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bestand moet een PDF zijn (application/pdf)",
            )

        # Validate file size (100MB limit)
        if len(pdf_bytes) > 100 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PDF te groot (maximaal 100MB)",
            )

        # Store uploaded PDF
        await store_uploaded_pdf(
            plan_idn=plan_idn,
            pdf_data=pdf_bytes,
            session=db,
        )

        # Enqueue parsing job
        job = await enqueue_parsing_job(
            plan_idn=plan_idn,
            session=db,
            arq_pool=request.app.state.arq_pool,
        )

        return JobStatusResponse(
            job_id=job.job_id,
            status="queued",
            progress_pct=10,
            message="PDF ontvangen, analyse wordt gestart...",
        )

    except HTTPException:
        # Re-raise HTTPExceptions
        raise
    except PDFDownloadError as e:
        # PDF validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during PDF upload",
        ) from e
