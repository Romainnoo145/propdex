"""Bekendmaking matcher service — links ChangeRecords to parcels and reports.

Provides query functions for two-way matching:
- Forward: ChangeRecord → matching parcels/reports (via postcode)
- Reverse: Parcel → matching ChangeRecords (via address postcode extraction)
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.change_record import ChangeRecord
from app.models.parcel_cache import ParcelCache
from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.services.postcode_extractor import extract_postcodes


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
