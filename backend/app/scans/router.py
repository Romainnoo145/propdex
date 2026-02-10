"""Scan management API endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.government_apis.bag_wfs import bag_wfs_client
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.scans import service
from app.scans.schemas import ScanCreateRequest, ScanResponse
from app.services.gemeente_service import get_gemeente_bbox

router = APIRouter(prefix="/api/scans", tags=["scans"])


@router.post("", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def trigger_scan(
    request: Request,
    scan_request: ScanCreateRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScanResponse:
    """
    Trigger a new area scan for a gemeente.

    Creates an AreaScan record and enqueues an ARQ background job to process
    all parcels within the gemeente bounding box. Implements existing scan
    detection with re-scan option and 10,000 parcel limit validation.

    Requires JWT authentication. Rate limited to 10 requests per minute.

    Args:
        request: FastAPI request object
        scan_request: Scan trigger request with gemeente info
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ScanResponse: Scan status with scan_id

    Raises:
        HTTPException 400: Invalid gemeente or parcel count exceeds limit
        HTTPException 500: Internal server error
    """
    try:
        # Check for existing scan
        existing_scan = await service.get_existing_scan(
            organization_id=organization_id,
            gemeente_code=scan_request.gemeente_code,
            session=db,
        )

        # If existing scan found and not forcing rescan, return existing
        if existing_scan and not scan_request.force_rescan:
            from datetime import datetime

            days_old = (datetime.utcnow() - existing_scan.created_at).days
            needs_rescan = days_old > 30

            return ScanResponse(
                scan_id=existing_scan.id,
                status="existing",
                gemeente_naam=existing_scan.gemeente_naam,
                gemeente_code=existing_scan.gemeente_code,
                scan_date=existing_scan.created_at,
                needs_rescan=needs_rescan,
                message=f"Scan from {existing_scan.created_at.strftime('%Y-%m-%d')} already exists. Use force_rescan=true to re-scan.",
            )

        # If existing scan and force_rescan, reset the scan
        if existing_scan and scan_request.force_rescan:
            scan = await service.reset_scan_for_rescan(existing_scan, db)
        else:
            # Fetch gemeente bounding box
            http_client = request.app.state.http_client
            try:
                bbox = await get_gemeente_bbox(scan_request.gemeente_code, http_client)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid gemeente: {e}",
                ) from e

            # Pre-check parcel count (10k limit per SCAN-06)
            parcel_count = await bag_wfs_client.get_pand_count_in_bbox(bbox, http_client)

            if parcel_count > 10000:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Scan would exceed 10,000 parcel limit. Found {parcel_count} parcels in {scan_request.gemeente_naam}.",
                )

            # Create new scan record
            scan = await service.create_scan(
                organization_id=organization_id,
                gemeente_code=scan_request.gemeente_code,
                gemeente_naam=scan_request.gemeente_naam,
                bbox=bbox,
                session=db,
            )

        # Enqueue ARQ job
        arq_pool = request.app.state.arq_pool
        job = await arq_pool.enqueue_job(
            "area_scan_job",
            str(scan.id),
            str(organization_id),
        )

        # Store job_id in scan record
        scan.job_id = job.job_id
        db.add(scan)
        await db.flush()
        await db.commit()

        return ScanResponse(
            scan_id=scan.id,
            status="pending",
            gemeente_naam=scan.gemeente_naam,
            gemeente_code=scan.gemeente_code,
            scan_date=scan.created_at,
            needs_rescan=False,
            message="Scan started successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to trigger scan",
        ) from e
