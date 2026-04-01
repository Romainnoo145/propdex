"""Change CRUD endpoints for monitoring."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.monitoring.changes_service import (
    get_changes_list,
    get_parcel_changes,
    get_unread_counts,
    mark_all_changes_read,
    mark_single_change_read,
    mark_single_change_unread,
)
from app.schemas.common import StatusResponse
from app.schemas.monitoring import (
    ChangeRecordListResponse,
    ChangeRecordResponse,
    MarkAllReadResponse,
    UnreadDetailResponse,
)

router = APIRouter(tags=["Monitoring"])


@router.get("/changes", response_model=ChangeRecordListResponse)
@limiter.limit("60/minute")
async def get_changes(
    request: Request,
    project_id: uuid.UUID | None = Query(None),
    gemeente_naam: str | None = Query(None),
    include_matches: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> ChangeRecordListResponse:
    """Get change history, optionally filtered by project."""
    try:
        result = await get_changes_list(
            db=db,
            user_id=current_user.id,
            organization_id=organization_id,
            project_id=project_id,
            gemeente_naam=gemeente_naam,
            include_matches=include_matches,
            limit=limit,
            offset=offset,
        )
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get change history",
        ) from e


@router.get(
    "/changes-for-parcel/{parcel_id}",
    response_model=list[ChangeRecordResponse],
)
@limiter.limit("60/minute")
async def get_changes_for_parcel(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> list[ChangeRecordResponse]:
    """Get bekendmakingen matching a specific parcel's postcode."""
    try:
        return await get_parcel_changes(db=db, parcel_id=parcel_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get changes for parcel",
        ) from e


@router.get("/unread", response_model=UnreadDetailResponse)
@limiter.limit("120/minute")
async def get_unread(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> UnreadDetailResponse:
    """Get unread change counts for current user."""
    try:
        return await get_unread_counts(db=db, user_id=current_user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get unread counts",
        ) from e


@router.post("/changes/read-all", response_model=MarkAllReadResponse)
@limiter.limit("30/minute")
async def mark_all_read(
    request: Request,
    project_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> MarkAllReadResponse:
    """Mark all changes as read for the current user."""
    try:
        result = await mark_all_changes_read(
            db=db,
            user_id=current_user.id,
            organization_id=organization_id,
            project_id=project_id,
        )
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark all changes as read",
        ) from e


@router.post("/changes/{change_id}/read", response_model=StatusResponse)
@limiter.limit("60/minute")
async def mark_change_read(
    request: Request,
    change_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Mark a single change as read for the current user."""
    try:
        found = await mark_single_change_read(
            db=db,
            user_id=current_user.id,
            organization_id=organization_id,
            change_id=change_id,
        )
        if not found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Change not found",
            )
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark change as read",
        ) from e


@router.delete("/changes/{change_id}/read", response_model=StatusResponse)
@limiter.limit("60/minute")
async def mark_change_unread(
    request: Request,
    change_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Mark a single change as unread for the current user."""
    try:
        await mark_single_change_unread(
            db=db,
            user_id=current_user.id,
            change_id=change_id,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark change as unread",
        ) from e
