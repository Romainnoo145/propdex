"""Scan management API endpoints."""

import logging
import uuid

from arq.jobs import Job
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.scan_result import ScanResult
from app.models.user import User
from app.schemas.common import MessageResponse
from app.scans import service
from app.scans.schemas import (
    ScanCreateRequest,
    ScanListResponse,
    ScanResponse,
    ScanStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scans", tags=["Scans"])


@router.get("", response_model=ScanListResponse)
@limiter.limit("60/minute")
async def list_scans(
    request: Request,
    offset: int = 0,
    limit: int = 50,
    status_filter: str | None = Query(
        default=None,
        alias="status",
        description="Filter by scan status (pending, running, completed, failed, cancelled)",
    ),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ScanListResponse:
    """List paginated scan history with metadata."""
    limit = min(limit, 100)
    scans, total = await service.list_scans(
        offset=offset, limit=limit, session=db, status_filter=status_filter,
    )
    return ScanListResponse(
        scans=service.build_scan_list_items(scans),
        total=total, offset=offset, limit=limit,
    )


@router.post("", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def trigger_scan(
    request: Request,
    scan_request: ScanCreateRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScanResponse:
    """Trigger a new area scan for a gemeente."""
    try:
        return await service.process_trigger_scan(
            gemeente_code=scan_request.gemeente_code,
            gemeente_naam=scan_request.gemeente_naam,
            wijk_naam=scan_request.wijk_naam,
            bbox_wgs84=scan_request.bbox_wgs84,
            force_rescan=scan_request.force_rescan,
            target_project_id=scan_request.project_id,
            organization_id=organization_id,
            http_client=request.app.state.http_client,
            arq_pool=request.app.state.arq_pool,
            session=db,
        )
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except ValueError as e:
        msg = str(e)
        if "CBS WFS service unavailable" in msg:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=msg) from e
        if "No wijken found" in msg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg) from e
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to trigger scan")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger scan: {e}",
        ) from e


# --- Static path routes MUST come before /{scan_id} to avoid UUID parsing ---
from app.scans.parcels_router import router as parcels_router  # noqa: E402
from app.scans.results_router import router as results_router  # noqa: E402

router.include_router(parcels_router)


# --- Dynamic path routes (/{scan_id}) ---


@router.get("/{scan_id}", response_model=ScanStatusResponse)
@limiter.limit("60/minute")
async def get_scan_status(
    request: Request,
    scan_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ScanStatusResponse:
    """Poll scan status and progress."""
    scan = await service.get_scan_by_id(scan_id, db)
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    count_query = select(func.count()).select_from(ScanResult).where(ScanResult.scan_id == scan_id)
    results_count = (await db.execute(count_query)).scalar() or 0

    return ScanStatusResponse(
        scan_id=scan.id, status=scan.status, progress_pct=scan.progress_pct,
        current_phase=scan.current_phase, parcels_total=scan.parcels_total,
        parcels_processed=scan.parcels_processed, parcels_failed=scan.parcels_failed,
        results_count=results_count, started_at=scan.started_at,
        completed_at=scan.completed_at,
    )


@router.post("/{scan_id}/cancel", response_model=MessageResponse)
@limiter.limit("10/minute")
async def cancel_scan(
    request: Request,
    scan_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running scan."""
    scan = await service.get_scan_by_id(scan_id, db)
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    if scan.status != "running":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scan is not running (current status: {scan.status})",
        )

    arq_pool = request.app.state.arq_pool
    job = Job(scan.job_id, arq_pool)
    await job.abort()
    return {"message": "Scan cancellation requested", "id": str(scan_id)}


# Results router has /{scan_id}/* paths — safe to include after /{scan_id}
router.include_router(results_router)
