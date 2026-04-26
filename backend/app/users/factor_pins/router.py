"""REST endpoints for per-user factor pins.

Phase 7 (M048/S04) — PIN-03.
Mounted under /api/users/me/factor-pins by app.main.

Multi-tenant: every query explicitly filters on
organization_id == current_user.organization_id (no implicit middleware).

Transactions: direct db.add/flush/commit (NOT `async with db.begin()`).
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.user_factor_pin import UserFactorPin
from app.users.factor_pins.schemas import (
    FactorPinCreate,
    FactorPinResponse,
    PinCategory,
)

logger = logging.getLogger(__name__)

MAX_PINS_PER_CATEGORY = 6

router = APIRouter(
    prefix="/api/users/me/factor-pins",
    tags=["user-factor-pins"],
)


@router.get("", response_model=list[FactorPinResponse])
async def list_pins(
    category: PinCategory,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FactorPinResponse]:
    """List the current user's pins for a given category, sorted by position ASC."""
    result = await db.execute(
        select(UserFactorPin)
        .where(
            UserFactorPin.user_id == current_user.id,
            UserFactorPin.organization_id == current_user.organization_id,
            UserFactorPin.category == category,
        )
        .order_by(UserFactorPin.position.asc())
    )
    return [FactorPinResponse.model_validate(p) for p in result.scalars()]


@router.post(
    "",
    response_model=FactorPinResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pin(
    data: FactorPinCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FactorPinResponse:
    """Create a new pin. Enforces max-6 per category and uniqueness."""
    # Server-side max-6 guard (frontend has its own toast guard; this is the backup-net)
    count_q = select(func.count(UserFactorPin.id)).where(
        UserFactorPin.user_id == current_user.id,
        UserFactorPin.organization_id == current_user.organization_id,
        UserFactorPin.category == data.category,
    )
    count = (await db.execute(count_q)).scalar() or 0
    if count >= MAX_PINS_PER_CATEGORY:
        logger.info(
            "factor_pin.max_reached user=%s org=%s category=%s",
            current_user.id, current_user.organization_id, data.category,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "MAX_PINS_REACHED",
                "message": f"Max {MAX_PINS_PER_CATEGORY} pins per category",
            },
        )

    # Pre-check: reject duplicate before INSERT to avoid session rollback overhead.
    # This matches the project's "check before insert" pattern (see auth_service.py).
    duplicate_q = select(UserFactorPin.id).where(
        UserFactorPin.user_id == current_user.id,
        UserFactorPin.organization_id == current_user.organization_id,
        UserFactorPin.category == data.category,
        UserFactorPin.factor_key == data.factor_key,
    )
    existing_pin = (await db.execute(duplicate_q)).scalar_one_or_none()
    if existing_pin is not None:
        logger.info(
            "factor_pin.duplicate user=%s category=%s factor_key=%s",
            current_user.id, data.category, data.factor_key,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already pinned",
        )

    # Compute next position
    max_pos_q = select(func.max(UserFactorPin.position)).where(
        UserFactorPin.user_id == current_user.id,
        UserFactorPin.organization_id == current_user.organization_id,
        UserFactorPin.category == data.category,
    )
    max_pos = (await db.execute(max_pos_q)).scalar()
    next_position = (max_pos + 1) if max_pos is not None else 0

    pin = UserFactorPin(
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        category=data.category,
        factor_key=data.factor_key,
        position=next_position,
    )
    db.add(pin)
    await db.flush()
    await db.commit()
    await db.refresh(pin)
    return FactorPinResponse.model_validate(pin)


@router.delete(
    "/{pin_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_pin(
    pin_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a pin owned by the current user. Returns 204 on success or 404 if not found."""
    # Verify ownership + tenant before delete
    own_q = select(UserFactorPin).where(
        UserFactorPin.id == pin_id,
        UserFactorPin.user_id == current_user.id,
        UserFactorPin.organization_id == current_user.organization_id,
    )
    existing = (await db.execute(own_q)).scalar_one_or_none()
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pin not found",
        )

    await db.execute(
        delete(UserFactorPin).where(
            UserFactorPin.id == pin_id,
            UserFactorPin.user_id == current_user.id,
            UserFactorPin.organization_id == current_user.organization_id,
        )
    )
    await db.commit()
    return None
