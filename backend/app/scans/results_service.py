"""Scan results business-logic service layer.

Extracted from results_router.py — each public function corresponds to one
API endpoint.  Router handlers parse HTTP params, call the service, and
return/wrap the result.

All functions follow the project convention:
  async def do_thing(db: AsyncSession, …) -> SomeModel | dict | bytes
  Raises HTTPException on expected client/server errors.
"""

import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.scans import service
from app.scans.helpers import (
    _build_permit_activity_map,
    _extract_listing_signal_from_enrichment,
    _normalize_market_signals,
)
from app.scans.schemas import (
    FundaSummaryResponse,
    ScanResultItem,
    ScanResultsResponse,
)
from app.services.excel_exporter import export_scan_results_to_excel
from app.services.funda_listing_ingestion import build_funda_listing_signal_map
from app.services.parcel_scoring import compute_vacancy_confidence

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Service functions (one per endpoint)
# ---------------------------------------------------------------------------


async def get_funda_summary(
    db: AsyncSession,
    scan_id: uuid.UUID,
) -> FundaSummaryResponse:
    """Aggregate funda market signals across all parcels in a scan."""
    scan = await service.get_scan_by_id(scan_id, db)
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    result = await db.execute(
        select(ScanResult.flags).where(
            ScanResult.scan_id == scan_id,
            ScanResult.flags.isnot(None),
        )
    )
    rows = result.scalars().all()

    listing_durations: list[int] = []
    total_price_changes = 0
    total_snapshots = 0
    days_since_last_seen_list: list[int] = []

    for flags in rows:
        ms = flags.get("market_signals") if isinstance(flags, dict) else None
        if not isinstance(ms, dict):
            continue

        duration = ms.get("listing_duration_days")
        if isinstance(duration, (int, float)) and duration > 0:
            listing_durations.append(int(duration))

        price_changes = ms.get("price_change_count")
        if isinstance(price_changes, int):
            total_price_changes += price_changes

        snapshots = ms.get("listing_snapshots_count")
        if isinstance(snapshots, int):
            total_snapshots += snapshots

        days_last = ms.get("days_since_last_seen")
        if isinstance(days_last, (int, float)) and days_last >= 0:
            days_since_last_seen_list.append(int(days_last))

    return FundaSummaryResponse(
        scan_id=scan_id,
        listings_with_data=max(len(listing_durations), len(days_since_last_seen_list)),
        avg_listing_duration_days=(
            round(sum(listing_durations) / len(listing_durations), 1)
            if listing_durations
            else None
        ),
        total_price_changes=total_price_changes,
        avg_days_since_last_seen=(
            round(sum(days_since_last_seen_list) / len(days_since_last_seen_list), 1)
            if days_since_last_seen_list
            else None
        ),
        total_listing_snapshots=total_snapshots,
    )


async def list_results(
    db: AsyncSession,
    scan_id: uuid.UUID,
    current_user_id: uuid.UUID,
    *,
    has_pand: bool | None = None,
    search: str | None = None,
    bestemming_type: str | None = None,
    min_area_m2: float | None = None,
    max_area_m2: float | None = None,
    score_category: str | None = None,
    pand_status: str | None = None,
    min_score: float | None = None,
    exclude_null_scores: bool = False,
    sort_by: str = "score",
    sort_order: str = "desc",
    offset: int = 0,
    limit: int = 50,
) -> ScanResultsResponse:
    """List paginated scan results with filtering, sorting, and enrichment."""
    limit = min(limit, 100)

    scan = await service.get_scan_by_id(scan_id, db)
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

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
                SavedReport.user_id == current_user_id,
                SavedReport.deleted_at.is_(None),
                SavedReport.source_parcel_id.in_(parcel_ids),
            )
        )
        parcels_with_report = {
            value for value in report_rows.scalars().all() if value is not None
        }

    permit_activity_by_parcel = await _build_permit_activity_map(parcel_ids, db)
    listing_signal_by_parcel = await build_funda_listing_signal_map(parcel_ids, db)

    result_items = []
    for result, parcel in rows:
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
                [str(s) for s in raw_signals] if isinstance(raw_signals, list) else None
            )
            building_metrics = raw_metrics if isinstance(raw_metrics, dict) else None
            market_signals = _normalize_market_signals(raw_market_signals)

            v3_breakdown = result.flags.get("score_breakdown")
            if isinstance(v3_breakdown, dict):
                first_val = next(iter(v3_breakdown.values()), None)
                if isinstance(first_val, dict) and "categorie" in first_val:
                    score_breakdown = v3_breakdown
                else:
                    score_breakdown = v3_breakdown if v3_breakdown else None
            else:
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
                potentie_score=result.flags.get("scores", {}).get("potentie") if result.flags else None,
                risico_score=result.flags.get("scores", {}).get("risico") if result.flags else None,
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


async def get_scan_tiles(
    db: AsyncSession,
    scan_id: uuid.UUID,
    z: int,
    x: int,
    y: int,
) -> tuple[bytes | None, str]:
    """Generate MVT vector tiles for scan results.

    Returns ``(tile_data_or_None, cache_control_header)``.
    """
    scan = await service.get_scan_by_id(scan_id, db)
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    from app.services.tile_proxy import generate_mvt_tile

    tile_data = await generate_mvt_tile(z=z, x=x, y=y, scan_id=scan_id, db=db)

    cache_control = (
        "public, max-age=3600, stale-while-revalidate=86400"
        if scan.status == "completed"
        else "public, max-age=60"
    )

    return tile_data, cache_control


async def export_selection(
    db: AsyncSession,
    scan_id: uuid.UUID,
    parcel_ids: list[uuid.UUID],
    sort_by: str = "score",
    sort_order: str = "desc",
) -> tuple:
    """Export a user-selected subset of parcels to Excel.

    Returns ``(excel_buffer, filename)`` for the router to wrap.
    """
    scan = await service.get_scan_by_id(scan_id, db)
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    rows = await service.list_scan_results_by_ids(
        scan_id=scan_id,
        parcel_ids=parcel_ids,
        sort_by=sort_by,
        sort_order=sort_order,
        session=db,
    )

    filters_applied = {"selection": f"{len(parcel_ids)} percelen geselecteerd"}
    excel_buffer = await export_scan_results_to_excel(rows, scan, filters_applied)
    filename = f"propdex-selectie-{scan.gemeente_naam}-{scan.created_at.strftime('%Y%m%d')}.xlsx"

    return excel_buffer, filename


async def export_results(
    db: AsyncSession,
    scan_id: uuid.UUID,
    *,
    has_pand: bool | None = None,
    search: str | None = None,
    bestemming_type: str | None = None,
    min_area_m2: float | None = None,
    max_area_m2: float | None = None,
    score_category: str | None = None,
    pand_status: str | None = None,
    sort_by: str = "score",
    sort_order: str = "desc",
) -> tuple:
    """Export filtered scan results to Excel.

    Returns ``(excel_buffer, filename)`` for the router to wrap.
    """
    scan = await service.get_scan_by_id(scan_id, db)
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

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
        limit=10000,
        session=db,
        pand_status=pand_status,
    )

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

    excel_buffer = await export_scan_results_to_excel(rows, scan, filters_applied)
    filename = f"propdex-scan-{scan.gemeente_naam}-{scan.created_at.strftime('%Y%m%d')}.xlsx"

    return excel_buffer, filename
