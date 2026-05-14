"""M049/S02 admin data-sources router (Wave-1: GET endpoints + POST stub).

Plan 02 wires the POST refresh probe-registry + advisory lock.
"""
import logging
from collections import defaultdict
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.data_sources_schemas import (
    Action,
    DataSourceRow,
    GemeenteDataSourcesPayload,
    GemeenteSummary,
)
from app.auth.dependencies import get_current_superuser
from app.core.database import get_db
from app.models.data_source_status import DataSourceStatus
from app.models.user import User
from app.policy_documents.data_source_keys import DATA_SOURCE_KEYS, get_entry
from app.services.gemeente_name_lookup import get_gemeente_name_map

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/data-sources",
    tags=["Admin / Data Sources"],
)

GemeenteCodePath = Annotated[str, Path(pattern=r"^GM\d{4}$")]


_ACTION_LABELS = {
    "view_versions": "Bekijk versies",
    "upload": "Upload",
    "refresh": "Vernieuw status",
    "configure_credential": "Configureer credential",
}


def compute_actions(source_type: str, status: str) -> list[Action]:
    """Return available_actions per the §6 matrix from 02-CONTEXT.md."""
    if source_type == "A":
        if status == "live":
            return [
                Action(action="view_versions", enabled=True, label_nl=_ACTION_LABELS["view_versions"]),
                Action(action="upload", enabled=True, label_nl=_ACTION_LABELS["upload"]),
                Action(action="refresh", enabled=True, label_nl=_ACTION_LABELS["refresh"]),
            ]
        return [
            Action(action="upload", enabled=True, label_nl=_ACTION_LABELS["upload"]),
            Action(action="refresh", enabled=True, label_nl=_ACTION_LABELS["refresh"]),
        ]
    if source_type == "B":
        return [
            Action(
                action="refresh", enabled=False,
                label_nl=_ACTION_LABELS["refresh"],
                reason_disabled="Probe wordt later gewired",
            ),
        ]
    # source_type == "C"
    return [
        Action(
            action="configure_credential", enabled=False,
            label_nl=_ACTION_LABELS["configure_credential"],
            reason_disabled="Beschikbaar vanaf S05",
        ),
        Action(
            action="refresh", enabled=False,
            label_nl=_ACTION_LABELS["refresh"],
            reason_disabled="Beschikbaar vanaf S05",
        ),
    ]


def _row_from_db(db_row: DataSourceStatus, catalog_entry) -> DataSourceRow:  # type: ignore[no-untyped-def]
    return DataSourceRow(
        source_key=db_row.source_key,
        label_nl=catalog_entry.label_nl,
        source_type=catalog_entry.source_type,
        status=db_row.status,
        last_checked=db_row.last_checked,
        error_message=db_row.error_message,
        configuratie=db_row.configuratie,
        available_actions=compute_actions(catalog_entry.source_type, db_row.status),
    )


def _synthesize_missing_row(catalog_entry) -> DataSourceRow:  # type: ignore[no-untyped-def]
    return DataSourceRow(
        source_key=catalog_entry.key,
        label_nl=catalog_entry.label_nl,
        source_type=catalog_entry.source_type,
        status="missing",
        last_checked=None,
        error_message=None,
        configuratie=None,
        available_actions=compute_actions(catalog_entry.source_type, "missing"),
    )


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
        counts: dict[str, int] = {"live": 0, "broken": 0, "missing": 0, "not_applicable": 0}
        last_activity: datetime | None = None
        for r in rs:
            counts[r.status] = counts.get(r.status, 0) + 1
            if r.last_checked and (last_activity is None or r.last_checked > last_activity):
                last_activity = r.last_checked
        out.append(GemeenteSummary(
            gemeente_code=code,
            gemeente_naam=name_map.get(code, code),
            total_sources=len(rs),
            status_counts=counts,  # type: ignore[arg-type]
            last_activity_at=last_activity,
        ))

    # Sort: last_activity DESC (None last), then gemeente_code ASC
    out.sort(
        key=lambda s: (
            s.last_activity_at is None,
            -((s.last_activity_at or datetime.min).timestamp()),
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
    """Wave-1 stub. Plan 02 implements advisory-lock + probe-registry."""
    entry = get_entry(source_key)
    if entry is None:
        raise HTTPException(status_code=404, detail="Source key not in catalog")
    raise HTTPException(status_code=501, detail="POST refresh implementation pending (M049/S02 Plan 02)")
