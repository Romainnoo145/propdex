"""Favorites and portfolio service layer."""

import logging
import uuid
from datetime import datetime

from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.chat_schemas import BulkFavoriteResponse
from app.favorites.schemas import (
    FavoriteCentroidResponse,
    FavoriteResponse,
    PortfolioGemeenteGroup,
    PortfolioResponse,
    PortfolioWijkGroup,
)
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.parcel_favorite import ParcelFavorite
from app.models.parcel_project_type import ParcelProjectType
from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.models.user import User
from app.services.brk_persistence_service import soft_delete_for_org_parcel

logger = logging.getLogger(__name__)


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
    """Fetch favorite by (user, parcel).

    Accepts either the ParcelFavorite.parcel_id string **or** the
    ParcelCache UUID (source_parcel_id from reports).  When a UUID is
    supplied, it is resolved to the parcel_id string via parcel_cache
    so that both the workspace and report views can use the same route.
    """
    # Direct lookup first (parcel code string — workspace path)
    result = await db.execute(
        select(ParcelFavorite).where(
            ParcelFavorite.user_id == user_id,
            ParcelFavorite.parcel_id == parcel_id,
        )
    )
    fav = result.scalar_one_or_none()
    if fav:
        return fav

    # Fallback: treat parcel_id as a ParcelCache UUID and resolve
    try:
        cache_uuid = uuid.UUID(parcel_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")

    cache_result = await db.execute(
        select(ParcelCache.parcel_id).where(ParcelCache.id == cache_uuid)
    )
    resolved_code = cache_result.scalar_one_or_none()
    if not resolved_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")

    result = await db.execute(
        select(ParcelFavorite).where(
            ParcelFavorite.user_id == user_id,
            ParcelFavorite.parcel_id == resolved_code,
        )
    )
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")
    return fav


# ── Pydantic models for notes ───────────────────────────────────


class NoteCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class NoteUpdateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class NoteResponse(BaseModel):
    id: str
    content: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_note(cls, note) -> "NoteResponse":
        return cls(
            id=str(note.id),
            content=note.content,
            created_at=note.created_at.isoformat(),
            updated_at=note.updated_at.isoformat(),
        )


# ── Favorites CRUD ──────────────────────────────────────────────


async def create_favorite(
    parcel_id: str,
    gemeente_code: str | None,
    gemeente_naam: str | None,
    wijk_naam: str | None,
    address: str | None,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> FavoriteResponse | JSONResponse:
    """Add a parcel to favorites. Idempotent: returns existing favorite with 200 if already present."""
    normalized_gemeente_code = _normalize_gemeente_code(gemeente_code)
    resolved = await _resolve_favorite_context(db, parcel_id)

    # Idempotency check
    result = await db.execute(
        select(ParcelFavorite).where(
            ParcelFavorite.user_id == user_id,
            ParcelFavorite.parcel_id == parcel_id,
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
        if existing.gemeente_naam is None and gemeente_naam:
            existing.gemeente_naam = gemeente_naam
            updated = True
        elif existing.gemeente_naam is None and resolved["gemeente_naam"] is not None:
            existing.gemeente_naam = resolved["gemeente_naam"]  # type: ignore[assignment]
            updated = True
        if existing.wijk_naam is None and wijk_naam:
            existing.wijk_naam = wijk_naam
            updated = True
        elif existing.wijk_naam is None and resolved["wijk_naam"] is not None:
            existing.wijk_naam = resolved["wijk_naam"]  # type: ignore[assignment]
            updated = True
        if existing.address is None and address:
            existing.address = address
            updated = True
        elif existing.address is None and resolved["address"] is not None:
            existing.address = resolved["address"]  # type: ignore[assignment]
            updated = True

        if updated:
            await db.commit()
            await db.refresh(existing)

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=FavoriteResponse.model_validate(existing).model_dump(mode="json"),
        )

    fav = ParcelFavorite(
        parcel_id=parcel_id,
        parcel_cache_id=resolved["parcel_cache_id"],  # type: ignore[arg-type]
        user_id=user_id,
        gemeente_code=normalized_gemeente_code or resolved["gemeente_code"],  # type: ignore[arg-type]
        gemeente_naam=gemeente_naam or resolved["gemeente_naam"],  # type: ignore[arg-type]
        wijk_naam=wijk_naam or resolved["wijk_naam"],  # type: ignore[arg-type]
        address=address or resolved["address"],  # type: ignore[arg-type]
        pipeline_stage="Gesignaleerd",
    )
    db.add(fav)
    await db.commit()
    await db.refresh(fav)

    logger.info("Favorite created: parcel=%s user=%s", fav.parcel_id, user_id)

    return FavoriteResponse.model_validate(fav)


async def create_favorites_bulk(
    parcel_ids: list[str],
    gemeente_code: str | None,
    gemeente_naam: str | None,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> BulkFavoriteResponse:
    """Bulk-add parcels to favorites. Idempotent: skips existing."""
    created = 0
    existing_count = 0
    failed = 0

    unique_ids = list(dict.fromkeys(parcel_ids))

    existing_result = await db.execute(
        select(ParcelFavorite.parcel_id).where(
            ParcelFavorite.user_id == user_id,
            ParcelFavorite.parcel_id.in_(unique_ids),
        )
    )
    existing_set = set(existing_result.scalars().all())
    existing_count = len(existing_set)

    new_ids = [pid for pid in unique_ids if pid not in existing_set]
    cache_lookup: dict[str, uuid.UUID | None] = {}
    if new_ids:
        cache_result = await db.execute(
            select(ParcelCache.parcel_id, ParcelCache.id).where(
                or_(
                    ParcelCache.parcel_id.in_(new_ids),
                    ParcelCache.parcel_code.in_(new_ids),
                )
            )
        )
        for row in cache_result.all():
            cache_lookup[row[0]] = row[1]

    for pid in new_ids:
        try:
            resolved = await _resolve_favorite_context(db, pid)
            fav = ParcelFavorite(
                parcel_id=pid,
                parcel_cache_id=resolved["parcel_cache_id"] or cache_lookup.get(pid),
                user_id=user_id,
                gemeente_code=gemeente_code or resolved["gemeente_code"],
                gemeente_naam=gemeente_naam or resolved["gemeente_naam"],
                wijk_naam=resolved["wijk_naam"],
                address=resolved["address"],
                pipeline_stage="Gesignaleerd",
            )
            db.add(fav)
            created += 1
        except Exception as e:
            logger.warning("Bulk favorite failed for parcel %s: %s", pid, e)
            failed += 1

    if created > 0:
        await db.commit()

    logger.info(
        "Bulk favorites: user=%s created=%d existing=%d failed=%d",
        user_id, created, existing_count, failed,
    )

    return BulkFavoriteResponse(created=created, existing=existing_count, failed=failed)


async def list_favorites(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> list[FavoriteResponse]:
    """Return all favorites for the current user, enriched with scan scores and project type."""
    # Resolve caller's org via User.organization_id — keep signature (user_id, db) unchanged
    org_id = await db.scalar(
        select(User.organization_id).where(User.id == user_id)
    )

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

    report_sq = (
        select(
            SavedReport.source_parcel_id.label("parcel_id"),
            SavedReport.id.label("report_id"),
        )
        .where(
            SavedReport.user_id == user_id,
            SavedReport.deleted_at.is_(None),
            SavedReport.source_parcel_id.isnot(None),
        )
        .distinct(SavedReport.source_parcel_id)
        .order_by(SavedReport.source_parcel_id, SavedReport.created_at.desc())
        .subquery()
    )

    # Org-scoped project_type join on Kadaster-string parcel_id (NOT parcel_cache_id UUID).
    # UniqueConstraint(organization_id, parcel_id) guarantees at most one row per (org, parcel).
    project_type_sq = (
        select(
            ParcelProjectType.parcel_id.label("parcel_id"),
            ParcelProjectType.project_type.label("project_type"),
        )
        .where(ParcelProjectType.organization_id == org_id)
        .subquery()
    )

    result = await db.execute(
        select(
            ParcelFavorite,
            scores_sq.c.potentie_score,
            scores_sq.c.risico_score,
            report_sq.c.report_id,
            project_type_sq.c.project_type,
        )
        .outerjoin(scores_sq, scores_sq.c.parcel_id == ParcelFavorite.parcel_cache_id)
        .outerjoin(report_sq, report_sq.c.parcel_id == ParcelFavorite.parcel_cache_id)
        .outerjoin(project_type_sq, project_type_sq.c.parcel_id == ParcelFavorite.parcel_id)
        .where(ParcelFavorite.user_id == user_id)
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
        resp.project_type = row[4]
        responses.append(resp)
    return responses


async def delete_favorite(
    parcel_id: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Remove a parcel from favorites and soft-delete associated report."""
    fav = await _get_favorite_or_404(db, user_id, parcel_id)

    # Soft-delete any report linked to this parcel.
    # Try parcel_cache_id first (direct FK), fall back to looking up the
    # ParcelCache UUID by parcel_code (kadastrale code string).
    source_parcel_uuid = fav.parcel_cache_id
    if source_parcel_uuid is None:
        # Look up the ParcelCache row by parcel_code
        pc_result = await db.execute(
            select(ParcelCache.id).where(ParcelCache.parcel_id == parcel_id).limit(1)
        )
        pc_row = pc_result.scalar_one_or_none()
        if pc_row is not None:
            source_parcel_uuid = pc_row

    if source_parcel_uuid is not None:
        report_result = await db.execute(
            select(SavedReport).where(
                SavedReport.source_parcel_id == source_parcel_uuid,
                SavedReport.user_id == user_id,
                SavedReport.deleted_at.is_(None),
            )
        )
        report = report_result.scalar_one_or_none()
        if report:
            report.deleted_at = datetime.utcnow()
            logger.info(
                "Soft-deleted report %s for parcel=%s user=%s",
                report.id, parcel_id, user_id,
            )

    # M050/S01 D3 primary trigger — soft-delete BRK records for this (org, parcel).
    # ParcelFavorite is user-scoped (no organization_id column), so org-id is
    # resolved via the user's organization. Idempotent + no-op when no BRK rows
    # exist (S01 launches with empty table). Wrapped in try/except so a service
    # failure never blocks the favorite deletion — orphan-cron catches up.
    try:
        org_lookup = await db.execute(
            select(User.organization_id).where(User.id == user_id)
        )
        organization_id = org_lookup.scalar_one_or_none()
        if organization_id is not None:
            await soft_delete_for_org_parcel(
                db=db,
                organization_id=organization_id,
                parcel_id=fav.parcel_id,
            )
    except Exception:  # noqa: BLE001 — never block favorite deletion on BRK soft-delete failure
        logger.exception(
            "BRK soft-delete failed for parcel=%s user=%s — favorite delete continues; "
            "orphan-cron will catch up",
            parcel_id, user_id,
        )

    await db.delete(fav)
    await db.commit()
    logger.info("Favorite deleted: parcel=%s user=%s", parcel_id, user_id)


async def list_favorite_centroids(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> list[FavoriteCentroidResponse]:
    """Return centroid lon/lat for all favorited parcels."""
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
        {"user_id": str(user_id)},
    )
    return [
        FavoriteCentroidResponse(
            parcel_code=row._mapping["parcel_code"],
            lon=float(row._mapping["lon"]),
            lat=float(row._mapping["lat"]),
        )
        for row in result
    ]


async def update_pipeline(
    parcel_id: str,
    stage: str,
    afgerond_reden: str | None,
    notitie: str | None,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> FavoriteResponse:
    """Update the pipeline stage for a favorited parcel."""
    fav = await _get_favorite_or_404(db, user_id, parcel_id)

    fav.pipeline_stage = stage
    if stage == "Afgerond":
        fav.afgerond_reden = afgerond_reden
        if notitie is not None:
            fav.notitie = notitie
    else:
        fav.afgerond_reden = None

    await db.commit()
    await db.refresh(fav)

    logger.info("Pipeline updated: parcel=%s stage=%s user=%s", parcel_id, stage, user_id)

    return FavoriteResponse.model_validate(fav)


async def update_notitie(
    parcel_id: str,
    notitie: str | None,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> FavoriteResponse:
    """Update the free-text note for a favorited parcel."""
    fav = await _get_favorite_or_404(db, user_id, parcel_id)
    fav.notitie = notitie
    await db.commit()
    await db.refresh(fav)
    return FavoriteResponse.model_validate(fav)


# ── Notes CRUD ─────────────────────────────────────────────────────────


async def list_notes(
    parcel_id: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> list[NoteResponse]:
    """List all notes for a favorited parcel, newest first."""
    fav = await _get_favorite_or_404(db, user_id, parcel_id)
    from app.models.favorite_note import FavoriteNote

    result = await db.execute(
        select(FavoriteNote)
        .where(FavoriteNote.favorite_id == fav.id)
        .order_by(FavoriteNote.created_at.desc())
    )
    notes = result.scalars().all()
    return [NoteResponse.from_note(n) for n in notes]


async def create_note(
    parcel_id: str,
    content: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> NoteResponse:
    """Add a new note to a favorited parcel."""
    fav = await _get_favorite_or_404(db, user_id, parcel_id)
    from app.models.favorite_note import FavoriteNote

    note = FavoriteNote(favorite_id=fav.id, content=content)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteResponse.from_note(note)


async def update_note(
    parcel_id: str,
    note_id: str,
    content: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> NoteResponse:
    """Update a note's content."""
    fav = await _get_favorite_or_404(db, user_id, parcel_id)
    from app.models.favorite_note import FavoriteNote

    result = await db.execute(
        select(FavoriteNote).where(
            FavoriteNote.id == note_id,
            FavoriteNote.favorite_id == fav.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note.content = content
    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)
    return NoteResponse.from_note(note)


async def delete_note(
    parcel_id: str,
    note_id: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Delete a note from a favorited parcel."""
    fav = await _get_favorite_or_404(db, user_id, parcel_id)
    from app.models.favorite_note import FavoriteNote

    result = await db.execute(
        select(FavoriteNote).where(
            FavoriteNote.id == note_id,
            FavoriteNote.favorite_id == fav.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.commit()


async def get_portfolio(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> PortfolioResponse:
    """Return all favorites grouped by gemeente/wijk."""
    rows = (
        await db.execute(
            select(
                ParcelFavorite.gemeente_code,
                ParcelFavorite.gemeente_naam,
                ParcelFavorite.wijk_naam,
                func.count(ParcelFavorite.id).label("parcel_count"),
            )
            .where(ParcelFavorite.user_id == user_id)
            .group_by(
                ParcelFavorite.gemeente_code,
                ParcelFavorite.gemeente_naam,
                ParcelFavorite.wijk_naam,
            )
            .order_by(ParcelFavorite.gemeente_naam, ParcelFavorite.wijk_naam)
        )
    ).all()

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
