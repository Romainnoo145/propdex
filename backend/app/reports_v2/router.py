"""HTTP-router voor reports-v2 endpoints (M055/S01)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.reports_v2.dakkapel_report import build_dakkapel_report
from app.reports_v2.schemas import DakkapelReport, SplitsingReport
from app.reports_v2.splitsing_report import build_splitsing_report

router = APIRouter(prefix="/api/reports-v2", tags=["Reports v2"])


@router.get("/splitsing/{parcel_id}", response_model=SplitsingReport)
@limiter.limit("60/minute")
async def get_splitsing_report(
    request: Request,
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SplitsingReport:
    """Geeft het splitsings-rapport voor een perceel."""
    try:
        return await build_splitsing_report(
            db, parcel_id=parcel_id, organization_id=current_user.organization_id
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/dakkapel/{parcel_id}", response_model=DakkapelReport)
@limiter.limit("60/minute")
async def get_dakkapel_report(
    request: Request,
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DakkapelReport:
    """Geeft het dakkapel-vergunningsrapport voor een perceel."""
    try:
        return await build_dakkapel_report(
            db, parcel_id=parcel_id, today=datetime.utcnow().strftime("%Y-%m-%d")
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
