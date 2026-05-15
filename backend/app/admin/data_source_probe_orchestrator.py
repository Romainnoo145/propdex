"""Opportunistic probe orchestrator for the data-sources GET endpoint."""
import asyncio
from datetime import datetime

from sqlalchemy import BigInteger, func, select, type_coerce
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.data_source_probes import compute_lock_key, probe_type_a_cascade
from app.admin.data_sources_helpers import (
    _load_or_create_row,
    _row_from_db,
    _synthesize_missing_row,
)
from app.admin.data_sources_schemas import DataSourceRow
from app.models.data_source_status import DataSourceStatus
from app.policy_documents.data_source_keys import DATA_SOURCE_KEYS


async def run_opportunistic_probes(
    gemeente_code: str,
    cascade_uploads: list[DataSourceRow],
    db: AsyncSession,
    name_map: dict[str, str],  # passed for future use; currently unused
) -> list[DataSourceRow]:
    """Probe missing Type A rows on GET and update their status in-place.

    Self-healing: first GET for a gemeente with pre-existing PolicyDocument rows
    (but no status rows) will automatically flip status from 'missing' to 'live'.
    Advisory lock prevents double-write on concurrent requests.
    """
    missing_keys = [row.source_key for row in cascade_uploads if row.status == "missing"]
    if not missing_keys:
        return cascade_uploads

    # Acquire advisory locks sequentially — only probe keys we lock
    locked_keys: list[str] = []
    for key in missing_keys:
        lock_key = compute_lock_key(gemeente_code, key)
        acquired = bool(
            await db.scalar(
                select(func.pg_try_advisory_xact_lock(type_coerce(lock_key, BigInteger())))
            )
        )
        if acquired:
            locked_keys.append(key)

    if not locked_keys:
        return cascade_uploads

    # Run Type A probes concurrently for all locked keys
    probe_results = await asyncio.gather(
        *[probe_type_a_cascade(key, gemeente_code, db) for key in locked_keys]
    )

    # Update DB rows where probe returned non-missing status
    for key, probe_result in zip(locked_keys, probe_results, strict=False):
        if probe_result["status"] != "missing":
            row = await _load_or_create_row(gemeente_code, key, db)
            row.status = probe_result["status"]
            row.error_message = probe_result["error_message"]
            row.last_checked = datetime.utcnow()

    await db.commit()

    # Re-fetch all status rows for the gemeente and rebuild cascade_uploads
    db_rows = (
        await db.execute(
            select(DataSourceStatus).where(DataSourceStatus.gemeente_code == gemeente_code)
        )
    ).scalars().all()
    by_key: dict[str, DataSourceStatus] = {r.source_key: r for r in db_rows}

    updated: list[DataSourceRow] = []
    for entry in DATA_SOURCE_KEYS:
        if entry.source_type != "A":
            continue
        db_row = by_key.get(entry.key)
        updated.append(_row_from_db(db_row, entry) if db_row else _synthesize_missing_row(entry))

    return updated
