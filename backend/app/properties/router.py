"""Property lookup API endpoints."""

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas import JobStatusResponse
from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.properties.properties_service import (
    create_parcel_task,
    create_tasks_from_actievoorstellen,
    delete_parcel_task,
    generate_document_for_parcel,
    get_actievoorstellen,
    get_document_templates,
    get_job_status_response,
    list_parcel_tasks,
    lookup_property,
    suggest_addresses,
    update_parcel_task,
    upload_and_parse_pdf,
)
from app.properties.schemas import (
    ActievoorstellenResponse,
    AddressSuggestion,
    BulkTaskCreateResponse,
    DocumentGenerationResponse,
    TaskCreateResponse,
    TaskListResponse,
    TaskUpdateResponse,
    TemplateListResponse,
)
from app.schemas.address import AddressInput
from app.schemas.property import PropertyReportResponse

router = APIRouter(prefix="/api/properties", tags=["Properties"])


@router.post("/lookup", response_model=PropertyReportResponse)
@limiter.limit("30/minute")
async def lookup_property_endpoint(
    request: Request,
    input_data: AddressInput,
    force_refresh: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PropertyReportResponse:
    """Look up property data by Dutch address."""
    return await lookup_property(
        input_data=input_data,
        client=request.app.state.http_client,
        db=db,
        force_refresh=force_refresh,
        arq_pool=request.app.state.arq_pool,
    )


@router.get("/suggest", response_model=list[AddressSuggestion])
@limiter.limit("60/minute")
async def suggest_addresses_endpoint(
    request: Request,
    q: str,
    current_user: User = Depends(get_current_active_user),
) -> list[dict]:
    """Get address autocomplete suggestions."""
    return await suggest_addresses(q=q, client=request.app.state.http_client)


@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
@limiter.limit("60/minute")
async def job_status_endpoint(
    request: Request,
    job_id: str,
    current_user: User = Depends(get_current_active_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> JobStatusResponse:
    """Get AI parsing job status for polling."""
    return await get_job_status_response(
        job_id=job_id,
        db=db,
        arq_pool=request.app.state.arq_pool,
    )


@router.post("/upload-pdf", response_model=JobStatusResponse)
@limiter.limit("10/minute")
async def upload_pdf_endpoint(
    request: Request,
    plan_idn: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),  # noqa: B008
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> JobStatusResponse:
    """Upload bestemmingsplan PDF for manual parsing."""
    pdf_bytes = await file.read()
    return await upload_and_parse_pdf(
        plan_idn=plan_idn,
        pdf_bytes=pdf_bytes,
        content_type=file.content_type,
        filename=file.filename,
        db=db,
        arq_pool=request.app.state.arq_pool,
    )


@router.get("/{parcel_id}/actievoorstellen", response_model=ActievoorstellenResponse)
async def get_actievoorstellen_endpoint(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get actionable next-step recommendations for a parcel."""
    return await get_actievoorstellen(parcel_id=parcel_id, db=db)


@router.post("/{parcel_id}/generate/{template_id}", response_model=DocumentGenerationResponse)
async def generate_document_endpoint(
    parcel_id: str,
    template_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a concept document for a parcel."""
    return await generate_document_for_parcel(
        parcel_id=parcel_id,
        template_id=template_id,
        db=db,
    )


@router.get("/templates", response_model=TemplateListResponse)
async def list_document_templates_endpoint(
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """List available document generation templates."""
    return get_document_templates()


# ── Task Management ──────────────────────────────────────────────


@router.get("/{parcel_id}/tasks", response_model=TaskListResponse)
async def list_parcel_tasks_endpoint(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all tasks for a parcel (user-scoped)."""
    return await list_parcel_tasks(
        parcel_id=parcel_id,
        user_id=current_user.id,
        db=db,
    )


@router.post("/{parcel_id}/tasks", status_code=201, response_model=TaskCreateResponse)
async def create_parcel_task_endpoint(
    parcel_id: str,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a new task for a parcel."""
    body = await request.json()
    return await create_parcel_task(
        parcel_id=parcel_id,
        user_id=current_user.id,
        body=body,
        db=db,
    )


@router.patch("/{parcel_id}/tasks/{task_id}", response_model=TaskUpdateResponse)
async def update_parcel_task_endpoint(
    parcel_id: str,
    task_id: str,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update a task (status, title, deadline, etc.)."""
    body = await request.json()
    return await update_parcel_task(
        parcel_id=parcel_id,
        task_id=task_id,
        user_id=current_user.id,
        body=body,
        db=db,
    )


@router.delete("/{parcel_id}/tasks/{task_id}", status_code=204)
async def delete_parcel_task_endpoint(
    parcel_id: str,
    task_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a task."""
    await delete_parcel_task(
        task_id=task_id,
        user_id=current_user.id,
        db=db,
    )


@router.post("/{parcel_id}/tasks/from-acties", response_model=BulkTaskCreateResponse)
async def create_tasks_from_actievoorstellen_endpoint(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Auto-create tasks from actievoorstellen for a parcel."""
    return await create_tasks_from_actievoorstellen(
        parcel_id=parcel_id,
        user_id=current_user.id,
        db=db,
    )
