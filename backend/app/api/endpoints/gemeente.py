"""Gemeente API endpoints — municipality-level intelligence."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.schemas.gemeente import GemeenteProfile, RaadsinformatieResponse
from app.services.gemeente_profile import build_gemeente_profile
from app.services.raadsinformatie import get_raadsinformatie

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


@router.get("/{gemeente_naam}/raadsinformatie", response_model=RaadsinformatieResponse)
async def get_gemeente_raadsinformatie(
    gemeente_naam: str,
    limit: int = Query(default=10, ge=1, le=25),
    current_user=Depends(get_current_active_user),
) -> RaadsinformatieResponse:
    """Search Open Raadsinformatie for development-relevant council documents.

    Queries the ORI Elasticsearch API for vergaderstukken matching
    development keywords (omgevingsvergunning, bestemmingsplan, etc.).
    Results cached for 1 hour.

    Args:
        gemeente_naam: Municipality display name (e.g., "Venlo", "Amsterdam")
        limit: Maximum number of documents to return (1-25, default 10)
    """
    return await get_raadsinformatie(gemeente_naam, limit=limit)
