"""Property lookup API endpoints."""


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


@router.get("/{parcel_id}/actievoorstellen")
async def get_actievoorstellen(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get actionable next-step recommendations for a parcel.

    Computes prioritized actions based on parcel scores, risk factors,
    and use-case scores. Deterministic — no AI calls.

    Args:
        parcel_id: Parcel cache ID (UUID)
    """
    from dataclasses import asdict

    from sqlalchemy import desc, select

    from app.models.scan_result import ScanResult
    from app.services.actievoorstellen import compute_actievoorstellen
    from app.services.use_case_scoring import compute_use_case_scores

    # Find the most recent scan result for this parcel
    stmt = (
        select(ScanResult)
        .where(ScanResult.parcel_id == parcel_id)
        .order_by(desc(ScanResult.created_at))
        .limit(1)
    )
    result = await db.execute(stmt)
    sr = result.scalar_one_or_none()

    if sr is None or not sr.flags:
        return {"parcel_id": parcel_id, "acties": [], "total": 0}

    flags = sr.flags or {}

    # Compute use-case scores from breakdown
    breakdown = flags.get("score_breakdown", {})
    uc_scores = None
    if breakdown:
        uc_results = compute_use_case_scores(breakdown)
        if uc_results:
            uc_scores = {k: asdict(v) for k, v in uc_results.items()}

    # Compute actievoorstellen
    acties = compute_actievoorstellen(flags, uc_scores)

    return {
        "parcel_id": parcel_id,
        "acties": [asdict(a) for a in acties],
        "total": len(acties),
    }


@router.post("/{parcel_id}/generate/{template_id}")
async def generate_document_endpoint(
    parcel_id: str,
    template_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a concept document for a parcel.

    Available templates: eigenaar_brief, vooroverleg_request.
    Returns rendered Markdown. Use the parcel's data to fill in
    location, bestemming, scores, and development strategy.

    Args:
        parcel_id: Parcel cache ID (UUID)
        template_id: Template key (eigenaar_brief, vooroverleg_request)
    """
    from sqlalchemy import desc, select

    from app.models.scan_result import ScanResult
    from app.services.document_generator import generate_document, list_templates

    # Validate template
    valid_ids = {t["id"] for t in list_templates()}
    if template_id not in valid_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown template: {template_id}. Available: {', '.join(valid_ids)}",
        )

    # Get parcel data
    stmt = (
        select(ScanResult)
        .where(ScanResult.parcel_id == parcel_id)
        .order_by(desc(ScanResult.created_at))
        .limit(1)
    )
    result = await db.execute(stmt)
    sr = result.scalar_one_or_none()

    if sr is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No scan data found for parcel {parcel_id}",
        )

    flags = sr.flags or {}

    # Generate document
    rendered = generate_document(template_id, flags)
    if rendered is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document generation failed",
        )

    return {
        "parcel_id": parcel_id,
        "template_id": template_id,
        "content": rendered,
        "format": "markdown",
    }


