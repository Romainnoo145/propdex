"""Gemeente API endpoints — municipality-level intelligence."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.schemas.gemeente import GemeenteProfile
from app.services.gemeente_profile import build_gemeente_profile

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{gemeente_naam}/profile", response_model=GemeenteProfile)
async def get_gemeente_profile(
    gemeente_naam: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
) -> GemeenteProfile:
    """Get aggregated regulatory posture profile for a municipality.

    Aggregates permit outcomes, bekendmakingen activity, and court
    procedure doorlooptijd from existing data. No external API calls.

    Args:
        gemeente_naam: Municipality display name (e.g., "Venlo", "Amsterdam")
    """
    return await build_gemeente_profile(gemeente_naam, db)
