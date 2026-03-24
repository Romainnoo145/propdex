"""Scan results, tiles, and export endpoints."""

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.parcel_cache import ParcelCache
from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.models.user import User
from app.scans import service
from app.scans.helpers import (
    _build_permit_activity_map,
    _extract_listing_signal_from_enrichment,
    _normalize_market_signals,
)
from app.scans.schemas import (
    ScanResultItem,
    ScanResultsResponse,
)
from app.services.excel_exporter import export_scan_results_to_excel
from app.services.funda_listing_ingestion import build_funda_listing_signal_map
from app.services.parcel_scoring import compute_vacancy_confidence

logger = logging.getLogger(__name__)

router = APIRouter()


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
    """
    List paginated scan results with filtering and sorting.

    Returns paginated scan results with server-side filtering by parcel
    characteristics and sorting. Default sort is by score DESC (most promising
    first). Includes score breakdown for transparency.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        scan_id: Scan UUID
        has_pand: Filter by building presence
        search: Free-text search across address, parcel code, status, and bestemming
        bestemming_type: Filter by zoning type substring
        min_area_m2: Minimum parcel area
        max_area_m2: Maximum parcel area
        score_category: Filter by score category (High/Medium/Low)
        pand_status: Filter by building status
        sort_by: Sort field (score/vacancy_subscore/buildability_subscore/area_m2/address/bouwjaar)
        sort_order: Sort direction (asc/desc)
        offset: Pagination offset
        limit: Page size (max 100)
        current_user: Authenticated user
        db: Database session

    Returns:
        ScanResultsResponse: Paginated results with metadata

    Raises:
        HTTPException 404: Scan not found
    """
    # Validate and cap limit
    limit = min(limit, 100)

    # Get scan by ID with multi-tenant isolation
    scan = await service.get_scan_by_id(scan_id, db)

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    # Query results with filters and pagination
    rows, total, total_unfiltered = await service.list_scan_results(
        scan_id=scan_id,

        has_pand=has_pand,
        search=search,
        bestemming_type=bestemming_type,
        min_area_m2=min_area_m2,
        max_area_m2=max_area_m2,
        score_category=score_category,
        sort_by=sort_by,
        sort_order=sort_order,
        offset=offset,
        limit=limit,
        session=db,
        pand_status=pand_status,
        min_score=min_score,
        exclude_null_scores=exclude_null_scores,
    )

    parcel_ids = [parcel.id for _, parcel in rows]
    parcels_with_report: set[uuid.UUID] = set()
    if parcel_ids:
        report_rows = await db.execute(
            select(SavedReport.source_parcel_id).where(
                SavedReport.user_id == current_user.id,
                SavedReport.deleted_at.is_(None),
                SavedReport.source_parcel_id.in_(parcel_ids),
            )
        )
        parcels_with_report = {
            value
            for value in report_rows.scalars().all()
            if value is not None
        }
    permit_activity_by_parcel = await _build_permit_activity_map(
        parcel_ids,
        db,
    )
    listing_signal_by_parcel = await build_funda_listing_signal_map(
        parcel_ids,
        db,
    )

    # Map to ScanResultItem
    result_items = []
    for result, parcel in rows:
        # Extract score_category from flags
        score_category_value = None
        score_breakdown = None
        vacancy_signal = None
        opportunity_signals = None
        building_metrics = None
        market_signals = None
        if result.flags:
            score_category_value = result.flags.get("category")
            raw_vacancy = result.flags.get("vacancy_signal")
            raw_signals = result.flags.get("opportunity_signals")
            raw_metrics = result.flags.get("building_metrics")
            raw_market_signals = result.flags.get("market_signals")

            vacancy_signal = raw_vacancy if isinstance(raw_vacancy, str) else None
            opportunity_signals = (
                [str(s) for s in raw_signals]
                if isinstance(raw_signals, list)
                else None
            )
            building_metrics = raw_metrics if isinstance(raw_metrics, dict) else None
            market_signals = _normalize_market_signals(raw_market_signals)

            # v3.0 score extraction: check for score_breakdown with categorie objects
            v3_breakdown = result.flags.get("score_breakdown")
            if isinstance(v3_breakdown, dict):
                first_val = next(iter(v3_breakdown.values()), None)
                if isinstance(first_val, dict) and "categorie" in first_val:
                    score_breakdown = v3_breakdown
                else:
                    score_breakdown = v3_breakdown if v3_breakdown else None
            else:
                # v2.1 fallback
                factors = result.flags.get("factors")
                if isinstance(factors, dict):
                    score_breakdown = {"factors": factors}
                    raw_subscores = result.flags.get("subscores")
                    if isinstance(raw_subscores, dict):
                        score_breakdown["subscores"] = raw_subscores
                    model_version = result.flags.get("score_model_version")
                    if isinstance(model_version, str) and model_version:
                        score_breakdown["model_version"] = model_version
                else:
                    legacy_breakdown = {
                        k: v for k, v in result.flags.items() if k != "category"
                    }
                    score_breakdown = legacy_breakdown if legacy_breakdown else None

        listing_signal = (
            listing_signal_by_parcel.get(parcel.id)
            or _extract_listing_signal_from_enrichment(parcel.enrichment_data)
        )
        if listing_signal:
            market_signals = _normalize_market_signals(listing_signal)
        vacancy_confidence = compute_vacancy_confidence(
            parcel,
            permit_activity=permit_activity_by_parcel.get(parcel.id),
            listing_signal=listing_signal,
        )

        result_items.append(
            ScanResultItem(
                parcel_id=parcel.id,
                parcel_code=parcel.parcel_id,
                address=parcel.address if parcel.has_pand else None,
                gemeente_code=parcel.gemeente_code,
                area_m2=parcel.area_m2,
                has_pand=parcel.has_pand,
                bouwjaar=parcel.bouwjaar,
                pand_status=parcel.pand_status,
                bestemmingen=parcel.bestemmingen,
                score=result.score,
                score_category=score_category_value,
                score_breakdown=score_breakdown,
                vacancy_signal=vacancy_signal,
                vacancy_confidence=vacancy_confidence.confidence,
                vacancy_reasons=vacancy_confidence.reasons,
                vacancy_model_version=vacancy_confidence.model_version,
                market_signals=market_signals,
                opportunity_signals=opportunity_signals,
                building_metrics=building_metrics,
                has_report=parcel.id in parcels_with_report,
            )
        )

    return ScanResultsResponse(
        scan_id=scan.id,
        gemeente_naam=scan.gemeente_naam,
        wijk_naam=scan.wijk_naam,
        neighborhood_metrics=scan.neighborhood_metrics,
        scan_date=scan.created_at,
        parcels_total=scan.parcels_total,
        total=total,
        total_unfiltered=total_unfiltered,
        offset=offset,
        limit=limit,
        results=result_items,
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
    """
    Serve MVT vector tiles for scan results with score overlay.

    Generates Mapbox Vector Tiles (MVT) directly from PostGIS using
    ST_AsMVT. Tiles contain parcel geometry, score, and metadata.

    Rate limited to 120/minute (map loads trigger many tile requests).

    Returns:
        Response with MVT binary and proper content-type
    """
    scan = await service.get_scan_by_id(scan_id, db)
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    from app.services.tile_proxy import generate_mvt_tile

    tile_data = await generate_mvt_tile(
        z=z,
        x=x,
        y=y,
        scan_id=scan_id,
        db=db,
    )

    if tile_data is None:
        return Response(status_code=204)

    return Response(
        content=tile_data,
        media_type="application/vnd.mapbox-vector-tile",
        headers={
            "Cache-Control": (
                "public, max-age=3600, stale-while-revalidate=86400"
                if scan.status == "completed"
                else "public, max-age=60"
            ),
        },
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
    """
    Export a user-selected subset of parcels to Excel .xlsx file.

    Accepts a comma-separated list of parcel UUIDs and returns an Excel file
    containing only those parcels. Maximum 500 parcels per export.

    Requires JWT authentication. Rate limited to 10 requests per minute.

    Args:
        request: FastAPI request object
        scan_id: Scan UUID
        parcel_ids: Comma-separated parcel UUIDs to include in export
        sort_by: Sort field (score/vacancy_subscore/buildability_subscore/area_m2/address/bouwjaar)
        sort_order: Sort direction (asc/desc)
        current_user: Authenticated user
        db: Database session

    Returns:
        StreamingResponse: Excel file download with Content-Disposition header

    Raises:
        HTTPException 400: Invalid UUID format, no IDs provided, or >500 IDs
        HTTPException 404: Scan not found
    """
    # Parse and validate parcel_ids
    try:
        parsed_ids = [
            uuid.UUID(pid.strip())
            for pid in parcel_ids.split(",")
            if pid.strip()
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

    # Get scan by ID with multi-tenant isolation
    scan = await service.get_scan_by_id(scan_id, db)

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    # Fetch selected results (no pagination -- export all selected)
    rows = await service.list_scan_results_by_ids(
        scan_id=scan_id,

        parcel_ids=parsed_ids,
        sort_by=sort_by,
        sort_order=sort_order,
        session=db,
    )

    # Build filters_applied dict for metadata
    filters_applied = {"selection": f"{len(parsed_ids)} percelen geselecteerd"}

    # Generate Excel file
    excel_buffer = await export_scan_results_to_excel(rows, scan, filters_applied)

    # Generate filename with gemeente name and date
    filename = f"propdex-selectie-{scan.gemeente_naam}-{scan.created_at.strftime('%Y%m%d')}.xlsx"

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
    """
    Export filtered scan results to Excel .xlsx file.

    Generates a downloadable Excel file containing all results matching the active
    filters (no pagination limit). Includes scan metadata, Dutch column names,
    styled headers, and score transparency columns.

    User decision: .xlsx format (not CSV) as NL/BE real estate developers work in Excel.
    Export respects active filters -- exports what the user sees, not all results.

    Requires JWT authentication. Rate limited to 10 requests per minute.

    Args:
        request: FastAPI request object
        scan_id: Scan UUID
        has_pand: Filter by building presence
        search: Free-text search across address, parcel code, status, and bestemming
        bestemming_type: Filter by zoning type substring
        min_area_m2: Minimum parcel area
        max_area_m2: Maximum parcel area
        score_category: Filter by score category (High/Medium/Low)
        sort_by: Sort field (score/vacancy_subscore/buildability_subscore/area_m2/address)
        sort_order: Sort direction (asc/desc)
        current_user: Authenticated user
        db: Database session

    Returns:
        StreamingResponse: Excel file download with Content-Disposition header

    Raises:
        HTTPException 404: Scan not found
    """
    # Get scan by ID with multi-tenant isolation
    scan = await service.get_scan_by_id(scan_id, db)

    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    # Fetch ALL filtered results (no pagination -- export everything)
    rows, _total, _unfiltered = await service.list_scan_results(
        scan_id=scan_id,

        has_pand=has_pand,
        search=search,
        bestemming_type=bestemming_type,
        min_area_m2=min_area_m2,
        max_area_m2=max_area_m2,
        score_category=score_category,
        sort_by=sort_by,
        sort_order=sort_order,
        offset=0,
        limit=10000,  # Effectively all (scan limit is 10k parcels)
        session=db,
        pand_status=pand_status,
    )

    # Build filters_applied dict for metadata
    filters_applied = {}
    if has_pand is not None:
        filters_applied["has_pand"] = has_pand
    if search is not None and search.strip():
        filters_applied["search"] = search.strip()
    if bestemming_type is not None:
        filters_applied["bestemming_type"] = bestemming_type
    if min_area_m2 is not None:
        filters_applied["min_area_m2"] = min_area_m2
    if max_area_m2 is not None:
        filters_applied["max_area_m2"] = max_area_m2
    if score_category is not None:
        filters_applied["score_category"] = score_category

    # Generate Excel file
    excel_buffer = await export_scan_results_to_excel(rows, scan, filters_applied)

    # Generate filename with gemeente name and date
    filename = f"propdex-scan-{scan.gemeente_naam}-{scan.created_at.strftime('%Y%m%d')}.xlsx"

    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
