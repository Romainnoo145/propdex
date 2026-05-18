"""brk_router — M050/S02 BRK persist endpoint.

Exposes ``POST /api/parcels/{parcel_id}/brk/persist`` — the persist-channel
write path for Kadaster BRK eigendomsdata. Distinct from the Phase 105
ephemeral path (``BRKOwnership`` schema): this endpoint returns the
persistent ``BRKOwnershipRecordRead`` shape only (D9 hard boundary).

D12 router-layer error mapping (full failure registry from ENG-PLAN):
- ``ParcelNotFound``            → 404
- ``CrossOrgParcelAccess``      → 403
- ``FeatureDisabled``           → 503 (M050_BRK_PERSIST_ENABLED False / DPA pending)
- ``CredentialNotConfigured``   → 503
- ``ValidationError``           → 422
- ``GovernmentAPIError``        → 502 (Kadaster upstream code masked)
- unauthenticated               → 401 (handled by ``get_current_user``)

The service layer (``brk_fetch_service``) raises typed Python exceptions
only; HTTP mapping lives here per D12 service-no-fastapi rule.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.database import get_db
from app.government_apis.base import GovernmentAPIError
from app.models.user import User
from app.schemas.brk_ownership_record import BRKOwnershipRecordRead
from app.services.brk_fetch_service import (
    CrossOrgParcelAccess,
    ParcelNotFound,
    fetch_and_persist,
)
from app.services.brk_persistence_service import (
    FeatureDisabled,
    ValidationError,
)
from app.services.credential_resolver import CredentialNotConfigured

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/parcels", tags=["brk"])


@router.post(
    "/{parcel_id}/brk/persist",
    response_model=list[BRKOwnershipRecordRead],
    status_code=status.HTTP_200_OK,
    summary="Fetch + persist BRK eigendomsdata for a parcel (M050/S02)",
    description=(
        "Persist channel for BRK eigendom (Kadaster). Returns rechtspersoon + "
        "overheid rows only — natuurlijk_persoon NEVER persists (AVG defense: "
        "DB CHECK + service strip + parser skip = 3 layers). 30-day cache; "
        "advisory-lock dedup per (org, parcel); M050_BRK_PERSIST_ENABLED gates "
        "the write path (503 until DPA signed). Phase 105 ephemeral endpoint "
        "uses a different schema — this endpoint returns BRKOwnershipRecordRead."
    ),
)
async def persist_brk_for_parcel(
    parcel_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BRKOwnershipRecordRead]:
    """D9 return shape; D12 typed-exception → HTTP status mapping."""
    try:
        return await fetch_and_persist(
            db=db,
            organization_id=current_user.organization_id,
            parcel_id=parcel_id,
        )
    except ParcelNotFound as exc:
        raise HTTPException(
            status_code=404, detail=str(exc) or "perceel niet gevonden"
        ) from exc
    except CrossOrgParcelAccess as exc:
        raise HTTPException(
            status_code=403, detail="cross-org parcel access denied"
        ) from exc
    except FeatureDisabled as exc:
        # D4 runtime gate; default False until Kadaster DPA signed
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except CredentialNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except GovernmentAPIError as exc:
        # D12 — mask upstream Kadaster code; full code logged by the client at WARN
        logger.warning(
            "brk.fetch.upstream_error parcel=%s err=%s", parcel_id, exc
        )
        raise HTTPException(
            status_code=502, detail="upstream BRK error"
        ) from exc
