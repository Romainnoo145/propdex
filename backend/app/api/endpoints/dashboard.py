"""M052/S03 — Dashboard (twee-signalen acquisitie-radar) endpoints.

De gemeentesignalen-feed hergebruikt ``GET /api/monitoring/changes``; deze router
levert de overige dashboard-surfaces (pijplijn-counts, off-market kansen, banner,
dismiss).
"""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.parcel_favorite import ParcelFavorite
from app.models.scan_result import ScanResult
from app.models.user import User

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


class PijplijnStageCount(BaseModel):
    stage: str
    count: int


class PijplijnResponse(BaseModel):
    total: int
    stages: list[PijplijnStageCount]


@router.get("/pijplijn", response_model=PijplijnResponse)
@limiter.limit("60/minute")
async def get_pijplijn(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PijplijnResponse:
    """Tel de favorites van de huidige user per pipeline_stage (pijplijn-strip).

    Favorites zijn user-scoped (``user_id``), dus de query lekt per definitie
    geen pijplijn van andere users/organisaties.
    """
    result = await db.execute(
        select(
            ParcelFavorite.pipeline_stage,
            func.count(ParcelFavorite.id),
        )
        .where(ParcelFavorite.user_id == current_user.id)
        .group_by(ParcelFavorite.pipeline_stage)
    )
    stages = [
        PijplijnStageCount(stage=stage, count=count) for stage, count in result.all()
    ]
    total = sum(stage.count for stage in stages)
    return PijplijnResponse(total=total, stages=stages)


class Kans(BaseModel):
    parcel_id: str
    address: str | None
    potentie_score: float | None


class KansenResponse(BaseModel):
    kansen: list[Kans]


@router.get("/kansen", response_model=KansenResponse)
@limiter.limit("60/minute")
async def get_kansen(
    request: Request,
    gemeente: str,
    limit: int = 10,
    min_potentie: float = 60.0,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> KansenResponse:
    """Off-market kansen: top gescoorde percelen in een gemeente, exclusief de
    favorites van de huidige user, gesorteerd op potentie.

    Leest de potentie-score consistent via ``flags["scores"]["potentie"]`` (zelfde
    key als ``list_favorites`` / tiles), en neemt per perceel de meest recente scan.
    """
    potentie = ScanResult.flags["scores"]["potentie"].as_float()

    ranked = (
        select(
            ScanResult.parcel_id.label("pc_id"),
            potentie.label("potentie"),
            func.row_number()
            .over(
                partition_by=ScanResult.parcel_id,
                order_by=AreaScan.created_at.desc(),
            )
            .label("rn"),
        )
        .join(AreaScan, AreaScan.id == ScanResult.scan_id)
        .where(AreaScan.gemeente_naam == gemeente)
        .subquery()
    )

    favorite_ids = select(ParcelFavorite.parcel_id).where(
        ParcelFavorite.user_id == current_user.id
    )

    result = await db.execute(
        select(ParcelCache.parcel_id, ParcelCache.address, ranked.c.potentie)
        .join(ranked, ranked.c.pc_id == ParcelCache.id)
        .where(
            ranked.c.rn == 1,
            ranked.c.potentie.isnot(None),
            ranked.c.potentie >= min_potentie,
            ParcelCache.parcel_id.notin_(favorite_ids),
        )
        .order_by(ranked.c.potentie.desc())
        .limit(limit)
    )

    kansen = [
        Kans(
            parcel_id=parcel_id,
            address=address,
            potentie_score=round(potentie_score, 1) if potentie_score is not None else None,
        )
        for parcel_id, address, potentie_score in result.all()
    ]
    return KansenResponse(kansen=kansen)
