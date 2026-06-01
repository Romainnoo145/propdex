"""M052/S03 — Dashboard (twee-signalen acquisitie-radar) endpoints.

De gemeentesignalen-feed hergebruikt ``GET /api/monitoring/changes``; deze router
levert de overige dashboard-surfaces (pijplijn-counts, off-market kansen, banner,
dismiss).
"""

import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    get_current_active_user,
    get_current_organization_id,
)
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.area_scan import AreaScan
from app.models.change_record import ChangeRecord
from app.models.dismissed_kans import DismissedKans
from app.models.parcel_cache import ParcelCache
from app.models.parcel_favorite import ParcelFavorite
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.models.user import User
from app.schemas.common import StatusResponse

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
    wijk: str | None
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
            AreaScan.wijk_naam.label("wijk"),
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
    dismissed_ids = select(DismissedKans.parcel_id).where(
        DismissedKans.user_id == current_user.id
    )

    result = await db.execute(
        select(
            ParcelCache.parcel_id,
            ParcelCache.address,
            ranked.c.wijk,
            ranked.c.potentie,
        )
        .join(ranked, ranked.c.pc_id == ParcelCache.id)
        .where(
            ranked.c.rn == 1,
            ranked.c.potentie.isnot(None),
            ranked.c.potentie >= min_potentie,
            ParcelCache.parcel_id.notin_(favorite_ids),
            ParcelCache.parcel_id.notin_(dismissed_ids),
        )
        .order_by(ranked.c.potentie.desc())
        .limit(limit)
    )

    kansen = [
        Kans(
            parcel_id=parcel_id,
            address=address,
            wijk=wijk,
            potentie_score=round(potentie_score, 1) if potentie_score is not None else None,
        )
        for parcel_id, address, wijk, potentie_score in result.all()
    ]
    return KansenResponse(kansen=kansen)


class BannerItem(BaseModel):
    id: str
    title: str
    change_type: str
    change_date: str
    gemeente_naam: str
    source_url: str | None


class BannerResponse(BaseModel):
    banner: BannerItem | None


@router.get("/banner", response_model=BannerResponse)
@limiter.limit("60/minute")
async def get_banner(
    request: Request,
    gemeente: str,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
) -> BannerResponse:
    """Conditionele beleid-banner: de recentste plan-/beleidswijziging (``zoning``)
    in de gemeente voor deze organisatie, of ``null`` (meeste dagen geen banner).

    Org-scoped via ``Project.organization_id`` (ChangeRecord hangt aan een Project).
    """
    result = await db.execute(
        select(ChangeRecord)
        .join(Project, Project.id == ChangeRecord.project_id)
        .where(
            Project.organization_id == organization_id,
            ChangeRecord.gemeente_naam == gemeente,
            ChangeRecord.change_type == "zoning",
        )
        .order_by(ChangeRecord.change_date.desc())
        .limit(1)
    )
    change = result.scalar_one_or_none()
    if change is None:
        return BannerResponse(banner=None)

    return BannerResponse(
        banner=BannerItem(
            id=str(change.id),
            title=change.title,
            change_type=change.change_type,
            change_date=change.change_date.isoformat(),
            gemeente_naam=change.gemeente_naam,
            source_url=change.source_url,
        )
    )


@router.post("/kansen/{parcel_id}/dismiss", response_model=StatusResponse)
@limiter.limit("60/minute")
async def dismiss_kans(
    request: Request,
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Verberg een off-market kans voor de huidige user (persistent, user-scoped).

    Idempotent: nogmaals verbergen is een no-op. De ``kansen``-query sluit
    verborgen percelen uit.
    """
    existing = await db.execute(
        select(DismissedKans).where(
            DismissedKans.user_id == current_user.id,
            DismissedKans.parcel_id == parcel_id,
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(DismissedKans(user_id=current_user.id, parcel_id=parcel_id))
        await db.commit()
    return {"status": "ok"}


class PipelineParcelsResponse(BaseModel):
    parcel_cache_ids: list[str]


@router.get("/pipeline-parcels", response_model=PipelineParcelsResponse)
@limiter.limit("60/minute")
async def get_pipeline_parcels(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PipelineParcelsResponse:
    """De ``parcel_cache_id``'s van de favorites van de huidige user.

    De frontend gebruikt deze om gemeentesignalen amber te markeren ("In je
    pijplijn") wanneer een bekendmaking een eigen perceel raakt. User-scoped.
    """
    result = await db.execute(
        select(ParcelFavorite.parcel_cache_id).where(
            ParcelFavorite.user_id == current_user.id,
            ParcelFavorite.parcel_cache_id.isnot(None),
        )
    )
    return PipelineParcelsResponse(
        parcel_cache_ids=[str(pc_id) for pc_id in result.scalars().all()]
    )
