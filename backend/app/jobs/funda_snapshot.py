"""Background job for ingesting Funda listing snapshots."""

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.services.funda_listing_ingestion import ingest_funda_area_snapshots

logger = logging.getLogger(__name__)


async def funda_snapshot_job(
    ctx: dict,
    organization_id: str,
    area_names: list[str] | None = None,
    max_listings: int = 60,
) -> dict:
    """
    Fetch Funda listings for one organization and store daily snapshots.

    This is a Phase 59 PoC job. It intentionally runs for a scoped set of areas
    (default: Arcen) to validate data quality before scaling.
    """
    org_id = uuid.UUID(organization_id)
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=4,
        max_overflow=6,
        echo=False,
    )
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    target_areas = [a.strip() for a in (area_names or ["arcen"]) if isinstance(a, str) and a.strip()]
    if not target_areas:
        target_areas = ["arcen"]

    summary: list[dict[str, int | str | bool]] = []

    try:
        async with session_factory() as session:
            for area_name in target_areas:
                try:
                    stats = await ingest_funda_area_snapshots(
                        organization_id=org_id,
                        area_name=area_name,
                        max_listings=max_listings,
                        session=session,
                    )
                    summary.append(stats)
                    await session.commit()
                except Exception as exc:  # pragma: no cover - network/runtime-dependent
                    await session.rollback()
                    logger.exception(
                        "Funda snapshot failed for org=%s area=%s: %s",
                        org_id,
                        area_name,
                        exc,
                    )
                    summary.append(
                        {
                            "area_name": area_name,
                            "search_status": 0,
                            "fetch_engine": "error",
                            "blocked": False,
                            "detail_links": 0,
                            "snapshots_upserted": 0,
                            "matched_parcels": 0,
                            "error": str(exc),
                        }
                    )

        total_upserted = sum(int(item.get("snapshots_upserted", 0)) for item in summary)
        total_matched = sum(int(item.get("matched_parcels", 0)) for item in summary)
        return {
            "status": "completed",
            "organization_id": str(org_id),
            "areas": target_areas,
            "max_listings": max_listings,
            "total_snapshots_upserted": total_upserted,
            "total_matched_parcels": total_matched,
            "summary": summary,
        }

    finally:
        await engine.dispose()
