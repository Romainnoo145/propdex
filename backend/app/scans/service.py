"""Scan CRUD service layer for area scan operations."""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.area_scan import AreaScan
from app.models.scan_result import ScanResult


async def get_existing_scan(
    organization_id: uuid.UUID,
    gemeente_code: str,
    session: AsyncSession,
) -> AreaScan | None:
    """
    Get most recent scan for organization + gemeente.

    Args:
        organization_id: Tenant organization ID
        gemeente_code: CBS gemeentecode
        session: Database session

    Returns:
        AreaScan | None: Most recent scan or None
    """
    query = (
        select(AreaScan)
        .where(
            AreaScan.organization_id == organization_id,
            AreaScan.gemeente_code == gemeente_code,
        )
        .order_by(AreaScan.created_at.desc())
        .limit(1)
    )

    result = await session.execute(query)
    return result.scalar_one_or_none()


async def create_scan(
    organization_id: uuid.UUID,
    gemeente_code: str,
    gemeente_naam: str,
    bbox: dict,
    session: AsyncSession,
) -> AreaScan:
    """
    Create a new area scan record.

    Args:
        organization_id: Tenant organization ID
        gemeente_code: CBS gemeentecode
        gemeente_naam: Gemeente display name
        bbox: Bounding box dict with minx, miny, maxx, maxy keys
        session: Database session

    Returns:
        AreaScan: The created scan
    """
    scan = AreaScan(
        organization_id=organization_id,
        gemeente_code=gemeente_code,
        gemeente_naam=gemeente_naam,
        bbox_minx=bbox["minx"],
        bbox_miny=bbox["miny"],
        bbox_maxx=bbox["maxx"],
        bbox_maxy=bbox["maxy"],
        status="pending",
        progress_pct=0,
    )

    session.add(scan)
    await session.flush()
    await session.commit()

    return scan


async def reset_scan_for_rescan(
    scan: AreaScan,
    session: AsyncSession,
) -> AreaScan:
    """
    Reset scan for re-scan by deleting results and resetting fields.

    Args:
        scan: Existing AreaScan to reset
        session: Database session

    Returns:
        AreaScan: The reset scan
    """
    # Delete all ScanResult rows for this scan
    delete_stmt = delete(ScanResult).where(ScanResult.scan_id == scan.id)
    await session.execute(delete_stmt)

    # Reset scan fields
    scan.status = "pending"
    scan.progress_pct = 0
    scan.parcels_total = 0
    scan.parcels_processed = 0
    scan.parcels_failed = 0
    scan.current_phase = None
    scan.error_message = None
    scan.started_at = None
    scan.completed_at = None
    scan.job_id = None

    session.add(scan)
    await session.flush()
    await session.commit()

    return scan


async def get_scan_by_id(
    scan_id: uuid.UUID,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> AreaScan | None:
    """
    Get scan by ID with multi-tenant isolation.

    Args:
        scan_id: Scan UUID
        organization_id: Tenant organization ID
        session: Database session

    Returns:
        AreaScan | None: The scan or None if not found
    """
    query = select(AreaScan).where(
        AreaScan.id == scan_id,
        AreaScan.organization_id == organization_id,
    )

    result = await session.execute(query)
    return result.scalar_one_or_none()
