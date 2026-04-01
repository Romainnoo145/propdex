"""Checklist progress API — persist per-parcel checklist checkbox state."""

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_active_user
from app.core.database import get_db
from app.models.checklist_progress import ChecklistProgress
from app.models.user import User
from app.services.checklists import CHECKLISTS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/checklist-progress", tags=["ChecklistProgress"])

VALID_USE_CASES = set(CHECKLISTS.keys())


class ChecklistProgressResponse(BaseModel):
    checked_items: list[str]
    uploaded_documents: dict[str, str] = {}


class ChecklistProgressUpdate(BaseModel):
    checked_items: list[str]
    uploaded_documents: dict[str, str] = {}


@router.get("/{parcel_id}/{use_case}", response_model=ChecklistProgressResponse)
async def get_checklist_progress(
    parcel_id: str,
    use_case: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ChecklistProgressResponse:
    """Get checked items for a parcel/use_case combo."""
    if use_case not in VALID_USE_CASES:
        return ChecklistProgressResponse(checked_items=[])

    result = await db.execute(
        select(ChecklistProgress.checked_items, ChecklistProgress.uploaded_documents).where(
            ChecklistProgress.user_id == current_user.id,
            ChecklistProgress.parcel_id == parcel_id,
            ChecklistProgress.use_case == use_case,
        )
    )
    row = result.one_or_none()
    if row is None:
        return ChecklistProgressResponse(checked_items=[], uploaded_documents={})
    return ChecklistProgressResponse(
        checked_items=row[0] if row[0] is not None else [],
        uploaded_documents=row[1] if row[1] is not None else {},
    )


@router.put("/{parcel_id}/{use_case}", response_model=ChecklistProgressResponse)
async def update_checklist_progress(
    parcel_id: str,
    use_case: str,
    body: ChecklistProgressUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ChecklistProgressResponse:
    """Upsert checked items for a parcel/use_case combo."""
    if use_case not in VALID_USE_CASES:
        return ChecklistProgressResponse(checked_items=[])

    stmt = pg_insert(ChecklistProgress).values(
        user_id=current_user.id,
        parcel_id=parcel_id,
        use_case=use_case,
        checked_items=body.checked_items,
        uploaded_documents=body.uploaded_documents,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_checklist_progress_user_parcel_usecase",
        set_={
            "checked_items": body.checked_items,
            "uploaded_documents": body.uploaded_documents,
        },
    )
    await db.execute(stmt)
    await db.commit()

    logger.info(
        "Checklist progress saved: user=%s parcel=%s use_case=%s items=%d",
        current_user.id,
        parcel_id,
        use_case,
        len(body.checked_items),
    )
    return ChecklistProgressResponse(checked_items=body.checked_items)
