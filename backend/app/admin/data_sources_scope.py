"""Scope-aware catalog assembly for Landelijk/Provincie/Gemeente data-sources."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.data_source_probes import probe_type_a_for_entity
from app.admin.data_sources_helpers import _synthesize_missing_row
from app.admin.data_sources_schemas import DataSourceRow
from app.policy_documents.data_source_keys import get_entries_by_type


async def cascade_rows_for_scope(
    entity_type: str, entity_code: str, db: AsyncSession
) -> list[DataSourceRow]:
    """Type-A rows for a non-gemeente scope, status computed live (no DataSourceStatus)."""
    rows: list[DataSourceRow] = []
    for entry in get_entries_by_type("A"):
        if entry.level != entity_type:
            continue
        probe = await probe_type_a_for_entity(entry.key, entity_type, entity_code, db)
        row = _synthesize_missing_row(entry)
        row.status = probe["status"]
        row.error_message = probe["error_message"]
        rows.append(row)
    return rows
