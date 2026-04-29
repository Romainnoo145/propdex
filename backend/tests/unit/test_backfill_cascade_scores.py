"""Unit test voor backfill_cascade_scores._load_woonvisie_payload.

Bug: cache_stmt filterde niet op schema_version → na Phase-6 schema bump
bleef tool de stale schema_version=1 row laden (zonder algemeen_citaat /
wijk_policies) → backfill zette lege Phase-6 dict in scan_results.

Fix: query moet expliciet `schema_version == SCHEMA_VERSION` eisen, anders
None retourneren (operator runt eerst rescore_cascade_job).
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.ai.factor_extraction_schemas import SCHEMA_VERSION


def _statement_text(stmt) -> str:
    """Render SQLAlchemy Core statement to a literal SQL string for assertion."""
    return str(stmt.compile(compile_kwargs={"literal_binds": True}))


@pytest.mark.asyncio
async def test_load_woonvisie_payload_filters_on_current_schema_version() -> None:
    """Cache-lookup MUST include schema_version=SCHEMA_VERSION.

    Without this filter, stale rows from before a schema bump (Phase 6 added
    wijk_policies + algemeen_citaat) would silently feed an old payload back
    into compute_score_v3, producing an empty dict-shaped waarde and breaking
    the popup citation in PotentieLayer.
    """
    from app.tools import backfill_cascade_scores

    # Arrange: fake document so first lookup succeeds, then capture cache_stmt.
    fake_doc = MagicMock()
    fake_doc.id = uuid.uuid4()

    captured_statements: list[object] = []

    async def fake_execute(stmt):  # noqa: ANN001 — match SQLAlchemy duck-shape
        captured_statements.append(stmt)
        result = MagicMock()
        if len(captured_statements) == 1:
            # doc_stmt → return our fake document
            result.scalar_one_or_none = MagicMock(return_value=fake_doc)
        else:
            # cache_stmt → no rows (we only assert WHERE-clause shape here)
            result.scalar_one_or_none = MagicMock(return_value=None)
        return result

    fake_session = MagicMock()
    fake_session.execute = AsyncMock(side_effect=fake_execute)

    fake_session_factory = MagicMock()
    fake_session_factory.return_value.__aenter__ = AsyncMock(return_value=fake_session)
    fake_session_factory.return_value.__aexit__ = AsyncMock(return_value=None)

    with patch.object(backfill_cascade_scores, "async_session_factory", fake_session_factory):
        result = await backfill_cascade_scores._load_woonvisie_payload(
            gemeente_code="GM0983",
            org_id=uuid.uuid4(),
        )

    assert result is None, "Empty cache should return None, not a default-filled payload"
    assert len(captured_statements) == 2, "Expected doc_stmt + cache_stmt"

    cache_sql = _statement_text(captured_statements[1])
    assert "schema_version" in cache_sql, (
        "cache_stmt MUST filter on schema_version to skip stale rows. Compiled SQL: "
        + cache_sql
    )
    assert f"schema_version = {SCHEMA_VERSION}" in cache_sql, (
        f"cache_stmt MUST pin schema_version to current SCHEMA_VERSION={SCHEMA_VERSION}. "
        f"Compiled SQL: {cache_sql}"
    )
