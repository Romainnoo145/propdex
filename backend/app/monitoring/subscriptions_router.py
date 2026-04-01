"""Subscription and refresh endpoints for monitoring."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.monitoring.subscriptions_service import (
    get_funda_snapshot_stats_logic,
    get_gemeente_subscription_logic,
    refresh_monitoring_logic,
    set_gemeente_subscription_logic,
    trigger_funda_snapshot_logic,
)
from app.schemas.monitoring import (
    FundaSnapshotRequest,
    FundaSnapshotResponse,
    FundaSnapshotStatsResponse,
    MonitoringSubscriptionRequest,
    MonitoringSubscriptionResponse,
    RefreshMonitoringResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Monitoring"])


@router.post("/subscriptions", response_model=MonitoringSubscriptionResponse)
@limiter.limit("30/minute")
async def set_gemeente_subscription(
    request: Request,
    payload: MonitoringSubscriptionRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> MonitoringSubscriptionResponse:
    """Enable or disable monitoring for a single gemeente."""
    try:
        result = await set_gemeente_subscription_logic(
            db=db,
            organization_id=organization_id,
            gemeente_code_raw=payload.gemeente_code,
            gemeente_naam_raw=payload.gemeente_naam,
            enabled=payload.enabled,
        )
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid gemeente_code",
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update gemeente monitoring subscription: %s", e)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update gemeente monitoring subscription",
        ) from e


@router.get(
    "/subscriptions/{gemeente_code}",
    response_model=MonitoringSubscriptionResponse,
)
@limiter.limit("60/minute")
async def get_gemeente_subscription(
    request: Request,
    gemeente_code: str,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> MonitoringSubscriptionResponse:
    """Get current monitoring status for one gemeente code."""
    result = await get_gemeente_subscription_logic(
        db=db,
        organization_id=organization_id,
        gemeente_code_raw=gemeente_code,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid gemeente_code",
        )
    return result


@router.post("/refresh/{project_id}", response_model=RefreshMonitoringResponse)
@limiter.limit("5/minute")
async def refresh_monitoring(
    request: Request,
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """On-demand monitoring refresh for a single gemeente project."""
    try:
        result = await refresh_monitoring_logic(
            db=db,
            organization_id=organization_id,
            project_id=project_id,
        )
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Monitored project not found",
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("On-demand monitoring refresh failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh monitoring",
        ) from e


@router.post(
    "/listings/funda/snapshot",
    response_model=FundaSnapshotResponse,
)
@limiter.limit("3/minute")
async def trigger_funda_snapshot(
    request: Request,
    payload: FundaSnapshotRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
) -> FundaSnapshotResponse:
    """Queue a manual Funda snapshot ingestion job for this organization."""
    return await trigger_funda_snapshot_logic(
        arq_pool=request.app.state.arq_pool,
        organization_id=organization_id,
        area_names_raw=payload.area_names,
        max_listings_raw=payload.max_listings,
    )


@router.get(
    "/listings/funda/stats",
    response_model=FundaSnapshotStatsResponse,
)
@limiter.limit("30/minute")
async def get_funda_snapshot_stats(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> FundaSnapshotStatsResponse:
    """Return coarse ingestion stats for Funda snapshots."""
    return await get_funda_snapshot_stats_logic(db=db)
