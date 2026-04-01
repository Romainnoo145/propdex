"""Report management API endpoints."""
import io, logging, uuid  # noqa: E401

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.reports import service
from app.reports.freshness import check_report_freshness
from app.schemas.address import AddressInput
from app.schemas.common import MessageResponse
from app.schemas.report import (
    GeneratedDossierResponse, GenerateReportFromParcelResponse, ReportAssignProject,
    ReportDetailResponse, ReportFreshnessResponse, ReportFromAddressRequest,
    ReportFromParcelRequest, ReportListItem, ReportListResponse, ReportSaveRequest,
    ReportUpdateNotes, SortField, SortOrder,
)

logger = logging.getLogger(__name__)
locatieserver = PDOKLocatieserver()
router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _to_detail(report, *, report_data=None) -> ReportDetailResponse:
    return ReportDetailResponse(
        id=report.id, report_name=report.report_name,
        report_data=report_data if report_data is not None else report.report_data,
        postcode=report.postcode, city=report.city, notes=report.notes,
        project_id=report.project_id, source_parcel_id=report.source_parcel_id,
        created_at=report.created_at, updated_at=report.updated_at)


def _err(code: int, msg: str, exc=None):
    raise HTTPException(status_code=code, detail=msg) from exc


@router.post("", response_model=ReportDetailResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def save_report(request: Request, report_request: ReportSaveRequest,
                      current_user: User = Depends(get_current_active_user),
                      db: AsyncSession = Depends(get_db)) -> ReportDetailResponse:
    """Save a property intelligence report."""
    try:
        report, _ = await service.save_report(
            report_data=report_request.report_data, notes=report_request.notes,
            project_id=report_request.project_id, user_id=current_user.id, session=db, return_status=True)
        return _to_detail(report)
    except ValueError as e: _err(400, str(e), e)
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to save report", e)

@router.get("", response_model=ReportListResponse)
@limiter.limit("60/minute")
async def list_reports(request: Request, city: str | None = None, project_id: uuid.UUID | None = None,
                       search: str | None = None, sort_by: SortField = "updated", sort_order: SortOrder = "desc",
                       offset: int = 0, limit: int = 50, current_user: User = Depends(get_current_active_user),
                       db: AsyncSession = Depends(get_db)) -> ReportListResponse:
    """List saved reports with filtering, search, and sorting."""
    try:
        reports, total = await service.list_reports(
            user_id=current_user.id, city=city, project_id=project_id, search_query=search,
            sort_by=sort_by, sort_order=sort_order, offset=offset, limit=min(limit, 100), session=db)
        items = [ReportListItem(
            id=r.id, report_name=r.report_name, postcode=r.postcode, city=r.city, notes=r.notes,
            project_id=r.project_id, source_parcel_id=r.source_parcel_id,
            completeness_score=r.report_data.get("completeness_score", 0.0),
            created_at=r.created_at, updated_at=r.updated_at) for r in reports]
        return ReportListResponse(reports=items, total=total)
    except Exception as e: _err(500, "Failed to list reports", e)

@router.get("/cities", response_model=list[str])
@limiter.limit("60/minute")
async def get_cities(request: Request, current_user: User = Depends(get_current_active_user),
                     db: AsyncSession = Depends(get_db)) -> list[str]:
    """Get distinct cities from saved reports for filter dropdown."""
    try: return await service.get_distinct_cities(user_id=current_user.id, session=db)
    except Exception as e: _err(500, "Failed to get cities", e)

@router.post("/from-address", response_model=ReportDetailResponse,
             status_code=status.HTTP_201_CREATED, deprecated=True)
@limiter.limit("10/minute")
async def generate_report_from_address(request: Request, body: ReportFromAddressRequest,
                                       current_user: User = Depends(get_current_active_user),
                                       db: AsyncSession = Depends(get_db)) -> ReportDetailResponse:
    """Generate a report from address input (deprecated — use from-parcel)."""
    logger.warning("Deprecated from-address called for %s %s", body.postcode, body.huisnummer)
    try:
        report, _ = await service.generate_report_from_address(
            address_input=AddressInput(postcode=body.postcode, huisnummer=body.huisnummer),
            notes=body.notes, project_id=body.project_id, user_id=current_user.id,
            organization_id=current_user.organization_id, session=db,
            http_client=request.app.state.http_client, arq_pool=request.app.state.arq_pool)
        return _to_detail(report)
    except ValueError as e: _err(400, str(e), e)
    except HTTPException: raise
    except Exception as e:
        logger.exception("from-address failed")
        _err(500, f"Failed to generate report from address: {e}", e)

@router.post("/from-parcel", response_model=GenerateReportFromParcelResponse,
             status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def generate_report_from_parcel(request: Request, response: Response,
                                      body: ReportFromParcelRequest,
                                      current_user: User = Depends(get_current_active_user),
                                      db: AsyncSession = Depends(get_db)) -> GenerateReportFromParcelResponse:
    """Generate a full property intelligence report from a scan result parcel."""
    try:
        report, created = await service.generate_report_from_parcel(
            parcel_id=body.parcel_id, notes=body.notes, project_id=body.project_id,
            user_id=current_user.id, organization_id=current_user.organization_id,
            session=db, http_client=request.app.state.http_client,
            arq_pool=request.app.state.arq_pool, locatieserver=locatieserver)
        if not created: response.status_code = status.HTTP_200_OK
        return GenerateReportFromParcelResponse(report=_to_detail(report), created=created)
    except ValueError as e: _err(400, str(e), e)
    except HTTPException: raise
    except Exception as e:
        logger.exception("from-parcel failed")
        _err(500, f"Failed to generate report from parcel: {e}", e)

@router.get("/{report_id}", response_model=ReportDetailResponse)
@limiter.limit("60/minute")
async def get_report(request: Request, report_id: uuid.UUID,
                     current_user: User = Depends(get_current_active_user),
                     db: AsyncSession = Depends(get_db)) -> ReportDetailResponse:
    """Get full report details with live BRK and v7 backfill."""
    try:
        report = await service.get_report(report_id=report_id, user_id=current_user.id,
                                          organization_id=current_user.organization_id, session=db)
        enriched = await service.enrich_report_for_view(
            report=report, organization_id=current_user.organization_id, session=db,
            http_client=request.app.state.http_client, arq_pool=request.app.state.arq_pool)
        return _to_detail(report, report_data=enriched)
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to get report", e)

@router.delete("/{report_id}", response_model=MessageResponse)
@limiter.limit("30/minute")
async def delete_report(request: Request, report_id: uuid.UUID,
                        current_user: User = Depends(get_current_active_user),
                        db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Soft-delete a report."""
    try:
        await service.soft_delete_report(report_id=report_id, user_id=current_user.id,
                                         organization_id=current_user.organization_id, session=db)
        return {"message": "Report deleted", "id": str(report_id)}
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to delete report", e)

@router.post("/{report_id}/restore", response_model=ReportDetailResponse)
@limiter.limit("30/minute")
async def restore_report(request: Request, report_id: uuid.UUID,
                         current_user: User = Depends(get_current_active_user),
                         db: AsyncSession = Depends(get_db)) -> ReportDetailResponse:
    """Restore a soft-deleted report."""
    try:
        report = await service.restore_report(report_id=report_id, user_id=current_user.id, session=db)
        return _to_detail(report)
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to restore report", e)

@router.patch("/{report_id}/notes", response_model=ReportDetailResponse)
@limiter.limit("30/minute")
async def update_notes(request: Request, report_id: uuid.UUID, update_request: ReportUpdateNotes,
                       current_user: User = Depends(get_current_active_user),
                       db: AsyncSession = Depends(get_db)) -> ReportDetailResponse:
    """Update report notes."""
    try:
        report = await service.update_report_notes(
            report_id=report_id, user_id=current_user.id,
            organization_id=current_user.organization_id, notes=update_request.notes, session=db)
        return _to_detail(report)
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to update notes", e)

@router.patch("/{report_id}/project", response_model=ReportDetailResponse)
@limiter.limit("30/minute")
async def assign_project(request: Request, report_id: uuid.UUID, assign_request: ReportAssignProject,
                         current_user: User = Depends(get_current_active_user),
                         db: AsyncSession = Depends(get_db)) -> ReportDetailResponse:
    """Assign report to a project."""
    try:
        report = await service.assign_report_to_project(
            report_id=report_id, user_id=current_user.id,
            organization_id=current_user.organization_id, project_id=assign_request.project_id, session=db)
        return _to_detail(report)
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to assign project", e)

@router.put("/{report_id}/refresh", response_model=ReportDetailResponse)
@limiter.limit("10/minute")
async def refresh_report(request: Request, report_id: uuid.UUID, refresh_request: ReportSaveRequest,
                         current_user: User = Depends(get_current_active_user),
                         db: AsyncSession = Depends(get_db)) -> ReportDetailResponse:
    """Update report with fresh property data."""
    try:
        report = await service.update_report_data(
            report_id=report_id, user_id=current_user.id, organization_id=current_user.organization_id,
            fresh_data=refresh_request.report_data, session=db)
        return _to_detail(report)
    except ValueError as e: _err(400, str(e), e)
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to refresh report", e)

@router.get("/{report_id}/export/pdf")
@limiter.limit("10/minute")
async def export_report_pdf(request: Request, report_id: uuid.UUID,
                            current_user: User = Depends(get_current_active_user),
                            db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    """Export report as PDF document."""
    try:
        pdf_bytes, filename = await service.export_report_pdf_bytes(
            report_id=report_id, user_id=current_user.id,
            organization_id=current_user.organization_id, session=db)
        return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                                 headers={"Content-Disposition": f'attachment; filename="{filename}"'})
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to generate PDF", e)

@router.post("/{report_id}/dossier")
@limiter.limit("5/minute")
async def generate_startdossier(request: Request, report_id: uuid.UUID,
                                current_user: User = Depends(get_current_active_user),
                                db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    """Generate Risicobeoordeling Startdossier PDF."""
    try:
        pdf_bytes, filename = await service.generate_startdossier_bytes(
            report_id=report_id, user_id=current_user.id, organization_id=current_user.organization_id,
            generated_by=current_user.full_name or current_user.email, session=db)
        return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                                 headers={"Content-Disposition": f'attachment; filename="{filename}"'})
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to generate dossier PDF", e)

@router.get("/{report_id}/dossiers", response_model=list[GeneratedDossierResponse])
@limiter.limit("30/minute")
async def list_dossiers(request: Request, report_id: uuid.UUID,
                        current_user: User = Depends(get_current_active_user),
                        db: AsyncSession = Depends(get_db)) -> list[GeneratedDossierResponse]:
    """List previously generated dossiers for a report."""
    try:
        await service.get_report(report_id=report_id, user_id=current_user.id,
                                 organization_id=current_user.organization_id, session=db)
        dossiers = await service.list_generated_dossiers(report_id=report_id, user_id=current_user.id, session=db)
        return [GeneratedDossierResponse.model_validate(d) for d in dossiers]
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to list dossiers", e)

@router.get("/{report_id}/freshness", response_model=ReportFreshnessResponse)
@limiter.limit("30/minute")
async def get_report_freshness(request: Request, report_id: uuid.UUID,
                               current_user: User = Depends(get_current_active_user),
                               db: AsyncSession = Depends(get_db)) -> ReportFreshnessResponse:
    """Check if saved report has fresher data available."""
    try:
        report = await service.get_report(report_id=report_id, user_id=current_user.id,
                                          organization_id=current_user.organization_id, session=db)
        freshness_data = await check_report_freshness(
            report=report, organization_id=current_user.organization_id, session=db)
        return ReportFreshnessResponse(**freshness_data)
    except HTTPException: raise
    except Exception as e: _err(500, "Failed to check freshness", e)
