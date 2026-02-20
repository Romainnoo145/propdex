"""Daily change monitoring background job for ARQ worker."""

import logging
from collections import defaultdict
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.change_record import ChangeRecord
from app.models.project import Project
from app.services.change_detector import detect_permit_changes, detect_zoning_changes

logger = logging.getLogger(__name__)


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
        http_client = httpx.AsyncClient(timeout=30.0)

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

                    # Detect zoning changes via PLU WMS metadata hash
                    zoning_changes = await detect_zoning_changes(
                        gemeente_code=gemeente_code,
                        last_checked=last_checked,
                        client=http_client,
                        session=session,
                    )

                    logger.info(
                        f"  Found {len(zoning_changes)} zoning changes"
                    )

                    # Create ChangeRecord per project for each detected change
                    all_changes = permit_changes + zoning_changes

                    for change in all_changes:
                        for project in projects:
                            # Set project_id and organization_id
                            change_copy = ChangeRecord(
                                organization_id=project.organization_id,
                                project_id=project.id,
                                change_type=change.change_type,
                                external_id=change.external_id,
                                gemeente_naam=change.gemeente_naam,
                                title=change.title,
                                description=change.description,
                                change_date=change.change_date,
                                detected_at=change.detected_at,
                                metadata_json=change.metadata_json,
                            )
                            session.add(change_copy)

                            try:
                                await session.flush()
                                total_changes += 1
                            except IntegrityError:
                                # Duplicate — unique constraint on (change_type, external_id, gemeente_naam)
                                await session.rollback()
                                logger.debug(
                                    f"  Skipped duplicate: {change.change_type} "
                                    f"{change.external_id} for project {project.id}"
                                )
                                # Continue with same session
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
