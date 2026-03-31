"""Report management API endpoints."""

import asyncio
import io
import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.middleware.rate_limit import limiter
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.models.user import User
from app.reports import service
from app.reports.dossier_export import generate_dossier_pdf
from app.reports.flags_assembler import assemble_enrichment_from_flags, build_flags_section_sources
from app.reports.freshness import check_report_freshness
from app.reports.pdf_export import generate_report_pdf
from app.schemas.address import AddressInput
from app.schemas.property import CadastralParcel, PropertyReportResponse
from app.schemas.report import (
    GeneratedDossierResponse,
    GenerateReportFromParcelResponse,
    ReportAssignProject,
    ReportDetailResponse,
    ReportFreshnessResponse,
    ReportFromAddressRequest,
    ReportFromParcelRequest,
    ReportListItem,
    ReportListResponse,
    ReportSaveRequest,
    ReportUpdateNotes,
    SortField,
    SortOrder,
)
from app.services.property_aggregator import aggregate_property_data, fetch_brk_ownership

logger = logging.getLogger(__name__)
locatieserver = PDOKLocatieserver()

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _extract_report_address_input(
    report_data: dict,
    fallback_postcode: str | None = None,
) -> AddressInput | None:
    """Build AddressInput from stored report payload."""
    address = report_data.get("address")
    if not isinstance(address, dict):
        return None

    postcode = address.get("postcode") or fallback_postcode
    huisnummer_raw = address.get("huisnummer")
    try:
        huisnummer = int(huisnummer_raw)
    except (TypeError, ValueError):
        return None

    if not postcode or huisnummer <= 0:
        return None

    try:
        return AddressInput(
            postcode=str(postcode),
            huisnummer=huisnummer,
        )
    except Exception:
        return None


def _report_needs_v7_backfill(report_data: dict) -> bool:
    """Detect old reports that miss newer v7 sections."""
    required_keys = (
        "energy_label",
        "woz_data",
        "market_signals",
        "buildability_delta",
        "wkb_precheck",
        "permit_precedents",
        "map_data",
        "monuments",
        "section_sources",
    )
    return any(key not in report_data for key in required_keys)


def _parse_parcel_address(address: str) -> tuple[str, int] | None:
    """
    Parse PDOK weergavenaam to (postcode, huisnummer).

    PDOK reverse format: "{straat} {huisnummer}, {postcode} {woonplaats}"
    Examples:
      "Kerkstraat 42, 5911AA Venlo"       -> ("5911 AA", 42)
      "Kerkstraat 42a, 5911 AA Venlo"     -> ("5911 AA", 42)
      "Dorpsstraat 1 bis, 1234 AB Stad"   -> ("1234 AB", 1)
    """
    upper = address.upper()

    # Extract postcode: 4 digits + optional space + 2 letters
    postcode_match = re.search(r"(\d{4})\s*([A-Z]{2})\b", upper)
    if not postcode_match:
        return None
    postcode = f"{postcode_match.group(1)} {postcode_match.group(2)}"

    # Extract huisnummer: first number sequence before the comma
    pre_comma = address.split(",")[0] if "," in address else address
    hn_match = re.search(r"(\d+)", pre_comma)
    if not hn_match:
        return None

    huisnummer = int(hn_match.group(1))
    if huisnummer <= 0:
        return None

    return postcode, huisnummer


def _parse_rd_point_wkt(wkt: str | None) -> tuple[float, float] | None:
    """Parse WKT POINT string to RD tuple."""
    if not isinstance(wkt, str) or not wkt:
        return None
    m = re.match(r"POINT\(([^ ]+) ([^ ]+)\)", wkt)
    if not m:
        return None
    try:
        return float(m.group(1)), float(m.group(2))
    except ValueError:
        return None


