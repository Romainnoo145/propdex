"""CRUD endpoints for parcel favorites and portfolio grouped view."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.favorites.schemas import (
    FavoriteCentroidResponse,
    FavoriteCreate,
    FavoriteResponse,
    PipelineUpdateRequest,
    PortfolioGemeenteGroup,
    PortfolioResponse,
    PortfolioWijkGroup,
)
from app.models.area_scan import AreaScan
from app.middleware.rate_limit import limiter
from app.models.parcel_favorite import ParcelFavorite
from app.models.parcel_cache import ParcelCache
from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/parcels", tags=["Favorites"])
portfolio_router = APIRouter(prefix="/api/portfolio", tags=["Portfolio"])


def _normalize_gemeente_code(value: str | None) -> str | None:
    if not value:
        return None

    code = value.strip().upper()
    if not code:
        return None
    if code.startswith("GM") and len(code) == 6 and code[2:].isdigit():
        return code
    if len(code) == 4 and code.isdigit():
        return f"GM{code}"
    return code


async def _resolve_favorite_context(
    db: AsyncSession,
    parcel_id: str,
) -> dict[str, str | uuid.UUID | None]:
    result = await db.execute(
        select(
            ParcelCache.id.label("parcel_cache_id"),
            ParcelCache.address,
            ParcelCache.gemeente_code,
            AreaScan.gemeente_naam,
            AreaScan.wijk_naam,
        )
        .select_from(ParcelCache)
        .outerjoin(ScanResult, ScanResult.parcel_id == ParcelCache.id)
        .outerjoin(AreaScan, AreaScan.id == ScanResult.scan_id)
        .where(
            or_(
                ParcelCache.parcel_id == parcel_id,
                ParcelCache.parcel_code == parcel_id,
            ),
        )
        .order_by(AreaScan.created_at.desc().nullslast())
        .limit(1)
    )
    row = result.mappings().first()

    if row is None:
        return {
            "parcel_cache_id": None,
            "address": None,
            "gemeente_code": None,
            "gemeente_naam": None,
            "wijk_naam": None,
        }

    return {
        "parcel_cache_id": row["parcel_cache_id"],
        "address": row["address"],
        "gemeente_code": _normalize_gemeente_code(row["gemeente_code"]),
        "gemeente_naam": row["gemeente_naam"],
        "wijk_naam": row["wijk_naam"],
    }


async def _get_favorite_or_404(
    db: AsyncSession,
    user_id: uuid.UUID,
    parcel_id: str,
) -> ParcelFavorite:
    """Fetch favorite by (user, parcel) or raise 404."""
    result = await db.execute(
        select(ParcelFavorite).where(
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
    db: AsyncSession = Depends(get_db),
) -> FavoriteResponse:
    """
    Add a parcel to favorites. Idempotent: returns existing favorite with 200 if already present.
    Creates a new favorite with pipeline_stage='Gesignaleerd' and returns 201.
    """
    normalized_gemeente_code = _normalize_gemeente_code(body.gemeente_code)
    resolved = await _resolve_favorite_context(db, body.parcel_id)

    # Idempotency check
    result = await db.execute(
        select(ParcelFavorite).where(
            ParcelFavorite.user_id == current_user.id,
            ParcelFavorite.parcel_id == body.parcel_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        updated = False
        if existing.parcel_cache_id is None and resolved["parcel_cache_id"] is not None:
            existing.parcel_cache_id = resolved["parcel_cache_id"]  # type: ignore[assignment]
            updated = True
        if existing.gemeente_code is None and normalized_gemeente_code is not None:
            existing.gemeente_code = normalized_gemeente_code
            updated = True
        elif existing.gemeente_code is None and resolved["gemeente_code"] is not None:
            existing.gemeente_code = resolved["gemeente_code"]  # type: ignore[assignment]
            updated = True
        if existing.gemeente_naam is None and body.gemeente_naam:
            existing.gemeente_naam = body.gemeente_naam
            updated = True
        elif existing.gemeente_naam is None and resolved["gemeente_naam"] is not None:
            existing.gemeente_naam = resolved["gemeente_naam"]  # type: ignore[assignment]
            updated = True
        if existing.wijk_naam is None and body.wijk_naam:
            existing.wijk_naam = body.wijk_naam
            updated = True
        elif existing.wijk_naam is None and resolved["wijk_naam"] is not None:
            existing.wijk_naam = resolved["wijk_naam"]  # type: ignore[assignment]
            updated = True
        if existing.address is None and body.address:
            existing.address = body.address
            updated = True
        elif existing.address is None and resolved["address"] is not None:
            existing.address = resolved["address"]  # type: ignore[assignment]
            updated = True

        if updated:
            await db.commit()
            await db.refresh(existing)

        # Return existing with 200 — caller must handle status code branching
        from fastapi.responses import JSONResponse

        return JSONResponse(  # type: ignore[return-value]
            status_code=status.HTTP_200_OK,
            content=FavoriteResponse.model_validate(existing).model_dump(mode="json"),
        )

    # Enrich from parcel_cache + scan_results if frontend didn't provide names
    fav = ParcelFavorite(
        parcel_id=body.parcel_id,
        parcel_cache_id=resolved["parcel_cache_id"],  # type: ignore[arg-type]
        user_id=current_user.id,
        gemeente_code=normalized_gemeente_code or resolved["gemeente_code"],  # type: ignore[arg-type]
        gemeente_naam=body.gemeente_naam or resolved["gemeente_naam"],  # type: ignore[arg-type]
        wijk_naam=body.wijk_naam or resolved["wijk_naam"],  # type: ignore[arg-type]
        address=body.address or resolved["address"],  # type: ignore[arg-type]
        pipeline_stage="Gesignaleerd",
    )
    db.add(fav)
    await db.commit()
    await db.refresh(fav)

    logger.info(
        "Favorite created: parcel=%s user=%s",
        fav.parcel_id,
        current_user.id,
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
    db: AsyncSession = Depends(get_db),
) -> list[FavoriteResponse]:
    """Return all favorites for the current user, enriched with scan scores."""
    # Subquery: latest scan scores per parcel_cache_id
    scores_sq = (
        select(
            ScanResult.parcel_id.label("parcel_id"),
            ScanResult.flags["scores"]["potentie"].as_float().label("potentie_score"),
            ScanResult.flags["scores"]["risico"].as_float().label("risico_score"),
        )
        .join(AreaScan, AreaScan.id == ScanResult.scan_id)
        .where(AreaScan.status == "completed")
        .distinct(ScanResult.parcel_id)
        .order_by(ScanResult.parcel_id, ScanResult.created_at.desc())
        .subquery()
    )

    # Subquery: latest report per source_parcel_id
    report_sq = (
        select(
            SavedReport.source_parcel_id.label("parcel_id"),
            SavedReport.id.label("report_id"),
        )
        .where(
            SavedReport.user_id == current_user.id,
            SavedReport.deleted_at.is_(None),
            SavedReport.source_parcel_id.isnot(None),
        )
        .distinct(SavedReport.source_parcel_id)
        .order_by(SavedReport.source_parcel_id, SavedReport.created_at.desc())
        .subquery()
    )

    result = await db.execute(
        select(
            ParcelFavorite,
            scores_sq.c.potentie_score,
            scores_sq.c.risico_score,
            report_sq.c.report_id,
        )
        .outerjoin(scores_sq, scores_sq.c.parcel_id == ParcelFavorite.parcel_cache_id)
        .outerjoin(report_sq, report_sq.c.parcel_id == ParcelFavorite.parcel_cache_id)
        .where(ParcelFavorite.user_id == current_user.id)
        .order_by(ParcelFavorite.created_at.desc())
    )
    responses: list[FavoriteResponse] = []
    for row in result.all():
        fav = row[0]
        resp = FavoriteResponse.model_validate(fav)
        resp.potentie_score = round(row[1], 1) if row[1] is not None else None
        resp.risico_score = round(row[2], 1) if row[2] is not None else None
        resp.has_report = row[3] is not None
        resp.report_id = row[3]
        responses.append(resp)
    return responses


@router.delete(
    "/favorites/{parcel_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
@limiter.limit("30/minute")
async def delete_favorite(
    request: Request,
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a parcel from favorites. Returns 204 No Content."""
    fav = await _get_favorite_or_404(db, current_user.id, parcel_id)
    await db.delete(fav)
    await db.commit()

    logger.info(
        "Favorite deleted: parcel=%s user=%s",
        parcel_id,
        current_user.id,
    )


