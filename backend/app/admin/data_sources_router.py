"""M049/S02 admin data-sources router (Wave-2: POST refresh + probe-registry + advisory lock).

Plan 01 shipped GET endpoints + POST stub.
Plan 02 replaces the 501 stub with advisory-lock + probe-registry dispatch.
Plan 04-05 adds opportunistic probe-on-load via run_opportunistic_probes.
"""
import logging
from collections import defaultdict
from datetime import datetime
from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import BigInteger, func, select, type_coerce
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.data_source_probe_orchestrator import run_opportunistic_probes
from app.admin.data_source_probes import PROBE_REGISTRY, compute_lock_key
from app.admin.data_sources_helpers import (
    _load_or_create_row,
    _row_from_db,
    _synthesize_missing_row,
)
from app.admin.data_sources_schemas import (
    DataSourceRow,
    GemeenteDataSourcesPayload,
    GemeenteSummary,
)
from app.auth.dependencies import get_current_superuser
from app.core.database import get_db
from app.models.data_source_status import DataSourceStatus, DataSourceStatusValue
from app.models.user import User
from app.policy_documents.data_source_keys import DATA_SOURCE_KEYS, get_entry
from app.services.gemeente_name_lookup import get_gemeente_name_map

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/data-sources",
    tags=["Admin / Data Sources"],
)

GemeenteCodePath = Annotated[str, Path(pattern=r"^GM\d{4}$")]


@router.get("/gemeenten", response_model=list[GemeenteSummary])
async def list_gemeenten(
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[GemeenteSummary]:
    """Aggregate per-gemeente status counts, sorted last_activity_at DESC, gemeente_code ASC."""
    # Pull all rows for aggregation in Python (max ~342 gemeentes × ~45 keys = small)
    rows = (await db.execute(select(DataSourceStatus))).scalars().all()
    name_map = await get_gemeente_name_map(db)

    # Group by gemeente_code
    grouped: dict[str, list[DataSourceStatus]] = defaultdict(list)
    for r in rows:
        grouped[r.gemeente_code].append(r)

    # Also include gemeentes that appear in name_map but have zero status rows
    for code in name_map:
        grouped.setdefault(code, [])

    out: list[GemeenteSummary] = []
    for code, rs in grouped.items():
        counts: dict[DataSourceStatusValue, int] = {"live": 0, "broken": 0, "missing": 0, "not_applicable": 0}
        last_activity: datetime | None = None
        for r in rs:
            s_val = cast(DataSourceStatusValue, r.status)
            counts[s_val] = counts.get(s_val, 0) + 1
            if r.last_checked and (last_activity is None or r.last_checked > last_activity):
                last_activity = r.last_checked
        out.append(GemeenteSummary(
            gemeente_code=code,
            gemeente_naam=name_map.get(code, code),
            total_sources=len(rs),
            status_counts=counts,
            last_activity_at=last_activity,
        ))

    # Sort: last_activity DESC (None last), then gemeente_code ASC
    out.sort(
        key=lambda s: (
            s.last_activity_at is None,
            -(s.last_activity_at.timestamp() if s.last_activity_at else 0),
            s.gemeente_code,
        )
    )
    return out


@router.get("/{gemeente_code}", response_model=GemeenteDataSourcesPayload)
async def get_gemeente_sources(
    gemeente_code: GemeenteCodePath,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> GemeenteDataSourcesPayload:
    """Single-query merge: DB rows + DATA_SOURCE_KEYS catalog → 3 sections."""
    name_map = await get_gemeente_name_map(db)
    if gemeente_code not in name_map:
        raise HTTPException(status_code=404, detail=f"Gemeente {gemeente_code} not found")

    db_rows = (
        await db.execute(
            select(DataSourceStatus).where(DataSourceStatus.gemeente_code == gemeente_code)
        )
    ).scalars().all()
    by_key: dict[str, DataSourceStatus] = {r.source_key: r for r in db_rows}

    cascade_uploads: list[DataSourceRow] = []
    open_apis: list[DataSourceRow] = []
    paid_integrations: list[DataSourceRow] = []

    catalog_keys = {e.key for e in DATA_SOURCE_KEYS}
    # Log catalog-drift: DB rows present but key not in catalog
    for db_key in by_key:
        if db_key not in catalog_keys:
            logger.warning(
                "Orphaned data_source_status row: gemeente=%s source_key=%s",
                gemeente_code, db_key,
            )

    for entry in DATA_SOURCE_KEYS:
        db_row = by_key.get(entry.key)
        row = _row_from_db(db_row, entry) if db_row else _synthesize_missing_row(entry)
        if entry.source_type == "A":
            cascade_uploads.append(row)
        elif entry.source_type == "B":
            open_apis.append(row)
        else:
            paid_integrations.append(row)

    cascade_uploads = await run_opportunistic_probes(gemeente_code, cascade_uploads, db, name_map)

    return GemeenteDataSourcesPayload(
        gemeente_code=gemeente_code,
        gemeente_naam=name_map[gemeente_code],
        cascade_uploads=cascade_uploads,
        open_apis=open_apis,
        paid_integrations=paid_integrations,
    )


@router.post("/{gemeente_code}/{source_key}/refresh", response_model=DataSourceRow)
async def refresh_source(
    gemeente_code: GemeenteCodePath,
    source_key: str,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> DataSourceRow:
    """Refresh status for one (gemeente_code, source_key) tuple.

    Idempotent: advisory lock guards concurrent calls; compare-and-update means
    unchanged probe results do not bump last_checked.

    Advisory lock is transaction-scoped (pg_try_advisory_xact_lock) — auto-released
    on commit/rollback, no manual cleanup needed.
    """
    entry = get_entry(source_key)
    if entry is None:
        raise HTTPException(status_code=404, detail="Source key not in catalog")

    # Advisory lock — auto-released on transaction end
    lock_key = compute_lock_key(gemeente_code, source_key)
    lock_acquired: bool = bool(
        await db.scalar(
            select(
                func.pg_try_advisory_xact_lock(type_coerce(lock_key, BigInteger()))
            )
        )
    )

    row = await _load_or_create_row(gemeente_code, source_key, db)

    if not lock_acquired:
        # Another request is mid-refresh — return current state, no probe run, no write.
        await db.commit()
        return _row_from_db(row, entry)

    # Dispatch to probe by source_type
    probe_fn = PROBE_REGISTRY[entry.source_type]
    probe_result = await probe_fn(source_key, gemeente_code, db)

    # Compare-and-update: only write (and bump last_checked) when something changed.
    if (
        row.status != probe_result["status"]
        or row.error_message != probe_result["error_message"]
    ):
        row.status = probe_result["status"]
        row.error_message = probe_result["error_message"]
        row.last_checked = datetime.utcnow()

    # Always commit — ensures newly-created rows are persisted even when probe
    # returned the same status as the default ("missing" → "missing" no-op).
    await db.commit()

    return _row_from_db(row, entry)
