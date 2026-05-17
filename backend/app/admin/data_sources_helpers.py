"""Shared helpers for data-sources router and probe orchestrator."""

import uuid
from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.data_sources_schemas import Action, DataSourceRow
from app.models.data_source_status import DataSourceStatus, DataSourceStatusValue
from app.services.action_items_catalog import ACTION_ITEMS_CATALOG

_ACTION_LABELS = {
    "view_versions": "Bekijk versies",
    "upload": "Upload",
    "refresh": "Vernieuw status",
    "configure_credential": "Configureer credential",
    "view_action_item": "Bekijk action item",
}


def compute_actions(source_type: str, status: str, source_key: str) -> list[Action]:
    """Return available_actions per the §6 matrix from 02-CONTEXT.md.

    M049/S06: Appends 'view_action_item' action when source_key has an entry in
    ACTION_ITEMS_CATALOG, regardless of source_type / status. The action is always
    enabled — it surfaces the migrated ActionItem content as a row-level button.
    """
    actions: list[Action]
    if source_type == "A":
        if status == "live":
            actions = [
                Action(action="view_versions", enabled=True, label_nl=_ACTION_LABELS["view_versions"]),
                Action(action="upload", enabled=True, label_nl=_ACTION_LABELS["upload"]),
                Action(action="refresh", enabled=True, label_nl=_ACTION_LABELS["refresh"]),
            ]
        else:
            actions = [
                Action(action="upload", enabled=True, label_nl=_ACTION_LABELS["upload"]),
                Action(action="refresh", enabled=True, label_nl=_ACTION_LABELS["refresh"]),
            ]
    elif source_type == "B":
        actions = [
            Action(
                action="refresh", enabled=False,
                label_nl=_ACTION_LABELS["refresh"],
                reason_disabled="Probe wordt later gewired",
            ),
        ]
    else:  # source_type == "C"
        actions = [
            Action(
                action="configure_credential", enabled=True,
                label_nl=_ACTION_LABELS["configure_credential"],
            ),
            Action(
                action="refresh", enabled=False,
                label_nl=_ACTION_LABELS["refresh"],
                reason_disabled="Beschikbaar zodra credential geconfigureerd is",
            ),
        ]

    if source_key in ACTION_ITEMS_CATALOG:
        actions.append(
            Action(
                action="view_action_item",
                enabled=True,
                label_nl=_ACTION_LABELS["view_action_item"],
            )
        )
    return actions


def _row_from_db(db_row: DataSourceStatus, catalog_entry) -> DataSourceRow:  # type: ignore[no-untyped-def]
    return DataSourceRow(
        source_key=db_row.source_key,
        label_nl=catalog_entry.label_nl,
        source_type=catalog_entry.source_type,
        status=cast(DataSourceStatusValue, db_row.status),
        last_checked=db_row.last_checked,
        error_message=db_row.error_message,
        configuratie=db_row.configuratie,
        available_actions=compute_actions(catalog_entry.source_type, db_row.status, catalog_entry.key),
    )


def _synthesize_missing_row(catalog_entry) -> DataSourceRow:  # type: ignore[no-untyped-def]
    return DataSourceRow(
        source_key=catalog_entry.key,
        label_nl=catalog_entry.label_nl,
        source_type=catalog_entry.source_type,
        status=cast(DataSourceStatusValue, "missing"),
        last_checked=None,
        error_message=None,
        configuratie=None,
        available_actions=compute_actions(catalog_entry.source_type, "missing", catalog_entry.key),
    )


async def _load_or_create_row(
    gemeente_code: str,
    source_key: str,
    db: AsyncSession,
) -> DataSourceStatus:
    """Get existing data_source_status row, or create an in-memory new one.

    New rows are db.add()'ed but NOT flushed here — the outer commit persists
    them. id is set explicitly via uuid4() so no server-side gen is needed before
    _row_from_db serialises the row.
    """
    existing = await db.scalar(
        select(DataSourceStatus)
        .where(DataSourceStatus.gemeente_code == gemeente_code)
        .where(DataSourceStatus.source_key == source_key)
    )
    if existing is not None:
        return existing
    row = DataSourceStatus(
        id=uuid.uuid4(),
        gemeente_code=gemeente_code,
        source_key=source_key,
        status="missing",
        last_checked=None,
        error_message=None,
        configuratie=None,
    )
    db.add(row)
    return row
