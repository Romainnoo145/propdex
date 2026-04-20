"""Service-laag voor per-parcel projecttype assignments (M047/S01).

Alle queries filteren expliciet op organization_id (multi-tenant guard).
Upsert-pattern via pg_insert.on_conflict_do_update — atomisch, geen race
tussen SELECT + INSERT/UPDATE onder concurrent requests.
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.endpoints.parcel_project_type_schemas import (
    DEFAULT_PROJECT_TYPE,
    ProjectTypeResponse,
)
from app.models.parcel_project_type import ParcelProjectType


async def get_project_type(
    db: AsyncSession,
    *,
    parcel_id: str,
    organization_id: uuid.UUID,
) -> ProjectTypeResponse:
    """Get projecttype voor (org, parcel).

    Return default ('onbepaald') wanneer geen record bestaat — dit is géén
    404, het is de meaningful default die score-engine interpreteert als
    'no conditional shift'.
    """
    stmt = select(ParcelProjectType).where(
        ParcelProjectType.organization_id == organization_id,
        ParcelProjectType.parcel_id == parcel_id,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()

    if row is None:
        return ProjectTypeResponse(
            parcel_id=parcel_id,
            project_type=DEFAULT_PROJECT_TYPE,
            set_at=None,
            set_by_user_id=None,
        )

    return ProjectTypeResponse.model_validate(row)


async def upsert_project_type(
    db: AsyncSession,
    *,
    parcel_id: str,
    organization_id: uuid.UUID,
    project_type: str,
    user_id: uuid.UUID,
) -> ProjectTypeResponse:
    """Upsert (org, parcel) → project_type.

    Unique constraint op (organization_id, parcel_id) garandeert 1 rij;
    pg_insert.on_conflict maakt upsert atomisch.

    Bewust `set_at=datetime.utcnow()` expliciet bij update — SQLAlchemy
    onupdate=CURRENT_TIMESTAMP werkt alleen bij ORM-flow (.flush/.commit op
    gewijzigd object), niet bij raw pg_insert. Naive UTC per CLAUDE.md
    (TIMESTAMP WITHOUT TIME ZONE).
    """
    now = datetime.utcnow()
    insert_stmt = pg_insert(ParcelProjectType).values(
        organization_id=organization_id,
        parcel_id=parcel_id,
        project_type=project_type,
        set_at=now,
        set_by_user_id=user_id,
    )
    upsert_stmt = insert_stmt.on_conflict_do_update(
        constraint="uq_parcel_project_types_org_parcel",
        set_={
            "project_type": insert_stmt.excluded.project_type,
            "set_at": insert_stmt.excluded.set_at,
            "set_by_user_id": insert_stmt.excluded.set_by_user_id,
        },
    ).returning(
        ParcelProjectType.parcel_id,
        ParcelProjectType.project_type,
        ParcelProjectType.set_at,
        ParcelProjectType.set_by_user_id,
    )
    result = await db.execute(upsert_stmt)
    row = result.one()
    await db.commit()

    return ProjectTypeResponse(
        parcel_id=row.parcel_id,
        project_type=row.project_type,
        set_at=row.set_at,
        set_by_user_id=row.set_by_user_id,
    )
