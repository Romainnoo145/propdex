"""Daily change monitoring background job for ARQ worker."""

import logging
import re
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

import httpx
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.models.change_record import ChangeRecord
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.services.bekendmaking_matcher import find_parcel_at_point
from app.services.change_detector import detect_permit_changes, detect_zoning_changes
from app.services.postcode_extractor import extract_postcodes

logger = logging.getLogger(__name__)

locatieserver = PDOKLocatieserver()


def _normalize_postcode(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.upper().replace(" ", "").strip()
    return cleaned if len(cleaned) == 6 else None


def _coerce_huisnummer(value: object) -> int | None:
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, str):
        match = re.search(r"(\d+)", value)
        if match:
            try:
                parsed = int(match.group(1))
                return parsed if parsed > 0 else None
            except ValueError:
                return None
    return None


def _normalize_street_hint(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    street = value.strip()
    if not street:
        return None
    if " - " in street:
        parts = [p.strip() for p in street.split(" - ") if p.strip()]
        if parts:
            street = parts[-1]
    return street or None


def _build_address_from_components(
    components: dict | None,
    normalized_postcode: str | None = None,
) -> str | None:
    if not isinstance(components, dict):
        return None

    street = str(components.get("street") or "").strip()
    huisnummer = str(components.get("huisnummer") or "").strip()
    toevoeging = str(components.get("huisnummer_toevoeging") or "").strip()
    city = str(components.get("city") or "").strip()

    if not street or not huisnummer:
        return None

    if " - " in street:
        parts = [p.strip() for p in street.split(" - ") if p.strip()]
        if parts:
            street = parts[-1]

    first_line = f"{street} {huisnummer}{toevoeging}".strip()
    postcode = normalized_postcode or (
        str(components.get("postcode") or "").upper().replace(" ", "")
    )

    address_parts = [first_line]
    if postcode:
        address_parts.append(postcode)
    if city:
        address_parts.append(city)

    return ", ".join(address_parts)


def _extract_huisnummer_from_address(address: str | None) -> int | None:
    if not address:
        return None
    first_line = address.split(",")[0].strip()
    match = re.search(r"(\d+)", first_line)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _extract_street_huisnummer(address_like: str | None) -> tuple[str, int] | None:
    if not address_like:
        return None

    first_line = address_like.split(",")[0].strip()
    if " - " in first_line:
        first_line = first_line.rsplit(" - ", 1)[-1].strip()

    match = re.search(r"(.+?)\s+(\d+)(?:[A-Za-z]|-[A-Za-z0-9]+)?\b", first_line)
    if not match:
        return None

    street = _normalize_street_hint(match.group(1))
    if not street:
        return None
    try:
        huisnummer = int(match.group(2))
    except ValueError:
        return None

    if huisnummer <= 0:
        return None
    return street, huisnummer


def _extract_match_hints(
    change: ChangeRecord,
    effective_postcode: str | None,
) -> tuple[str, int, str | None] | None:
    components = (change.metadata_json or {}).get("address_components")
    if isinstance(components, dict):
        street = _normalize_street_hint(components.get("street"))
        huisnummer = _coerce_huisnummer(components.get("huisnummer"))
        postcode = _normalize_postcode(
            effective_postcode or components.get("postcode")
        )
        if street and huisnummer:
            return street, huisnummer, postcode

    parsed = _extract_street_huisnummer(change.address)
    if parsed:
        return parsed[0], parsed[1], _normalize_postcode(effective_postcode)

    title_tail = (
        change.title.rsplit(" - ", 1)[-1]
        if isinstance(change.title, str) and " - " in change.title
        else change.title
    )
    if isinstance(title_tail, str) and re.search(r"\bsectie\b", title_tail, re.IGNORECASE):
        return None
    parsed_from_title = _extract_street_huisnummer(title_tail)
    if parsed_from_title:
        return parsed_from_title[0], parsed_from_title[1], _normalize_postcode(
            effective_postcode
        )
    return None


async def _find_parcel_by_address_hint(
    street: str,
    huisnummer: int,
    organization_id: uuid.UUID,
    session: AsyncSession,
    postcode: str | None = None,
) -> uuid.UUID | None:
    normalized_street = street.strip().lower()
    if not normalized_street:
        return None

    normalized_postcode = _normalize_postcode(postcode)

    query = select(ParcelCache.id, ParcelCache.address).where(
        ParcelCache.organization_id == organization_id,
        ParcelCache.address.is_not(None),
        func.lower(ParcelCache.address).contains(normalized_street),
    )
    if normalized_postcode:
        query = query.where(
            func.upper(
                func.regexp_replace(ParcelCache.address, r"\s+", "", "g")
            ).contains(normalized_postcode)
        )

    rows = (await session.execute(query.limit(60))).all()
    if not rows:
        return None

    exact = [
        row
        for row in rows
        if _extract_huisnummer_from_address(row[1]) == huisnummer
    ]
    if exact:
        return exact[0][0]
    if len(rows) == 1:
        return rows[0][0]
    return None


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
    if not isinstance(components, dict):
        return None

    street = _normalize_street_hint(components.get("street"))
    huisnummer = _coerce_huisnummer(components.get("huisnummer"))
    if not street or not huisnummer:
        return None

    coords = await locatieserver.geocode_address(
        street=street,
        huisnummer=huisnummer,
        client=client,
        postcode=_normalize_postcode(components.get("postcode")),
        city=components.get("city"),
        gemeente_naam=change.gemeente_naam,
    )

    if coords is not None:
        matched = await find_parcel_at_point(
            coords[0], coords[1], organization_id, session
        )
        if matched is not None:
            return matched

    return await _find_parcel_by_address_hint(
        street=street,
        huisnummer=huisnummer,
        organization_id=organization_id,
        session=session,
        postcode=_normalize_postcode(components.get("postcode")),
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
                        components = (change.metadata_json or {}).get("address_components")
                        effective_postcode = change.postcode
                        if not effective_postcode:
                            if isinstance(components, dict) and components.get("postcode"):
                                effective_postcode = str(components["postcode"]).upper().replace(
                                    " ", ""
                                )
                            else:
                                for text_candidate in (
                                    change.address,
                                    change.title,
                                    change.source_url,
                                ):
                                    if not text_candidate:
                                        continue
                                    extracted = extract_postcodes(text_candidate)
                                    if extracted:
                                        effective_postcode = extracted[0]
                                        break

                        effective_address = change.address or _build_address_from_components(
                            components, effective_postcode
                        )

                        # Attempt geocode + spatial parcel match
                        matched_id = await _try_match_parcel(
                            change,
                            parent_project.organization_id,
                            http_client,
                            session,
                        )
                        if matched_id is None:
                            hints = _extract_match_hints(change, effective_postcode)
                            if hints is not None:
                                matched_id = await _find_parcel_by_address_hint(
                                    street=hints[0],
                                    huisnummer=hints[1],
                                    organization_id=parent_project.organization_id,
                                    session=session,
                                    postcode=hints[2],
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
                            address=effective_address,
                            metadata_json=change.metadata_json,
                            source_url=change.source_url,
                            postcode=effective_postcode,
                            matched_parcel_id=matched_id or change.matched_parcel_id,
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
