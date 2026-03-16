"""CRUD endpoints for parcel favorites and portfolio grouped view."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user, get_current_organization_id
from app.core.database import get_db
from app.favorites.schemas import (
    FavoriteCreate,
    FavoriteResponse,
    PipelineUpdateRequest,
    PortfolioGemeenteGroup,
    PortfolioResponse,
    PortfolioWijkGroup,
)
from app.middleware.rate_limit import limiter
from app.models.parcel_favorite import ParcelFavorite
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/parcels", tags=["Favorites"])
portfolio_router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])


async def _get_favorite_or_404(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    parcel_id: str,
) -> ParcelFavorite:
    """Fetch favorite by (org, user, parcel) or raise 404."""
    result = await db.execute(
        select(ParcelFavorite).where(
            ParcelFavorite.organization_id == org_id,
            ParcelFavorite.user_id == user_id,
            ParcelFavorite.parcel_id == parcel_id,
        )
    )
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")
    return fav


@router.post(
    "/favorites",
    response_model=FavoriteResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("30/minute")
async def create_favorite(
    request: Request,
    body: FavoriteCreate,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> FavoriteResponse:
    """
    Add a parcel to favorites. Idempotent: returns existing favorite with 200 if already present.
    Creates a new favorite with pipeline_stage='Gesignaleerd' and returns 201.
    """
    # Idempotency check
    result = await db.execute(
        select(ParcelFavorite).where(
            ParcelFavorite.organization_id == organization_id,
            ParcelFavorite.user_id == current_user.id,
            ParcelFavorite.parcel_id == body.parcel_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        # Return existing with 200 — caller must handle status code branching
        from fastapi.responses import JSONResponse

        return JSONResponse(  # type: ignore[return-value]
            status_code=status.HTTP_200_OK,
            content=FavoriteResponse.model_validate(existing).model_dump(mode="json"),
        )

    # Enrich from parcel_cache + scan_results if frontend didn't provide names
    fav = ParcelFavorite(
        parcel_id=body.parcel_id,
        user_id=current_user.id,
        organization_id=organization_id,
        gemeente_code=body.gemeente_code,
        gemeente_naam=body.gemeente_naam,
        wijk_naam=body.wijk_naam,
        address=body.address,
        pipeline_stage="Gesignaleerd",
    )
    db.add(fav)
    await db.commit()
    await db.refresh(fav)

    logger.info(
        "Favorite created: parcel=%s user=%s org=%s",
        fav.parcel_id,
        current_user.id,
        organization_id,
    )

    return FavoriteResponse.model_validate(fav)


@router.get(
    "/favorites",
    response_model=list[FavoriteResponse],
)
@limiter.limit("30/minute")
async def list_favorites(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> list[FavoriteResponse]:
    """Return all favorites for the current user in the current organisation."""
    result = await db.execute(
        select(ParcelFavorite)
        .where(
            ParcelFavorite.organization_id == organization_id,
            ParcelFavorite.user_id == current_user.id,
        )
        .order_by(ParcelFavorite.created_at.desc())
    )
    favorites = list(result.scalars().all())
    return [FavoriteResponse.model_validate(f) for f in favorites]


@router.delete(
    "/favorites/{parcel_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@limiter.limit("30/minute")
async def delete_favorite(
    request: Request,
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a parcel from favorites. Returns 204 No Content."""
    fav = await _get_favorite_or_404(db, organization_id, current_user.id, parcel_id)
    await db.delete(fav)
    await db.commit()

    logger.info(
        "Favorite deleted: parcel=%s user=%s org=%s",
        parcel_id,
        current_user.id,
        organization_id,
    )


@router.patch(
    "/favorites/{parcel_id}/pipeline",
    response_model=FavoriteResponse,
)
@limiter.limit("30/minute")
async def update_pipeline(
    request: Request,
    parcel_id: str,
    body: PipelineUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> FavoriteResponse:
    """
    Update the pipeline stage for a favorited parcel.
    Pydantic Literal validation on PipelineUpdateRequest.stage auto-returns 422 for invalid values.
    """
    fav = await _get_favorite_or_404(db, organization_id, current_user.id, parcel_id)

    fav.pipeline_stage = body.stage
    if body.stage == "Afgerond":
        fav.afgerond_reden = body.afgerond_reden
        fav.notitie = body.notitie
    else:
        fav.afgerond_reden = None
        fav.notitie = None

    await db.commit()
    await db.refresh(fav)

    logger.info(
        "Pipeline updated: parcel=%s stage=%s user=%s org=%s",
        parcel_id,
        body.stage,
        current_user.id,
        organization_id,
    )

    return FavoriteResponse.model_validate(fav)


@portfolio_router.get(
    "",
    response_model=PortfolioResponse,
)
@limiter.limit("30/minute")
async def get_portfolio(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> PortfolioResponse:
    """
    Return all favorites grouped by gemeente/wijk for the current organisation.
    Uses a single GROUP BY query — no N+1 queries.
    Provincie grouping is derived by the frontend from gemeente_code using CBS GeoJSON.
    """
    rows = (
        await db.execute(
            select(
                ParcelFavorite.gemeente_code,
                ParcelFavorite.gemeente_naam,
                ParcelFavorite.wijk_naam,
                func.count(ParcelFavorite.id).label("parcel_count"),
            )
            .where(ParcelFavorite.organization_id == organization_id)
            .group_by(
                ParcelFavorite.gemeente_code,
                ParcelFavorite.gemeente_naam,
                ParcelFavorite.wijk_naam,
            )
            .order_by(ParcelFavorite.gemeente_naam, ParcelFavorite.wijk_naam)
        )
    ).all()

    # Aggregate rows into gemeente groups in Python
    gemeente_map: dict[str | None, PortfolioGemeenteGroup] = {}
    for row in rows:
        key = row.gemeente_code
        if key not in gemeente_map:
            gemeente_map[key] = PortfolioGemeenteGroup(
                gemeente_code=row.gemeente_code,
                gemeente_naam=row.gemeente_naam,
                total_count=0,
                wijken=[],
            )
        gemeente_map[key].wijken.append(
            PortfolioWijkGroup(
                wijk_naam=row.wijk_naam,
                parcel_count=row.parcel_count,
            )
        )
        gemeente_map[key].total_count += row.parcel_count

    gemeenten = list(gemeente_map.values())
    total_favorites = sum(g.total_count for g in gemeenten)

    return PortfolioResponse(gemeenten=gemeenten, total_favorites=total_favorites)