@router.get(
    "/favorites/centroids",
    response_model=list[FavoriteCentroidResponse],
)
@limiter.limit("30/minute")
async def list_favorite_centroids(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list[FavoriteCentroidResponse]:
    """Return centroid lon/lat for all favorited parcels for the current user."""
    result = await db.execute(
        text(
            """
            SELECT
                pf.parcel_id AS parcel_code,
                ST_X(ST_Transform(ST_Centroid(pc.geometry), 4326)) AS lon,
                ST_Y(ST_Transform(ST_Centroid(pc.geometry), 4326)) AS lat
            FROM parcel_favorites pf
            JOIN parcel_cache pc
              ON pc.parcel_id = pf.parcel_id
            WHERE pf.user_id = :user_id
            """
        ),
        {"user_id": str(current_user.id)},
    )
    return [
        FavoriteCentroidResponse(
            parcel_code=row._mapping["parcel_code"],
            lon=float(row._mapping["lon"]),
            lat=float(row._mapping["lat"]),
        )
        for row in result
    ]


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
    db: AsyncSession = Depends(get_db),
) -> FavoriteResponse:
    """
    Update the pipeline stage for a favorited parcel.
    Pydantic Literal validation on PipelineUpdateRequest.stage auto-returns 422 for invalid values.
    """
    fav = await _get_favorite_or_404(db, current_user.id, parcel_id)

    fav.pipeline_stage = body.stage
    if body.stage == "Afgerond":
        fav.afgerond_reden = body.afgerond_reden
        if body.notitie is not None:
            fav.notitie = body.notitie
    else:
        fav.afgerond_reden = None
        # Don't wipe notitie on stage change — it's user-owned content

    await db.commit()
    await db.refresh(fav)

    logger.info(
        "Pipeline updated: parcel=%s stage=%s user=%s",
        parcel_id,
        body.stage,
        current_user.id,
    )

    return FavoriteResponse.model_validate(fav)


class NotitieUpdateRequest(BaseModel):
    notitie: str | None = None


@router.patch(
    "/favorites/{parcel_id}/notitie",
    response_model=FavoriteResponse,
)
@limiter.limit("30/minute")
async def update_notitie(
    request: Request,
    parcel_id: str,
    body: NotitieUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FavoriteResponse:
    """Update the free-text note for a favorited parcel (any pipeline stage)."""
    fav = await _get_favorite_or_404(db, current_user.id, parcel_id)
    fav.notitie = body.notitie
    await db.commit()
    await db.refresh(fav)
    return FavoriteResponse.model_validate(fav)


@portfolio_router.get(
    "",
    response_model=PortfolioResponse,
)
@limiter.limit("30/minute")
async def get_portfolio(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PortfolioResponse:
    """
    Return all favorites grouped by gemeente/wijk for the current user.
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
            .where(ParcelFavorite.user_id == current_user.id)
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
