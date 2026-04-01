"""Scan results, tiles, and export endpoints.

Thin HTTP handlers — all business logic lives in results_service.py.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.scans import results_service
from app.scans.schemas import (
    FundaSummaryResponse,
    ScanResultsResponse,
)

router = APIRouter()


@router.get("/{scan_id}/funda-summary", response_model=FundaSummaryResponse)
@limiter.limit("60/minute")
async def get_funda_summary(
    request: Request,
    scan_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FundaSummaryResponse:
    """Aggregate funda market signals across all parcels in a scan."""
    return await results_service.get_funda_summary(db=db, scan_id=scan_id)


@router.get("/{scan_id}/results", response_model=ScanResultsResponse)
@limiter.limit("60/minute")
async def list_results(
    request: Request,
    scan_id: uuid.UUID,
    has_pand: bool | None = None,
    search: str | None = None,
    bestemming_type: str | None = None,
    min_area_m2: float | None = None,
    max_area_m2: float | None = None,
    score_category: str | None = None,
    pand_status: str | None = None,
    min_score: float | None = Query(None, description="Minimum score threshold"),
    exclude_null_scores: bool = Query(False, description="Exclude parcels with null scores"),
    sort_by: str = "score",
    sort_order: str = "desc",
    offset: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ScanResultsResponse:
    """List paginated scan results with filtering and sorting."""
    return await results_service.list_results(
        db=db,
        scan_id=scan_id,
        current_user_id=current_user.id,
        has_pand=has_pand,
        search=search,
        bestemming_type=bestemming_type,
        min_area_m2=min_area_m2,
        max_area_m2=max_area_m2,
        score_category=score_category,
        pand_status=pand_status,
        min_score=min_score,
        exclude_null_scores=exclude_null_scores,
        sort_by=sort_by,
        sort_order=sort_order,
        offset=offset,
        limit=limit,
    )


@router.get("/{scan_id}/tiles/{z}/{x}/{y}.pbf")
@limiter.limit("120/minute")
async def get_scan_tiles(
    request: Request,
    scan_id: uuid.UUID,
    z: int,
    x: int,
    y: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve MVT vector tiles for scan results with score overlay."""
    tile_data, cache_control = await results_service.get_scan_tiles(
        db=db, scan_id=scan_id, z=z, x=x, y=y,
    )
    if tile_data is None:
        return Response(status_code=204)
    return Response(
        content=tile_data,
        media_type="application/vnd.mapbox-vector-tile",
        headers={"Cache-Control": cache_control},
    )


@router.get("/{scan_id}/export/selection")
@limiter.limit("10/minute")
async def export_selection(
    request: Request,
    scan_id: uuid.UUID,
    parcel_ids: str = Query(..., description="Comma-separated parcel UUIDs"),
    sort_by: str = "score",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a user-selected subset of parcels to Excel."""
    try:
        parsed_ids = [
            uuid.UUID(pid.strip()) for pid in parcel_ids.split(",") if pid.strip()
        ]
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid parcel UUID format",
        ) from e

    if len(parsed_ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No parcel IDs provided",
        )
    if len(parsed_ids) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 500 parcels per export",
        )

    excel_buffer, filename = await results_service.export_selection(
        db=db, scan_id=scan_id, parcel_ids=parsed_ids,
        sort_by=sort_by, sort_order=sort_order,
    )
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{scan_id}/export")
@limiter.limit("10/minute")
async def export_results(
    request: Request,
    scan_id: uuid.UUID,
    has_pand: bool | None = None,
    search: str | None = None,
    bestemming_type: str | None = None,
    min_area_m2: float | None = None,
    max_area_m2: float | None = None,
    score_category: str | None = None,
    pand_status: str | None = None,
    sort_by: str = "score",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Export filtered scan results to Excel."""
    excel_buffer, filename = await results_service.export_results(
        db=db,
        scan_id=scan_id,
        has_pand=has_pand,
        search=search,
        bestemming_type=bestemming_type,
        min_area_m2=min_area_m2,
        max_area_m2=max_area_m2,
        score_category=score_category,
        pand_status=pand_status,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
