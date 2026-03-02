"""Professional directory API endpoints."""

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.expression import text

from app.auth.dependencies import get_current_active_user
from app.core.config import settings
from app.core.database import get_db
from app.middleware.rate_limit import limiter
from app.models.professional import Professional
from app.schemas.professional import (
    ProfessionalCreate,
    ProfessionalListResponse,
    ProfessionalResponse,
    ProfessionalUpdate,
)

router = APIRouter(prefix="/api/professionals", tags=["professionals"])


def require_admin_key(x_admin_key: str = Header(alias="X-Admin-Key")) -> None:
    """
    Verify the X-Admin-Key header matches the configured ADMIN_API_KEY.

    When ADMIN_API_KEY is empty string, ALL admin requests are rejected (disabled mode).
    This prevents accidental open admin access in development.
    """
    if not settings.ADMIN_API_KEY or x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


@router.get("", response_model=ProfessionalListResponse)
@limiter.limit("30/minute")
async def list_professionals(
    request: Request,
    gemeente: str | None = None,
    gevolgklasse: str | None = None,
    _current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalListResponse:
    """
    List professionals filtered by gemeente and/or gevolgklasse.

    Requires authentication. Returns only active professionals ordered by naam.
    """
    query = select(Professional).where(Professional.is_active == True)  # noqa: E712

    if gemeente:
        query = query.where(
            text("(:gemeente) = ANY(werkgebied)").bindparams(gemeente=gemeente)
        )

    if gevolgklasse:
        query = query.where(
            text("gevolgklassen @> ARRAY[:gk]::varchar[]").bindparams(gk=gevolgklasse)
        )

    query = query.order_by(Professional.naam)

    result = await db.execute(query)
    professionals = list(result.scalars().all())

    return ProfessionalListResponse(
        professionals=[ProfessionalResponse.model_validate(p) for p in professionals],
        total=len(professionals),
        gemeente_filter=gemeente,
        gevolgklasse_filter=gevolgklasse,
    )


@router.post("", response_model=ProfessionalResponse, status_code=201)
@limiter.limit("10/minute")
async def create_professional(
    request: Request,
    data: ProfessionalCreate,
    _admin=Depends(require_admin_key),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalResponse:
    """
    Create a new professional directory entry.

    Requires X-Admin-Key header matching the configured ADMIN_API_KEY.
    """
    professional = Professional(**data.model_dump())
    db.add(professional)
    await db.flush()
    await db.commit()
    await db.refresh(professional)
    return ProfessionalResponse.model_validate(professional)


@router.put("/{professional_id}", response_model=ProfessionalResponse)
@limiter.limit("10/minute")
async def update_professional(
    request: Request,
    professional_id: uuid.UUID,
    data: ProfessionalUpdate,
    _admin=Depends(require_admin_key),
    db: AsyncSession = Depends(get_db),
) -> ProfessionalResponse:
    """
    Partially update an existing professional directory entry.

    Requires X-Admin-Key header matching the configured ADMIN_API_KEY.
    Only fields provided in the request body are updated.
    """
    result = await db.execute(
        select(Professional).where(Professional.id == professional_id)
    )
    professional = result.scalar_one_or_none()

    if professional is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Professional not found",
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(professional, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(professional)
    return ProfessionalResponse.model_validate(professional)


@router.delete("/{professional_id}", status_code=204)
@limiter.limit("10/minute")
async def deactivate_professional(
    request: Request,
    professional_id: uuid.UUID,
    _admin=Depends(require_admin_key),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Soft-delete a professional by setting is_active=False.

    Requires X-Admin-Key header matching the configured ADMIN_API_KEY.
    The record is retained in the database but excluded from GET list results.
    """
    result = await db.execute(
        select(Professional).where(Professional.id == professional_id)
    )
    professional = result.scalar_one_or_none()

    if professional is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Professional not found",
        )

    professional.is_active = False
    await db.flush()
    await db.commit()
