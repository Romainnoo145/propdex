"""Daily change monitoring background job for ARQ worker."""

import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.models.change_record import ChangeRecord
from app.models.project import Project
from app.services.bekendmaking_matcher import find_parcel_at_point
from app.services.change_detector import detect_permit_changes, detect_zoning_changes

logger = logging.getLogger(__name__)

locatieserver = PDOKLocatieserver()


async def _try_match_parcel(
    change: ChangeRecord,
    organization_id: uuid.UUID,
    client: httpx.AsyncClient,
    session: AsyncSession,
) -> uuid.UUID | None:
    """Attempt to geocode and spatially match a ChangeRecord to a parcel.

    Uses address_components from metadata_json. Returns matched parcel UUID or None.
    """
    components = (change.metadata_json or {}).get("address_components")
    if not components:
        return None

    street = components.get("street")
    huisnummer = components.get("huisnummer")
    if not street or not huisnummer:
        return None

    try:
        hn_int = int(huisnummer)
    except (ValueError, TypeError):
        return None

    coords = await locatieserver.geocode_address(
        street=street,
        huisnummer=hn_int,
        client=client,
        postcode=components.get("postcode"),
        city=components.get("city"),
        gemeente_naam=change.gemeente_naam,
    )
    if coords is None:
        return None

    return await find_parcel_at_point(
        coords[0], coords[1], organization_id, session
    )


async def daily_change_monitor_job(ctx: dict) -> dict:
    """
    Daily background job: Detect new permits and zoning changes across all monitored gemeentes.

    Runs at 03:00 UTC via ARQ cron schedule.

    Pipeline:
        1. Load all monitored projects (is_monitored=True, gemeente_code NOT NULL)
        2. Group projects by gemeente_code to avoid duplicate API calls
        3. For each gemeente:
           - Determine last_checked timestamp from ChangeRecord history
           - Call detect_permit_changes (SRU Bekendmakingen API)
           - Call detect_zoning_changes (PDOK PLU WMS metadata hash)
           - Create ChangeRecord per project for each detected change
           - Handle duplicates via IntegrityError (unique constraint on change_type+external_id+gemeente_naam)
           - Commit per gemeente (one failure doesn't roll back all)
        4. Return summary: gemeentes_checked, total_changes

    Args:
        ctx: ARQ context (contains redis connection, etc.)

    Returns:
        dict with status, gemeentes_checked, total_changes for ARQ result storage
    """
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        echo=False,
    )
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    http_client: httpx.AsyncClient | None = None
    gemeentes_checked = 0
    total_changes = 0

    try:
        http_client = httpx.AsyncClient(timeout=60.0)

        async with session_factory() as session:
            logger.info("Starting daily change monitor job")

            # Load all monitored projects
            stmt = select(Project).where(
                Project.is_monitored == True,  # noqa: E712
                Project.gemeente_code.is_not(None),
            )
            result = await session.execute(stmt)
            all_projects = result.scalars().all()

            logger.info(f"Found {len(all_projects)} monitored projects")

            # Group projects by gemeente_code
            # Key: gemeente_code, Value: list of projects
            # Also store gemeente_naam mapping for permit queries
            gemeente_map: dict[str, list[Project]] = defaultdict(list)
            gemeente_naam_map: dict[str, str] = {}

            for project in all_projects:
                if project.gemeente_code:
                    gemeente_map[project.gemeente_code].append(project)

                    # Determine gemeente_naam for SRU query
                    # For parent projects (parent_id IS NULL), use project.name
                    # For wijk projects, use parent project's name
                    if project.parent_id is None:
                        gemeente_naam_map[project.gemeente_code] = project.name
                    elif project.gemeente_code not in gemeente_naam_map:
                        # Need to resolve parent project name
                        # Find parent project with same gemeente_code and parent_id=None
                        for p in all_projects:
                            if (
                                p.gemeente_code == project.gemeente_code
                                and p.parent_id is None
                            ):
                                gemeente_naam_map[project.gemeente_code] = p.name
                                break

            logger.info(f"Grouped into {len(gemeente_map)} gemeentes")

            # Process each gemeente
            for gemeente_code, projects in gemeente_map.items():
                try:
                    gemeentes_checked += 1
                    gemeente_naam = gemeente_naam_map.get(
                        gemeente_code, "Unknown"
                    )

                    logger.info(
                        f"Processing gemeente {gemeente_naam} "
                        f"(code={gemeente_code}, {len(projects)} projects)"
                    )

                    # Determine last_checked timestamp
                    # Query the latest detected_at from ChangeRecord for this gemeente
                    stmt = (
                        select(ChangeRecord.detected_at)
                        .join(Project, ChangeRecord.project_id == Project.id)
                        .where(Project.gemeente_code == gemeente_code)
                        .order_by(ChangeRecord.detected_at.desc())
                        .limit(1)
                    )
                    result = await session.execute(stmt)
                    last_detected = result.scalar_one_or_none()

                    if last_detected:
                        last_checked = last_detected
                        logger.info(
                            f"  Last checked: {last_checked.isoformat()}"
                        )
                    else:
                        # First run for this gemeente — check last 2 days
                        last_checked = datetime.utcnow() - timedelta(days=2)
                        logger.info(
                            f"  First run — checking since {last_checked.isoformat()}"
                        )

                    # Detect permit changes via SRU
                    permit_changes = await detect_permit_changes(
                        gemeente_naam=gemeente_naam,
                        last_checked=last_checked,
                        client=http_client,
                        session=session,
                    )

                    logger.info(
                        f"  Found {len(permit_changes)} permit changes"
                    )

                    # Detect zoning changes via DSO plan state comparison
                    # Use first project's organization_id for cache storage
                    org_id = projects[0].organization_id
                    zoning_changes = await detect_zoning_changes(
                        gemeente_code=gemeente_code,
                        last_checked=last_checked,
                        client=http_client,
                        session=session,
                        organization_id=str(org_id) if org_id else None,
                    )

                    logger.info(
                        f"  Found {len(zoning_changes)} zoning changes"
                    )

                    # Store changes on the gemeente (parent) project only.
                    # Wijk-level views filter by postcode — no need to duplicate.
                    all_changes = permit_changes + zoning_changes
                    parent_project = next(
                        (p for p in projects if p.parent_id is None),
                        projects[0],
                    )

                    for change in all_changes:
                        # Attempt geocode + spatial parcel match
                        matched_id = await _try_match_parcel(
                            change,
                            parent_project.organization_id,
                            http_client,
                            session,
                        )

                        change_record = ChangeRecord(
                            organization_id=parent_project.organization_id,
                            project_id=parent_project.id,
                            change_type=change.change_type,
                            external_id=change.external_id,
                            gemeente_naam=change.gemeente_naam,
                            title=change.title,
                            change_date=change.change_date,
                            detected_at=change.detected_at,
                            metadata_json=change.metadata_json,
                            source_url=change.source_url,
                            postcode=change.postcode,
                            matched_parcel_id=matched_id,
                        )

                        try:
                            async with session.begin_nested():
                                session.add(change_record)
                                await session.flush()
                            total_changes += 1
                        except IntegrityError:
                            logger.debug(
                                f"  Skipped duplicate: {change.change_type} "
                                f"{change.external_id}"
                            )
                            continue

                    # Commit after processing this gemeente
                    await session.commit()

                except Exception as e:
                    logger.error(
                        f"Failed to process gemeente {gemeente_code}: {e}",
                        exc_info=True,
                    )
                    await session.rollback()
                    # Continue to next gemeente
                    continue

            logger.info(
                f"Daily change monitor job completed: "
                f"{gemeentes_checked} gemeentes checked, "
                f"{total_changes} total changes detected"
            )

            return {
                "status": "completed",
                "gemeentes_checked": gemeentes_checked,
                "total_changes": total_changes,
            }

    except Exception as e:
        logger.exception(f"Unexpected error in daily_change_monitor_job: {e}")
        return {
            "status": "error",
            "error": str(e),
            "gemeentes_checked": gemeentes_checked,
            "total_changes": total_changes,
        }

    finally:
        if http_client:
            await http_client.aclose()
        await engine.dispose()