@router.post("", response_model=ReportDetailResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def save_report(
    request: Request,
    report_request: ReportSaveRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDetailResponse:
    """
    Save a property intelligence report.

    Stores a complete PropertyReportResponse snapshot with auto-generated
    name from address, denormalized fields for efficient filtering, and
    optional project assignment.

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        report_request: Report save request with report_data, notes, project_id
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        GenerateReportFromParcelResponse: report payload + explicit created/reused flag

    Raises:
        HTTPException 400: Invalid report_data
        HTTPException 404: Project not found
        HTTPException 500: Internal server error
    """
    try:
        report, _created = await service.save_report(
            report_data=report_request.report_data,
            notes=report_request.notes,
            project_id=report_request.project_id,
            user_id=current_user.id,
            session=db,
            return_status=True,
        )

        return ReportDetailResponse(
            id=report.id,
            report_name=report.report_name,
            report_data=report.report_data,
            postcode=report.postcode,
            city=report.city,
            notes=report.notes,
            project_id=report.project_id,
            source_parcel_id=report.source_parcel_id,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save report",
        ) from e


@router.get("", response_model=ReportListResponse)
@limiter.limit("60/minute")
async def list_reports(
    request: Request,
    city: str | None = None,
    project_id: uuid.UUID | None = None,
    search: str | None = None,
    sort_by: SortField = "updated",
    sort_order: SortOrder = "desc",
    offset: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ReportListResponse:
    """
    List saved reports with filtering, search, and sorting.

    Supports filtering by city and project, ILIKE search on report_name
    (address), and sorting by created_at, updated_at, or report_name.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        city: Optional city filter (exact match)
        project_id: Optional project filter (exact match)
        search: Optional search query (ILIKE on report_name)
        sort_by: Sort field ("created", "updated", "address")
        sort_order: Sort order ("asc", "desc")
        offset: Pagination offset (default 0)
        limit: Pagination limit (default 50, max 100)
        current_user: Authenticated user
        db: Database session

    Returns:
        ReportListResponse: List of reports with total count

    Raises:
        HTTPException 500: Internal server error
    """
    try:
        # Enforce max limit
        limit = min(limit, 100)

        reports, total = await service.list_reports(
            user_id=current_user.id,
            city=city,
            project_id=project_id,
            search_query=search,
            sort_by=sort_by,
            sort_order=sort_order,
            offset=offset,
            limit=limit,
            session=db,
        )

        # Convert to ReportListItem with completeness_score
        report_items = [
            ReportListItem(
                id=report.id,
                report_name=report.report_name,
                postcode=report.postcode,
                city=report.city,
                notes=report.notes,
                project_id=report.project_id,
                source_parcel_id=report.source_parcel_id,
                completeness_score=report.report_data.get("completeness_score", 0.0),
                created_at=report.created_at,
                updated_at=report.updated_at,
            )
            for report in reports
        ]

        return ReportListResponse(reports=report_items, total=total)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list reports",
        ) from e


@router.get("/cities", response_model=list[str])
@limiter.limit("60/minute")
async def get_cities(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """
    Get distinct cities from saved reports for filter dropdown.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        current_user: Authenticated user
        db: Database session

    Returns:
        list[str]: Sorted list of city names

    Raises:
        HTTPException 500: Internal server error
    """
    try:
        cities = await service.get_distinct_cities(
            user_id=current_user.id,
            session=db,
        )
        return cities

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get cities",
        ) from e


@router.post(
    "/from-address",
    response_model=ReportDetailResponse,
    status_code=status.HTTP_201_CREATED,
    deprecated=True,
)
@limiter.limit("10/minute")
async def generate_report_from_address(
    request: Request,
    body: ReportFromAddressRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDetailResponse:
    """
    Generate a report from address input.

    DEPRECATED: Use from-parcel for flags-enriched due diligence dossiers.
    Kept for meldingen fallback (items with postcode+huisnummer but no parcel_id).
    """
    logger.warning("Deprecated from-address report generation called for %s %s", body.postcode, body.huisnummer)
    try:
        address_input = AddressInput(
            postcode=body.postcode,
            huisnummer=body.huisnummer,
        )

        try:
            property_data = await aggregate_property_data(
                input_data=address_input,
                client=request.app.state.http_client,
                session=db,
                force_refresh=False,
                arq_pool=request.app.state.arq_pool,
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Fout bij ophalen van adresdata: {e}",
            ) from e

        report, _created = await service.save_report(
            report_data=property_data.model_dump(mode="json"),
            notes=body.notes,
            project_id=body.project_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            session=db,
            parcel_id=None,
            return_status=True,
        )

        return ReportDetailResponse(
            id=report.id,
            report_name=report.report_name,
            report_data=report.report_data,
            postcode=report.postcode,
            city=report.city,
            notes=report.notes,
            project_id=report.project_id,
            source_parcel_id=report.source_parcel_id,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("from-address failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report from address: {e}",
        ) from e


@router.post(
    "/from-parcel",
    response_model=GenerateReportFromParcelResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def generate_report_from_parcel(
    request: Request,
    response: Response,
    body: ReportFromParcelRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> GenerateReportFromParcelResponse:
    """
    Generate a full property intelligence report from a scan result parcel.

    Fetches the ParcelCache entry, parses its address, runs the full property
    aggregator pipeline, and saves the result as a new report.

    Requires JWT authentication. Rate limited to 10 requests per minute.

    Args:
        request: FastAPI request object
        body: Request with parcel_id, optional notes and project_id
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ReportDetailResponse: The saved report with full details

    Raises:
        HTTPException 404: Parcel not found or not in this organization
        HTTPException 422: Missing or unparseable address
        HTTPException 502: Aggregator API failure
        HTTPException 500: Internal server error
    """
    try:
        # 1. Query ParcelCache with org isolation
        result = await db.execute(
            select(ParcelCache).where(
                ParcelCache.id == body.parcel_id,
            )
        )
        parcel = result.scalar_one_or_none()
        if parcel is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Perceel niet gevonden",
            )

        # Idempotency shortcut: return existing report for this parcel if present.
        # This avoids duplicate reports and skips costly re-aggregation.
        existing_report = await service.get_report_by_source_parcel(
            parcel_id=body.parcel_id,
            user_id=current_user.id,
            session=db,
        )
        if existing_report is not None:
            if body.project_id is not None and existing_report.project_id != body.project_id:
                existing_report = await service.assign_report_to_project(
                    report_id=existing_report.id,
                    user_id=current_user.id,
                    organization_id=current_user.organization_id,
                    project_id=body.project_id,
                    session=db,
                )
            if body.notes is not None and existing_report.notes != body.notes:
                existing_report = await service.update_report_notes(
                    report_id=existing_report.id,
                    user_id=current_user.id,
                    organization_id=current_user.organization_id,
                    notes=body.notes,
                    session=db,
                )

            response.status_code = status.HTTP_200_OK
            return GenerateReportFromParcelResponse(
                report=ReportDetailResponse(
                    id=existing_report.id,
                    report_name=existing_report.report_name,
                    report_data=existing_report.report_data,
                    postcode=existing_report.postcode,
                    city=existing_report.city,
                    notes=existing_report.notes,
                    project_id=existing_report.project_id,
                    source_parcel_id=existing_report.source_parcel_id,
                    created_at=existing_report.created_at,
                    updated_at=existing_report.updated_at,
                ),
                created=False,
            )

        # 2. Parse address to postcode + huisnummer.
        # Fallback: when ParcelCache.address is missing/unparseable, reverse-geocode
        # the parcel centroid via PDOK so report generation still works from map marker.
        source_address = parcel.address
        parsed = _parse_parcel_address(source_address) if source_address else None
        if parsed is None:
            from geoalchemy2.functions import ST_AsText, ST_Centroid

            centroid_query = select(ST_AsText(ST_Centroid(ParcelCache.geometry))).where(
                ParcelCache.id == body.parcel_id,
            )
            centroid_row = (await db.execute(centroid_query)).one_or_none()
            rd_point = _parse_rd_point_wkt(centroid_row[0] if centroid_row else None)
            if rd_point is not None:
                reverse_address = await locatieserver.reverse(
                    rd_x=rd_point[0],
                    rd_y=rd_point[1],
                    client=request.app.state.http_client,
                )
                if reverse_address:
                    source_address = reverse_address
                    parsed = _parse_parcel_address(reverse_address)
                    if parsed is not None and not parcel.address:
                        parcel.address = reverse_address
                        db.add(parcel)

        if parsed is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Adres kan niet worden verwerkt: {source_address}"
                    if source_address
                    else "Geen geldig adres beschikbaar voor dit perceel"
                ),
            )
        postcode, huisnummer = parsed

        # 3. Build AddressInput
        address_input = AddressInput(postcode=postcode, huisnummer=huisnummer)

        # 4. Aggregate property data (flags-first: overlay scan enrichment when available)
        try:
            property_data = await aggregate_property_data(
                input_data=address_input,
                client=request.app.state.http_client,
                session=db,
                force_refresh=False,
                arq_pool=request.app.state.arq_pool,
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Fout bij ophalen van perceeldata: {e}",
            ) from e

        # 4b. Overlay cached scan enrichment from scan_results.flags when available (DD-01)
        flags_query = (
            select(ScanResult.flags, ScanResult.created_at)
            .join(AreaScan, ScanResult.scan_id == AreaScan.id)
            .where(
                ScanResult.parcel_id == body.parcel_id,
                AreaScan.status == "completed",
            )
            .order_by(ScanResult.created_at.desc())
            .limit(1)
        )
        flags_row = (await db.execute(flags_query)).one_or_none()
        if flags_row is not None:
            scan_flags, scan_created_at = flags_row
            if scan_flags and isinstance(scan_flags, dict):
                enrichment = assemble_enrichment_from_flags(scan_flags)
                report_dict = property_data.model_dump(mode="json")
                report_dict.update({k: v for k, v in enrichment.items() if v is not None})
                flag_sources = build_flags_section_sources(scan_flags, scan_created_at)
                report_dict.setdefault("section_sources", []).extend(
                    [s.model_dump(mode="json") for s in flag_sources]
                )
                property_data = PropertyReportResponse.model_validate(report_dict)
        else:
            logger.info(
                "No scan flags for parcel %s, using aggregator fallback",
                body.parcel_id,
            )

        # 5. Save report
        report, created = await service.save_report(
            report_data=property_data.model_dump(mode="json"),
            notes=body.notes,
            project_id=body.project_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            session=db,
            parcel_id=body.parcel_id,
            return_status=True,
        )

        # 5b. Auto-generate checklist PDFs for newly created reports (M020)
        if created:
            try:
                from app.reports.checklist_orchestrator import generate_checklist_documents

                checklist_result = await generate_checklist_documents(
                    report_data=report.report_data,
                    report_name=report.report_name,
                    parcel_id=body.parcel_id,
                    user_id=current_user.id,
                    db=db,
                )
                logger.info(
                    "Checklist docs for parcel=%s: generated=%d failed=%d skipped=%d",
                    body.parcel_id,
                    len(checklist_result.generated),
                    len(checklist_result.failed),
                    len(checklist_result.skipped),
                )
            except Exception:
                logger.warning(
                    "Checklist doc generation failed for parcel=%s — report saved successfully",
                    body.parcel_id,
                    exc_info=True,
                )

        # 6. Return report detail
        if not created:
            response.status_code = status.HTTP_200_OK

        return GenerateReportFromParcelResponse(
            report=ReportDetailResponse(
                id=report.id,
                report_name=report.report_name,
                report_data=report.report_data,
                postcode=report.postcode,
                city=report.city,
                notes=report.notes,
                project_id=report.project_id,
                source_parcel_id=report.source_parcel_id,
                created_at=report.created_at,
                updated_at=report.updated_at,
            ),
            created=created,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("from-parcel failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report from parcel: {e}",
        ) from e


@router.get("/{report_id}", response_model=ReportDetailResponse)
@limiter.limit("60/minute")
async def get_report(
    request: Request,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDetailResponse:
    """
    Get full report details including report_data JSONB.

    Requires JWT authentication. Rate limited to 60 requests per minute.

    Args:
        request: FastAPI request object
        report_id: Report ID
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ReportDetailResponse: Full report with report_data

    Raises:
        HTTPException 404: Report not found
        HTTPException 500: Internal server error
    """
    try:
        report = await service.get_report(
            report_id=report_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            session=db,
        )

        report_data = dict(report.report_data)  # copy of stored JSONB

        # Auto-upgrade older reports with missing v7 sections on first view.
        # This persists non-BRK sections so old reports become feature-complete.
        if _report_needs_v7_backfill(report_data):
            address_input = _extract_report_address_input(report_data, report.postcode)
            if address_input is not None:
                try:
                    fresh = await aggregate_property_data(
                        input_data=address_input,
                        client=request.app.state.http_client,
                        session=db,
                        force_refresh=False,
                        arq_pool=request.app.state.arq_pool,
                    )
                    fresh_data = fresh.model_dump(mode="json")
                    report = await service.update_report_data(
                        report_id=report.id,
                        user_id=current_user.id,
                        organization_id=current_user.organization_id,
                        fresh_data=fresh_data,
                        session=db,
                    )
                    report_data = dict(report.report_data)
                    # Keep live BRK for response only (never persisted).
                    report_data["brk_ownership"] = fresh_data.get("brk_ownership")
                except Exception as e:
                    logger.warning("Report v7 auto-backfill skipped for %s: %s", report.id, str(e))

        # BRK is stripped before save — re-fetch live for each view
        # (Kadaster Tier 3: data must be "actueel opgevraagd")
        if report_data.get("brk_ownership") is None:
            try:
                stored_parcels = [
                    CadastralParcel.model_validate(p)
                    for p in report_data.get("cadastral_parcels", [])
                ]
                brk_section = await fetch_brk_ownership(stored_parcels)
                report_data["brk_ownership"] = brk_section.model_dump(mode="json")
            except Exception as e:
                logger.warning("BRK re-fetch on view failed: %s", str(e))
                # Leave brk_ownership as None — frontend handles gracefully

        return ReportDetailResponse(
            id=report.id,
            report_name=report.report_name,
            report_data=report_data,  # Use enriched copy, not raw stored data
            postcode=report.postcode,
            city=report.city,
            notes=report.notes,
            project_id=report.project_id,
            source_parcel_id=report.source_parcel_id,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get report",
        ) from e


@router.delete("/{report_id}")
@limiter.limit("30/minute")
async def delete_report(
    request: Request,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Soft-delete a report.

    Sets deleted_at timestamp. Report can be restored later.

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        report_id: Report ID
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        dict: Success message with report_id

    Raises:
        HTTPException 404: Report not found
        HTTPException 500: Internal server error
    """
    try:
        await service.soft_delete_report(
            report_id=report_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            session=db,
        )

        return {"message": "Report deleted", "report_id": str(report_id)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete report",
        ) from e


@router.post("/{report_id}/restore", response_model=ReportDetailResponse)
@limiter.limit("30/minute")
async def restore_report(
    request: Request,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDetailResponse:
    """
    Restore a soft-deleted report.

    Clears deleted_at timestamp.

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        report_id: Report ID
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ReportDetailResponse: The restored report

    Raises:
        HTTPException 404: Deleted report not found
        HTTPException 500: Internal server error
    """
    try:
        report = await service.restore_report(
            report_id=report_id,
            user_id=current_user.id,
            session=db,
        )

        return ReportDetailResponse(
            id=report.id,
            report_name=report.report_name,
            report_data=report.report_data,
            postcode=report.postcode,
            city=report.city,
            notes=report.notes,
            project_id=report.project_id,
            source_parcel_id=report.source_parcel_id,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to restore report",
        ) from e


@router.patch("/{report_id}/notes", response_model=ReportDetailResponse)
@limiter.limit("30/minute")
async def update_notes(
    request: Request,
    report_id: uuid.UUID,
    update_request: ReportUpdateNotes,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDetailResponse:
    """
    Update report notes.

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        report_id: Report ID
        update_request: Notes update request
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ReportDetailResponse: The updated report

    Raises:
        HTTPException 404: Report not found
        HTTPException 500: Internal server error
    """
    try:
        report = await service.update_report_notes(
            report_id=report_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            notes=update_request.notes,
            session=db,
        )

        return ReportDetailResponse(
            id=report.id,
            report_name=report.report_name,
            report_data=report.report_data,
            postcode=report.postcode,
            city=report.city,
            notes=report.notes,
            project_id=report.project_id,
            source_parcel_id=report.source_parcel_id,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notes",
        ) from e


@router.patch("/{report_id}/project", response_model=ReportDetailResponse)
@limiter.limit("30/minute")
async def assign_project(
    request: Request,
    report_id: uuid.UUID,
    assign_request: ReportAssignProject,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDetailResponse:
    """
    Assign report to a project.

    When project_id is null, backend auto-assigns the report to a
    gemeente folder based on report location.

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        report_id: Report ID
        assign_request: Project assignment request
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ReportDetailResponse: The updated report

    Raises:
        HTTPException 404: Report or project not found
        HTTPException 500: Internal server error
    """
    try:
        report = await service.assign_report_to_project(
            report_id=report_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            project_id=assign_request.project_id,
            session=db,
        )

        return ReportDetailResponse(
            id=report.id,
            report_name=report.report_name,
            report_data=report.report_data,
            postcode=report.postcode,
            city=report.city,
            notes=report.notes,
            project_id=report.project_id,
            source_parcel_id=report.source_parcel_id,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign project",
        ) from e


@router.put("/{report_id}/refresh", response_model=ReportDetailResponse)
@limiter.limit("10/minute")
async def refresh_report(
    request: Request,
    report_id: uuid.UUID,
    refresh_request: ReportSaveRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ReportDetailResponse:
    """
    Update report with fresh property data.

    Updates report_data JSONB with fresh PropertyReportResponse from a
    new property lookup. This endpoint should be called after using the
    property lookup endpoint with force_refresh=True.

    Requires JWT authentication. Rate limited to 10 requests per minute
    (stricter limit as this may trigger API calls).

    Args:
        request: FastAPI request object
        report_id: Report ID
        refresh_request: Fresh report data
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ReportDetailResponse: The updated report

    Raises:
        HTTPException 400: Invalid report_data
        HTTPException 404: Report not found
        HTTPException 500: Internal server error
    """
    try:
        report = await service.update_report_data(
            report_id=report_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            fresh_data=refresh_request.report_data,
            session=db,
        )

        return ReportDetailResponse(
            id=report.id,
            report_name=report.report_name,
            report_data=report.report_data,
            postcode=report.postcode,
            city=report.city,
            notes=report.notes,
            project_id=report.project_id,
            source_parcel_id=report.source_parcel_id,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh report",
        ) from e


@router.get("/{report_id}/export/pdf")
@limiter.limit("10/minute")
async def export_report_pdf(
    request: Request,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Export report as professional PDF document.

    Generates a formatted A4 PDF with branded header, all report sections,
    confidence indicators, and source citations. PDF generation runs in
    executor to avoid blocking the async event loop.

    Requires JWT authentication. Rate limited to 10 requests per minute
    (PDF generation is CPU-intensive).

    Args:
        request: FastAPI request object
        report_id: Report ID
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        StreamingResponse: PDF file with application/pdf content type

    Raises:
        HTTPException 404: Report not found
        HTTPException 500: PDF generation failed
    """
    try:
        # Fetch report (validates tenant + exists + not deleted)
        report = await service.get_report(
            report_id=report_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            session=db,
        )

        # Generate PDF in executor to avoid blocking event loop
        pdf_bytes = await asyncio.to_thread(
            generate_report_pdf,
            report.report_data,
            report.report_name,
        )

        # Create filename from postcode (remove space for filesystem compatibility)
        postcode_clean = report.postcode.replace(" ", "")
        filename = f"rapport-{postcode_clean}.pdf"

        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate PDF",
        ) from e


@router.post("/{report_id}/dossier")
@limiter.limit("5/minute")
async def generate_startdossier(
    request: Request,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Generate a Risicobeoordeling Startdossier PDF for a saved report.

    Renders a WKB Kwaliteitsborger dossier PDF from the report data, saves an
    audit record in generated_dossiers, and returns the PDF as a streaming download.

    PDF generation runs in an executor to avoid blocking the async event loop.
    Rate limited to 5 requests per minute (CPU-intensive WeasyPrint rendering).

    Args:
        request: FastAPI request object
        report_id: Report ID
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        StreamingResponse: PDF file with application/pdf content type

    Raises:
        HTTPException 404: Report not found
        HTTPException 500: PDF generation failed
    """
    try:
        # Fetch report (validates tenant + exists + not deleted)
        report = await service.get_report(
            report_id=report_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            session=db,
        )

        # Determine generator display name
        generated_by = current_user.full_name or current_user.email

        # Generate PDF in executor to avoid blocking event loop
        pdf_bytes = await asyncio.to_thread(
            generate_dossier_pdf,
            report.report_data,
            report.report_name,
            generated_by,
        )

        # Save audit record
        await service.save_generated_dossier(
            report_id=report.id,
            user_id=current_user.id,
            file_size=len(pdf_bytes),
            session=db,
        )

        # Build filename from postcode
        postcode_clean = report.postcode.replace(" ", "")
        filename = f"risicobeoordeling-{postcode_clean}.pdf"

        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate dossier PDF",
        ) from e


@router.get("/{report_id}/dossiers", response_model=list[GeneratedDossierResponse])
@limiter.limit("30/minute")
async def list_dossiers(
    request: Request,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[GeneratedDossierResponse]:
    """
    List previously generated dossiers for a report.

    Returns generation history ordered by newest first, including file sizes
    and template versions for each generation event.

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        report_id: Report ID
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        list[GeneratedDossierResponse]: List of dossier generation records

    Raises:
        HTTPException 404: Report not found
        HTTPException 500: Internal server error
    """
    try:
        # Verify report exists and belongs to this org
        await service.get_report(
            report_id=report_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            session=db,
        )

        dossiers = await service.list_generated_dossiers(
            report_id=report_id,
            user_id=current_user.id,
            session=db,
        )

        return [GeneratedDossierResponse.model_validate(d) for d in dossiers]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list dossiers",
        ) from e


@router.get("/{report_id}/freshness", response_model=ReportFreshnessResponse)
@limiter.limit("30/minute")
async def get_report_freshness(
    request: Request,
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ReportFreshnessResponse:
    """
    Check if saved report has fresher data available.

    Compares saved snapshot timestamps with latest cache entries for each
    section. Uses 24-hour threshold to identify sections with significant
    updates available.

    Requires JWT authentication. Rate limited to 30 requests per minute.

    Args:
        request: FastAPI request object
        report_id: Report ID
        current_user: Authenticated user
        organization_id: Tenant ID
        db: Database session

    Returns:
        ReportFreshnessResponse: Freshness check results with updated sections

    Raises:
        HTTPException 404: Report not found
        HTTPException 500: Freshness check failed
    """
    try:
        # Fetch report (validates tenant + exists + not deleted)
        report = await service.get_report(
            report_id=report_id,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            session=db,
        )

        # Check freshness
        freshness_data = await check_report_freshness(
            report=report,
            organization_id=current_user.organization_id,
            session=db,
        )

        return ReportFreshnessResponse(**freshness_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check freshness",
        ) from e
