"""CRUD router voor per-parcel projecttype (M047/S01).

Endpoints:
- GET /api/parcels/{parcel_id}/project-type  → huidige assignment of default
- PUT /api/parcels/{parcel_id}/project-type  → upsert assignment

Org-scoped via get_current_active_user. parcel_id is een opaque BAG/Kadaster
string (geen server-side existence-check in S01 — toekomstige scan-integratie
kan die guard toevoegen zonder contract-breuk).
"""

import logging

from arq.connections import ArqRedis
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.endpoints.parcel_project_type_schemas import (
    ProjectTypeResponse,
    ProjectTypeUpdateRequest,
)
from app.auth.dependencies import get_current_active_user
from app.core.arq import get_arq_pool
from app.core.database import get_db
from app.jobs.rescore_cascade_job import enqueue_rescore_parcel
from app.models.user import User
from app.services import parcel_project_type_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/parcels", tags=["ParcelProjectType"])


@router.get(
    "/{parcel_id}/project-type",
    response_model=ProjectTypeResponse,
)
async def get_parcel_project_type(
    parcel_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectTypeResponse:
    """Haal projecttype op voor parcel binnen huidige organization.

    Returns default ('onbepaald') met `set_at=None` wanneer geen expliciete
    assignment bestaat. Dit is géén 404 — de UI (S02) kan dit tonen als
    "niet gekozen; klik om projecttype te zetten".
    """
    return await parcel_project_type_service.get_project_type(
        db,
        parcel_id=parcel_id,
        organization_id=current_user.organization_id,
    )


@router.put(
    "/{parcel_id}/project-type",
    response_model=ProjectTypeResponse,
)
async def update_parcel_project_type(
    parcel_id: str,
    body: ProjectTypeUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    arq_pool: ArqRedis = Depends(get_arq_pool),
) -> ProjectTypeResponse:
    """Upsert projecttype voor parcel binnen huidige organization.

    Body.project_type wordt Pydantic-gevalideerd tegen ProjectType Literal —
    onbekende waardes → 422 zonder DB-call. Bestaande assignment wordt
    atomisch overschreven via unique constraint op (organization_id, parcel_id).

    M052/S01 FUND-02: na upsert wordt rescore_parcel best-effort enqueued
    zodat het headline-score direct de nieuwe project_type weights reflecteert.
    Mislukte enqueue logt een warning maar blokkeert de 200 respons nooit.
    """
    result = await parcel_project_type_service.upsert_project_type(
        db,
        parcel_id=parcel_id,
        organization_id=current_user.organization_id,
        project_type=body.project_type,
        user_id=current_user.id,
    )
    try:
        await enqueue_rescore_parcel(
            arq_pool=arq_pool,
            organization_id=current_user.organization_id,
            parcel_id=parcel_id,
        )
    except Exception as exc:
        logger.warning(
            "M052/S01 enqueue_rescore_parcel failed (non-blocking) parcel=%s org=%s err=%s",
            parcel_id,
            current_user.organization_id,
            exc,
        )
    return result
