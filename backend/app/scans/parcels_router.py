"""Parcel-focused API endpoints (wijken, enrichment, centroid, at-point, eigendom, resolve, aerial).

Thin HTTP handlers — all business logic lives in parcels_service.py.
"""

import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    get_current_active_user,
    get_current_org_expose_score_internals,
    get_current_organization_id,
)
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.scans import parcels_service
from app.scans.schemas import (
    ParcelAtPointResponse,
    ParcelCentroidResponse,
    ParcelEnrichmentResponse,
    ParcelResolveResponse,
    ParcelRiskProfileResponse,
    ScanResultItem,
)
from app.schemas.brk_ownership import BRKOwnership
from app.services.wijk_service import get_wijken_in_gemeente

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/wijken")  # exempt: GeoJSON response
@limiter.limit("30/minute")
async def get_wijken(
    request: Request,
    gemeente_code: str,
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Get wijk (district) boundaries for a gemeente."""
    try:
        http_client = request.app.state.http_client
        geojson = await get_wijken_in_gemeente(gemeente_code, http_client)
        return geojson
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No wijken found for gemeente {gemeente_code}: {e}",
        ) from e
    except httpx.HTTPError as e:
        logger.exception("CBS WFS service error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="CBS WFS service unavailable",
        ) from e
    except Exception as e:
        logger.exception("Failed to fetch wijken")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch wijken: {e}",
        ) from e


@router.get("/parcels/{parcel_id}/enrich", response_model=ParcelEnrichmentResponse)
@limiter.limit("30/minute")
async def enrich_parcel(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ParcelEnrichmentResponse:
    """Fetch on-demand Tier 2 enrichment for a parcel."""
    return await parcels_service.enrich_parcel(
        db=db,
        parcel_id=parcel_id,
        http_client=request.app.state.http_client,
    )


@router.get("/parcels/{parcel_id}/scan-data", response_model=ScanResultItem)
@limiter.limit("30/minute")
async def get_parcel_scan_data(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    expose_internals: bool = Depends(get_current_org_expose_score_internals),
    db: AsyncSession = Depends(get_db),
) -> ScanResultItem:
    """Fetch the latest scan result data for a single parcel."""
    return await parcels_service.get_parcel_scan_data(
        db=db, parcel_id=parcel_id, expose_internals=expose_internals,
    )


@router.get("/parcels/{parcel_id}/risk-profile", response_model=ParcelRiskProfileResponse)
@limiter.limit("30/minute")
async def get_parcel_risk_profile(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ParcelRiskProfileResponse:
    """Fetch fysiek risicoprofiel for a parcel."""
    return await parcels_service.get_parcel_risk_profile(
        db=db,
        parcel_id=parcel_id,
        http_client=request.app.state.http_client,
    )


@router.get("/parcels/{parcel_id}/centroid", response_model=ParcelCentroidResponse)
@limiter.limit("60/minute")
async def get_parcel_centroid(
    request: Request,
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ParcelCentroidResponse:
    """Return parcel centroid in WGS84 for map fly-to."""
    return await parcels_service.get_parcel_centroid(
        db=db,
        parcel_id=parcel_id,
        request=request,
    )


@router.get("/parcels/at-point", response_model=ParcelAtPointResponse)
@limiter.limit("120/minute")
async def get_parcel_at_point(
    request: Request,
    lng: float = Query(..., ge=-180, le=180),
    lat: float = Query(..., ge=-90, le=90),
    scan_id: uuid.UUID | None = Query(
        default=None,
        description="Optional scan_id to include scan-specific score/flags for this parcel",
    ),
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    expose_internals: bool = Depends(get_current_org_expose_score_internals),
    db: AsyncSession = Depends(get_db),
) -> ParcelAtPointResponse:
    """Resolve the parcel that intersects a clicked WGS84 map point."""
    return await parcels_service.get_parcel_at_point(
        db=db,
        lng=lng,
        lat=lat,
        organization_id=organization_id,
        scan_id=scan_id,
        request=request,
        expose_internals=expose_internals,
    )


@router.get("/parcels/{parcel_id}/eigendom", response_model=BRKOwnership)
@limiter.limit("30/minute")
async def get_parcel_eigendom(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """On-demand BRK eigendom lookup for a parcel."""
    return await parcels_service.get_parcel_eigendom(db=db, parcel_id=parcel_id)


@router.get("/parcels/resolve", response_model=ParcelResolveResponse)
@limiter.limit("60/minute")
async def resolve_parcel_by_address(
    request: Request,
    street: str = Query(..., min_length=2),
    huisnummer: int = Query(..., ge=1),
    postcode: str | None = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Resolve a ParcelCache UUID from address hints for map-focused navigation."""
    return await parcels_service.resolve_parcel_by_address(
        db=db,
        street=street,
        huisnummer=huisnummer,
        postcode=postcode,
    )


@router.get("/parcels/{parcel_id}/aerial-crop")
@limiter.limit("60/minute")
async def get_aerial_crop(
    request: Request,
    parcel_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Return a JPEG aerial image crop centered on the parcel."""
    content, media_type = await parcels_service.get_aerial_crop(
        db=db,
        parcel_id=parcel_id,
        http_client=request.app.state.http_client,
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