async def initial_change_fetch(
    project_id: str,
    gemeente_naam: str,
    gemeente_code: str,
    organization_id: str,
) -> None:
    """Fetch bekendmakingen for a newly created gemeente project (30-day lookback).

    Called as a fire-and-forget background task when a new gemeente parent
    project is created during scan. Creates its own engine/session/client
    so it's fully independent of the calling request lifecycle.
    """
    engine = create_async_engine(settings.DATABASE_URL, pool_size=2, max_overflow=2)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False,
    )
    http_client: httpx.AsyncClient | None = None

    try:
        http_client = httpx.AsyncClient(timeout=60.0)
        async with session_factory() as session:
            proj_uuid = uuid.UUID(project_id)
            org_uuid = uuid.UUID(organization_id)
            last_checked = datetime.utcnow() - timedelta(days=30)

            logger.info(
                f"Initial change fetch for {gemeente_naam} "
                f"(code={gemeente_code}, lookback=30d)"
            )

            permit_changes = await detect_permit_changes(
                gemeente_naam=gemeente_naam,
                last_checked=last_checked,
                client=http_client,
                session=session,
            )

            stored = 0
            for change in permit_changes:
                change.organization_id = org_uuid
                change.project_id = proj_uuid
                change.gemeente_naam = gemeente_naam

                # Attempt geocode + spatial parcel match
                matched_id = await _try_match_parcel(
                    change, org_uuid, http_client, session
                )
                if matched_id:
                    change.matched_parcel_id = matched_id

                try:
                    async with session.begin_nested():
                        session.add(change)
                        await session.flush()
                    stored += 1
                except IntegrityError:
                    continue

            await session.commit()
            logger.info(
                f"Initial change fetch complete for {gemeente_naam}: "
                f"{stored} changes stored"
            )

    except Exception as e:
        logger.exception(f"Initial change fetch failed for {gemeente_naam}: {e}")

    finally:
        if http_client:
            await http_client.aclose()
        await engine.dispose()
