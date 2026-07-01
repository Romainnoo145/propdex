"""CRUD endpoints for parcel favorites and portfolio grouped view."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.chat_schemas import BulkFavoriteCreate, BulkFavoriteResponse
from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.favorites.favorites_service import (
    NoteCreateRequest,
    NoteResponse,
    NoteUpdateRequest,
    create_favorite,
    create_favorite_from_address,
    create_favorites_bulk,
    create_note,
    delete_favorite,
    delete_note,
    get_portfolio,
    list_favorite_centroids,
    list_favorites,
    list_notes,
    update_note,
    update_notitie,
    update_pipeline,
)
from app.favorites.schemas import (
    FavoriteCentroidResponse,
    FavoriteCreate,
    FavoriteFromAddressCreate,
    FavoriteResponse,
    NotitieUpdateRequest,
    PipelineUpdateRequest,
    PortfolioResponse,
)
from app.middleware.rate_limit import limiter
from app.models.user import User

router = APIRouter(prefix="/api/parcels", tags=["Favorites"])
portfolio_router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])


@router.post(
    "/favorites",
    response_model=FavoriteResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("30/minute")
async def create_favorite_endpoint(
    request: Request,
    body: FavoriteCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FavoriteResponse:
    """Add a parcel to favorites. Idempotent: returns existing with 200 if already present."""
    return await create_favorite(  # type: ignore[return-value]
        parcel_id=body.parcel_id,
        gemeente_code=body.gemeente_code,
        gemeente_naam=body.gemeente_naam,
        wijk_naam=body.wijk_naam,
        address=body.address,
        user_id=current_user.id,
        db=db,
    )


@router.post(
    "/favorites/from-address",
    response_model=FavoriteResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("30/minute")
async def create_favorite_from_address_endpoint(
    request: Request,
    body: FavoriteFromAddressCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FavoriteResponse:
    """Save a parcel to favorites straight from an address (Verkenner chat).

    Resolves the address against ParcelCache (BRK-free) to a stable parcel_code,
    then creates the favorite. Idempotent: returns the existing favorite with 200.
    """
    return await create_favorite_from_address(  # type: ignore[return-value]
        street=body.street,
        huisnummer=body.huisnummer,
        postcode=body.postcode,
        address=body.address,
        user_id=current_user.id,
        db=db,
    )


@router.post(
    "/favorites/bulk",
    response_model=BulkFavoriteResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def create_favorites_bulk_endpoint(
    request: Request,
    body: BulkFavoriteCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> BulkFavoriteResponse:
    """Bulk-add parcels to favorites. Idempotent: skips already-existing favorites."""
    return await create_favorites_bulk(
        parcel_ids=body.parcel_ids,
        gemeente_code=body.gemeente_code,
        gemeente_naam=body.gemeente_naam,
        user_id=current_user.id,
        db=db,
    )


@router.get(
    "/favorites",
    response_model=list[FavoriteResponse],
)
@limiter.limit("30/minute")
async def list_favorites_endpoint(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[FavoriteResponse]:
    """Return all favorites for the current user, enriched with scan scores."""
    return await list_favorites(user_id=current_user.id, db=db)


@router.delete(
    "/favorites/{parcel_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@limiter.limit("30/minute")
async def delete_favorite_endpoint(
    request: Request,
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a parcel from favorites."""
    await delete_favorite(parcel_id=parcel_id, user_id=current_user.id, db=db)


@router.get(
    "/favorites/centroids",
    response_model=list[FavoriteCentroidResponse],
)
@limiter.limit("30/minute")
async def list_favorite_centroids_endpoint(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[FavoriteCentroidResponse]:
    """Return centroid lon/lat for all favorited parcels."""
    return await list_favorite_centroids(user_id=current_user.id, db=db)


@router.patch(
    "/favorites/{parcel_id}/pipeline",
    response_model=FavoriteResponse,
)
@limiter.limit("30/minute")
async def update_pipeline_endpoint(
    request: Request,
    parcel_id: str,
    body: PipelineUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FavoriteResponse:
    """Update the pipeline stage for a favorited parcel."""
    return await update_pipeline(
        parcel_id=parcel_id,
        stage=body.stage,
        afgerond_reden=body.afgerond_reden,
        notitie=body.notitie,
        user_id=current_user.id,
        db=db,
    )


@router.patch(
    "/favorites/{parcel_id}/notitie",
    response_model=FavoriteResponse,
)
@limiter.limit("30/minute")
async def update_notitie_endpoint(
    request: Request,
    parcel_id: str,
    body: NotitieUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FavoriteResponse:
    """Update the free-text note for a favorited parcel."""
    return await update_notitie(
        parcel_id=parcel_id,
        notitie=body.notitie,
        user_id=current_user.id,
        db=db,
    )


# ── Notes CRUD ─────────────────────────────────────────────────────────


@router.get(
    "/favorites/{parcel_id}/notes",
    response_model=list[NoteResponse],
)
@limiter.limit("30/minute")
async def list_notes_endpoint(
    request: Request,
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[NoteResponse]:
    """List all notes for a favorited parcel, newest first."""
    return await list_notes(parcel_id=parcel_id, user_id=current_user.id, db=db)


@router.post(
    "/favorites/{parcel_id}/notes",
    response_model=NoteResponse,
    status_code=201,
)
@limiter.limit("30/minute")
async def create_note_endpoint(
    request: Request,
    parcel_id: str,
    body: NoteCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    """Add a new note to a favorited parcel."""
    return await create_note(
        parcel_id=parcel_id,
        content=body.content,
        user_id=current_user.id,
        db=db,
    )


@router.patch(
    "/favorites/{parcel_id}/notes/{note_id}",
    response_model=NoteResponse,
)
@limiter.limit("30/minute")
async def update_note_endpoint(
    request: Request,
    parcel_id: str,
    note_id: str,
    body: NoteUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    """Update a note's content."""
    return await update_note(
        parcel_id=parcel_id,
        note_id=note_id,
        content=body.content,
        user_id=current_user.id,
        db=db,
    )


@router.delete(
    "/favorites/{parcel_id}/notes/{note_id}",
    status_code=204,
)
@limiter.limit("30/minute")
async def delete_note_endpoint(
    request: Request,
    parcel_id: str,
    note_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a note from a favorited parcel."""
    await delete_note(parcel_id=parcel_id, note_id=note_id, user_id=current_user.id, db=db)


@portfolio_router.get(
    "",
    response_model=PortfolioResponse,
)
@limiter.limit("30/minute")
async def get_portfolio_endpoint(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PortfolioResponse:
    """Return all favorites grouped by gemeente/wijk."""
    return await get_portfolio(user_id=current_user.id, db=db)
