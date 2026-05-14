"""Shared gemeente_code → gemeente_naam resolver.

Source: extracted from backend/app/policy_documents/service.py:332-350 (M045/S05 pattern).
M049/S02 Wave-1 implementation.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.area_scan import AreaScan


async def get_gemeente_name_map(db: AsyncSession) -> dict[str, str]:
    """Return {gemeente_code: gemeente_naam} sourced from area_scans.

    Single DISTINCT query. Gemeentes never scanned will be absent (caller falls
    back to raw code). At most ~342 NL gemeentes.
    """
    stmt = (
        select(AreaScan.gemeente_code, AreaScan.gemeente_naam)
        .distinct()
        .where(AreaScan.gemeente_code.is_not(None))
    )
    rows = (await db.execute(stmt)).all()
    return {row.gemeente_code: row.gemeente_naam for row in rows}
