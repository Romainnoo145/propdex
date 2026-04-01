"""Property lookup and task management service layer."""

import logging
import uuid
from dataclasses import asdict

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas import JobStatusResponse
from app.government_apis.base import APINotFoundError, GovernmentAPIError
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.models.parcel_task import ParcelTask
from app.models.scan_result import ScanResult
from app.schemas.address import AddressInput
from app.schemas.property import PropertyReportResponse
from app.services.actievoorstellen import compute_actievoorstellen
from app.services.document_generator import generate_document, list_templates
from app.services.pdf_downloader import (
    PDFDownloadError,
    store_uploaded_pdf,
    validate_imro_identifier,
)
from app.services.plan_aggregator import enqueue_parsing_job, get_job_status
from app.services.property_aggregator import aggregate_property_data
from app.services.use_case_scoring import compute_use_case_scores

logger = logging.getLogger(__name__)

# Module-level PDOK client instance
_pdok_client = PDOKLocatieserver()


async def lookup_property(
    input_data: AddressInput,
    client,
    db: AsyncSession,
    force_refresh: bool,
    arq_pool,
) -> PropertyReportResponse:
    """Aggregate property data from multiple government APIs.

    Raises:
        HTTPException: 404, 502, or 500 depending on failure type.
    """
    try:
        return await aggregate_property_data(
            input_data=input_data,
            client=client,
            session=db,
            force_refresh=force_refresh,
            arq_pool=arq_pool,
        )
    except HTTPException:
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during property lookup",
        ) from e


async def suggest_addresses(q: str, client) -> list[dict]:
    """Get address autocomplete suggestions from PDOK.

    Raises:
        HTTPException: 400, 502, or 500 depending on failure type.
    """
    if len(q) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query must be at least 2 characters",
        )
    try:
        return await _pdok_client.suggest(query=q, client=client)
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


async def get_job_status_response(
    job_id: str,
    db: AsyncSession,
    arq_pool,
) -> JobStatusResponse:
    """Map ARQ job status to JobStatusResponse.

    Raises:
        HTTPException: 404 or 500.
    """
    try:
        ai_parsing_section = await get_job_status(
            job_id=job_id,
            session=db,
            arq_pool=arq_pool,
        )

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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found or does not belong to your organization",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during job status check",
        ) from e


async def upload_and_parse_pdf(
    plan_idn: str,
    pdf_bytes: bytes,
    content_type: str | None,
    filename: str | None,
    db: AsyncSession,
    arq_pool,
) -> JobStatusResponse:
    """Validate, store, and enqueue a bestemmingsplan PDF for parsing.

    Raises:
        HTTPException: 400 or 500.
    """
    try:
        if not validate_imro_identifier(plan_idn):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ongeldige IMRO-identifier. Verwacht formaat: NL.IMRO.{gemeente}.{plan}-{versie}",
            )

        is_pdf_content_type = content_type == "application/pdf"
        is_pdf_extension = filename and filename.lower().endswith(".pdf")

        if not (is_pdf_content_type or is_pdf_extension):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bestand moet een PDF zijn (application/pdf)",
            )

        if len(pdf_bytes) > 100 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PDF te groot (maximaal 100MB)",
            )

        await store_uploaded_pdf(
            plan_idn=plan_idn,
            pdf_data=pdf_bytes,
            session=db,
        )

        job = await enqueue_parsing_job(
            plan_idn=plan_idn,
            session=db,
            arq_pool=arq_pool,
        )

        return JobStatusResponse(
            job_id=job.job_id,
            status="queued",
            progress_pct=10,
            message="PDF ontvangen, analyse wordt gestart...",
        )
    except HTTPException:
        raise
    except PDFDownloadError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during PDF upload",
        ) from e


async def get_actievoorstellen(parcel_id: str, db: AsyncSession) -> dict:
    """Compute actionable recommendations for a parcel."""
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
    breakdown = flags.get("score_breakdown", {})
    uc_scores = None
    if breakdown:
        uc_results = compute_use_case_scores(breakdown)
        if uc_results:
            uc_scores = {k: asdict(v) for k, v in uc_results.items()}

    acties = compute_actievoorstellen(flags, uc_scores)

    return {
        "parcel_id": parcel_id,
        "acties": [asdict(a) for a in acties],
        "total": len(acties),
    }


async def generate_document_for_parcel(
    parcel_id: str,
    template_id: str,
    db: AsyncSession,
) -> dict:
    """Generate a concept document for a parcel.

    Raises:
        HTTPException: 400, 404, or 500.
    """
    valid_ids = {t["id"] for t in list_templates()}
    if template_id not in valid_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown template: {template_id}. Available: {', '.join(valid_ids)}",
        )

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


def get_document_templates() -> dict:
    """List available document generation templates."""
    return {"templates": list_templates()}


# ── Task Management ──────────────────────────────────────────────


async def list_parcel_tasks(
    parcel_id: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    """List all tasks for a parcel (user-scoped)."""
    stmt = (
        select(ParcelTask)
        .where(
            ParcelTask.user_id == user_id,
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


async def create_parcel_task(
    parcel_id: str,
    user_id: uuid.UUID,
    body: dict,
    db: AsyncSession,
) -> dict:
    """Create a new task for a parcel."""
    task = ParcelTask(
        user_id=user_id,
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


async def update_parcel_task(
    parcel_id: str,
    task_id: str,
    user_id: uuid.UUID,
    body: dict,
    db: AsyncSession,
) -> dict:
    """Update a task (status, title, deadline, etc.).

    Raises:
        HTTPException: 404 if task not found.
    """
    stmt = select(ParcelTask).where(
        ParcelTask.id == task_id,
        ParcelTask.user_id == user_id,
        ParcelTask.parcel_id == parcel_id,
    )
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    for field in ("title", "description", "status", "priority", "category", "use_case", "deadline"):
        if field in body:
            setattr(task, field, body[field])

    await db.commit()

    return {"id": str(task.id), "status": task.status, "updated": True}


async def delete_parcel_task(
    task_id: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Delete a task.

    Raises:
        HTTPException: 404 if task not found.
    """
    stmt = select(ParcelTask).where(
        ParcelTask.id == task_id,
        ParcelTask.user_id == user_id,
    )
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()


async def create_tasks_from_actievoorstellen(
    parcel_id: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    """Auto-create tasks from actievoorstellen for a parcel.

    Computes actievoorstellen, creates tasks for each one that
    doesn't already exist (matched by source_actie_id).
    """
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
        ParcelTask.user_id == user_id,
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
            user_id=user_id,
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
