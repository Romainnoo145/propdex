"""Bekendmaking matcher service — links ChangeRecords to parcels and reports.

Provides query functions for two-way matching:
- Forward: ChangeRecord → matching parcels/reports (via postcode)
- Reverse: Parcel → matching ChangeRecords (via address postcode extraction)
- Retro: Re-check unmatched ChangeRecords after a wijk scan adds new parcels
"""

import asyncio
import logging
import uuid

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from app.models.change_record import ChangeRecord
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.services.postcode_extractor import extract_postcodes

logger = logging.getLogger(__name__)

# Throttle concurrent PDOK geocoding calls in retro-match
RETRO_MATCH_CONCURRENCY = 5


async def find_parcel_at_point(
    x: float,
    y: float,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> uuid.UUID | None:
    """Find the ParcelCache.id whose geometry contains the RD point (x, y).

    Uses PostGIS ST_Contains with GIST index for fast lookup.
    Both geometry and point are in EPSG:28992 (RD New) — no transform needed.

    Args:
        x: X coordinate in EPSG:28992 (RD New)
        y: Y coordinate in EPSG:28992 (RD New)
        organization_id: Organization UUID for multi-tenant isolation
        session: Async SQLAlchemy session

    Returns:
        ParcelCache.id UUID if a parcel contains the point, else None.
    """
    point = func.ST_SetSRID(func.ST_MakePoint(x, y), 28992)
    stmt = (
        select(ParcelCache.id)
        .where(
            ParcelCache.organization_id == organization_id,
            func.ST_Contains(ParcelCache.geometry, point),
        )
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def find_matching_parcels(
    postcode: str,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> list[dict]:
    """Find ParcelCache entries whose address contains this postcode.

    Joins through ScanResult to get the scan_id for navigation.

    Returns:
        List of dicts: {parcel_id, scan_id, address}
    """
    # Normalize: search both "1234AB" and "1234 AB" patterns
    pattern_no_space = postcode.upper().replace(" ", "")
    pattern_with_space = f"{pattern_no_space[:4]} {pattern_no_space[4:]}"

    stmt = (
        select(
            ParcelCache.id,
            ScanResult.scan_id,
            ParcelCache.address,
        )
        .join(ScanResult, ScanResult.parcel_id == ParcelCache.id)
        .where(
            ParcelCache.organization_id == organization_id,
            ParcelCache.address.isnot(None),
            (
                ParcelCache.address.ilike(f"%{pattern_no_space}%")
                | ParcelCache.address.ilike(f"%{pattern_with_space}%")
            ),
        )
        .distinct(ParcelCache.id)
        .limit(20)
    )
    result = await session.execute(stmt)
    rows = result.all()

    return [
        {
            "parcel_id": str(row[0]),
            "scan_id": str(row[1]),
            "address": row[2],
        }
        for row in rows
    ]


async def find_matching_reports(
    postcode: str,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> list[dict]:
    """Find SavedReport entries matching this postcode.

    Returns:
        List of dicts: {report_id, report_name}
    """
    normalized = postcode.upper().replace(" ", "")

    stmt = (
        select(SavedReport.id, SavedReport.report_name)
        .where(
            SavedReport.organization_id == organization_id,
            SavedReport.postcode == normalized,
            SavedReport.deleted_at.is_(None),
        )
        .limit(20)
    )
    result = await session.execute(stmt)
    rows = result.all()

    return [
        {
            "report_id": str(row[0]),
            "report_name": row[1],
        }
        for row in rows
    ]


async def find_changes_for_parcel(
    parcel_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> list[ChangeRecord]:
    """Find ChangeRecords matching a parcel's address postcode (reverse lookup).

    Extracts postcode from the parcel's address, then queries ChangeRecords
    with matching postcode within the same organization.
    """
    # Get parcel address
    stmt = select(ParcelCache.address).where(
        ParcelCache.id == parcel_id,
        ParcelCache.organization_id == organization_id,
    )
    result = await session.execute(stmt)
    address = result.scalar_one_or_none()

    if not address:
        return []

    postcodes = extract_postcodes(address)
    if not postcodes:
        return []

    # Query ChangeRecords matching any extracted postcode
    stmt = (
        select(ChangeRecord)
        .where(
            ChangeRecord.organization_id == organization_id,
            ChangeRecord.postcode.in_(postcodes),
        )
        .order_by(ChangeRecord.detected_at.desc())
        .limit(20)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def retro_match_changes_for_gemeente(
    gemeente_code: str,
    organization_id: uuid.UUID,
    session: AsyncSession,
    client: httpx.AsyncClient,
) -> int:
    """Re-attempt parcel matching for unmatched ChangeRecords in a gemeente.

    Called after a wijk scan completes. Queries ChangeRecords where:
    - matched_parcel_id IS NULL
    - address_components present in metadata_json (with street + huisnummer)
    - project belongs to this gemeente (via Project.gemeente_code join)

    Uses asyncio.Semaphore to throttle PDOK geocoding requests (RETRO_MATCH_CONCURRENCY).
    Processes sequentially to avoid AsyncSession write conflicts.

    Args:
        gemeente_code: CBS gemeente code (e.g., "GM0983")
        organization_id: Organization UUID for multi-tenant isolation
        session: Async SQLAlchemy session (caller handles commit)
        client: Shared httpx AsyncClient for PDOK geocoding

    Returns:
        Count of newly matched records.
    """
    # Find unmatched changes for projects in this gemeente
    stmt = (
        select(ChangeRecord)
        .join(Project, ChangeRecord.project_id == Project.id)
        .where(
            ChangeRecord.organization_id == organization_id,
            ChangeRecord.matched_parcel_id.is_(None),
            Project.gemeente_code == gemeente_code,
        )
        .limit(200)  # Safety cap
    )
    result = await session.execute(stmt)
    unmatched = result.scalars().all()

    if not unmatched:
        logger.info(f"Retro-match {gemeente_code}: no unmatched changes found")
        return 0

    # Filter to only those with address_components in metadata
    candidates = [
        c
        for c in unmatched
        if (c.metadata_json or {}).get("address_components")
        and (c.metadata_json["address_components"].get("street"))
        and (c.metadata_json["address_components"].get("huisnummer"))
    ]

    if not candidates:
        logger.info(
            f"Retro-match {gemeente_code}: {len(unmatched)} unmatched but "
            f"none with address_components"
        )
        return 0

    logger.info(f"Retro-match {gemeente_code}: attempting {len(candidates)} candidates")

    locatieserver = PDOKLocatieserver()
    semaphore = asyncio.Semaphore(RETRO_MATCH_CONCURRENCY)
    matched_count = 0

    async def try_match_one(change: ChangeRecord) -> bool:
        nonlocal matched_count
        components = change.metadata_json["address_components"]
        try:
            huisnummer = int(components["huisnummer"])
        except (ValueError, TypeError):
            return False

        async with semaphore:
            coords = await locatieserver.geocode_address(
                street=components["street"],
                huisnummer=huisnummer,
                client=client,
                postcode=components.get("postcode"),
                city=components.get("city"),
                gemeente_naam=change.gemeente_naam,
            )
        if coords is None:
            return False

        parcel_id = await find_parcel_at_point(
            coords[0], coords[1], organization_id, session
        )
        if parcel_id:
            change.matched_parcel_id = parcel_id
            session.add(change)
            matched_count += 1
            return True
        return False

    # Process sequentially to avoid session concurrency issues
    # (asyncio.gather with shared session is unsafe for writes)
    for change in candidates:
        try:
            await try_match_one(change)
        except Exception as e:
            logger.debug(f"Retro-match failed for {change.external_id}: {e}")
            continue

    if matched_count > 0:
        await session.flush()
        # Caller (area_scan_job) handles commit

    logger.info(
        f"Retro-match {gemeente_code}: matched {matched_count}/{len(candidates)}"
    )
    return matched_count