@router.get("/templates")
async def list_document_templates(
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """List available document generation templates."""
    from app.services.document_generator import list_templates
    return {"templates": list_templates()}


# ── Task Management ──────────────────────────────────────────────


@router.get("/{parcel_id}/tasks")
async def list_parcel_tasks(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all tasks for a parcel (user-scoped)."""
    from sqlalchemy import select

    from app.models.parcel_task import ParcelTask

    stmt = (
        select(ParcelTask)
        .where(
            ParcelTask.user_id == current_user.id,
            ParcelTask.parcel_id == parcel_id,
        )
        .order_by(ParcelTask.created_at)
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    return {
        "parcel_id": parcel_id,
        "tasks": [
            {
                "id": str(t.id),
                "title": t.title,
                "description": t.description,
                "status": t.status,
                "priority": t.priority,
                "category": t.category,
                "use_case": t.use_case,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "source_actie_id": t.source_actie_id,
                "created_at": t.created_at.isoformat(),
            }
            for t in tasks
        ],
        "total": len(tasks),
    }


@router.post("/{parcel_id}/tasks", status_code=201)
async def create_parcel_task(
    parcel_id: str,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a new task for a parcel."""
    from app.models.parcel_task import ParcelTask

    body = await request.json()

    task = ParcelTask(
        user_id=current_user.id,
        parcel_id=parcel_id,
        title=body.get("title", ""),
        description=body.get("description"),
        status=body.get("status", "todo"),
        priority=body.get("priority", "gemiddeld"),
        category=body.get("category"),
        use_case=body.get("use_case"),
        deadline=body.get("deadline"),
        source_actie_id=body.get("source_actie_id"),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    return {
        "id": str(task.id),
        "title": task.title,
        "status": task.status,
        "created": True,
    }


@router.patch("/{parcel_id}/tasks/{task_id}")
async def update_parcel_task(
    parcel_id: str,
    task_id: str,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update a task (status, title, deadline, etc.)."""
    from sqlalchemy import select

    from app.models.parcel_task import ParcelTask

    stmt = select(ParcelTask).where(
        ParcelTask.id == task_id,
        ParcelTask.user_id == current_user.id,
        ParcelTask.parcel_id == parcel_id,
    )
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    body = await request.json()
    for field in ("title", "description", "status", "priority", "category", "use_case", "deadline"):
        if field in body:
            setattr(task, field, body[field])

    await db.commit()

    return {"id": str(task.id), "status": task.status, "updated": True}


@router.delete("/{parcel_id}/tasks/{task_id}", status_code=204)
async def delete_parcel_task(
    parcel_id: str,
    task_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a task."""
    from sqlalchemy import select

    from app.models.parcel_task import ParcelTask

    stmt = select(ParcelTask).where(
        ParcelTask.id == task_id,
        ParcelTask.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()


@router.post("/{parcel_id}/tasks/from-acties")
async def create_tasks_from_actievoorstellen(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Auto-create tasks from actievoorstellen for a parcel.

    Computes actievoorstellen, creates tasks for each one that
    doesn't already exist (matched by source_actie_id).
    """
    from dataclasses import asdict

    from sqlalchemy import desc, select

    from app.models.parcel_task import ParcelTask
    from app.models.scan_result import ScanResult
    from app.services.actievoorstellen import compute_actievoorstellen
    from app.services.use_case_scoring import compute_use_case_scores

    # Get parcel data
    stmt = (
        select(ScanResult)
        .where(ScanResult.parcel_id == parcel_id)
        .order_by(desc(ScanResult.created_at))
        .limit(1)
    )
    result = await db.execute(stmt)
    sr = result.scalar_one_or_none()

    if sr is None or not sr.flags:
        return {"parcel_id": parcel_id, "created": 0, "skipped": 0}

    flags = sr.flags or {}
    breakdown = flags.get("score_breakdown", {})
    uc_scores = None
    if breakdown:
        uc_results = compute_use_case_scores(breakdown)
        if uc_results:
            uc_scores = {k: asdict(v) for k, v in uc_results.items()}

    acties = compute_actievoorstellen(flags, uc_scores)

    # Check existing tasks to avoid duplicates
    existing_stmt = select(ParcelTask.source_actie_id).where(
        ParcelTask.user_id == current_user.id,
        ParcelTask.parcel_id == parcel_id,
        ParcelTask.source_actie_id.isnot(None),
    )
    existing_result = await db.execute(existing_stmt)
    existing_ids = {row[0] for row in existing_result.all()}

    created = 0
    skipped = 0
    for actie in acties:
        if actie.id in existing_ids:
            skipped += 1
            continue
        task = ParcelTask(
            user_id=current_user.id,
            parcel_id=parcel_id,
            title=actie.title,
            description=actie.description,
            priority=actie.priority,
            category=actie.category,
            use_case=actie.use_case,
            source_actie_id=actie.id,
        )
        db.add(task)
        created += 1

    if created > 0:
        await db.commit()

    return {"parcel_id": parcel_id, "created": created, "skipped": skipped}
