"""Integration tests: Phase 04.1 — Probe Orchestrator Rescore Wire-up (INT-04).

Tests T4–T6: data_source_probe_orchestrator.run_opportunistic_probes enqueues
rescore_parcels_for_document on missing→live transitions, gated by
CASCADE_RESCORE_SOURCE_KEYS.
"""
import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.data_source_probe_orchestrator import run_opportunistic_probes
from app.admin.data_sources_schemas import DataSourceRow
from app.jobs.rescore_cascade_job import CASCADE_RESCORE_SOURCE_KEYS
from app.models.policy_document import PolicyDocument

# ---------------------------------------------------------------------------
# T4 — probe missing→live for woonvisie enqueues rescore once
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_probe_missing_to_live_woonvisie_enqueues_rescore(
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """Probe that flips woonvisie from missing→live enqueues rescore_parcels_for_document exactly once."""
    user, org = await create_test_user(email="probe_t4@test.example", is_superuser=True)

    # Seed a woonvisie PolicyDocument — probe_type_a_cascade checks for this
    doc_id = uuid.uuid4()
    test_db.add(PolicyDocument(
        id=doc_id,
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="woonvisie",
        is_global=True,
        filename="woonvisie_t4.pdf",
        content_type="application/pdf",
        file_data=b"x",
        file_size=1,
        uploaded_by_user_id=user.id,
        version_number=1,
    ))
    await test_db.commit()

    # Build DataSourceRow with status='missing' to trigger the probe
    missing_row = DataSourceRow(
        source_key="woonvisie",
        label_nl="Woonvisie",
        source_type="A",
        status="missing",
        available_actions=[],
    )

    mock_pool = AsyncMock()

    await run_opportunistic_probes(
        gemeente_code="GM0983",
        cascade_uploads=[missing_row],
        db=test_db,
        name_map={},
        arq_pool=mock_pool,
    )

    # Should have enqueued rescore exactly once
    rescore_calls = [
        c for c in mock_pool.enqueue_job.call_args_list
        if c.args[0] == "rescore_parcels_for_document"
    ]
    assert len(rescore_calls) == 1, (
        f"Expected exactly 1 rescore enqueue for woonvisie missing→live; got: {rescore_calls}"
    )
    assert rescore_calls[0].kwargs.get("document_id") == str(doc_id), (
        f"Wrong document_id in rescore enqueue: {rescore_calls[0].kwargs}"
    )


# ---------------------------------------------------------------------------
# T5 — probe already live → no rescore enqueue
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_probe_already_live_no_rescore(
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """When woonvisie row is already 'live', no missing→live transition happens
    and rescore_parcels_for_document must NOT be enqueued."""
    user, org = await create_test_user(email="probe_t5@test.example", is_superuser=True)
    await test_db.commit()

    # Row already live — no transition will happen
    live_row = DataSourceRow(
        source_key="woonvisie",
        label_nl="Woonvisie",
        source_type="A",
        status="live",
        available_actions=[],
    )

    mock_pool = AsyncMock()

    await run_opportunistic_probes(
        gemeente_code="GM0983",
        cascade_uploads=[live_row],
        db=test_db,
        name_map={},
        arq_pool=mock_pool,
    )

    # Function returns early when no missing rows — enqueue_job never called
    rescore_calls = [
        c for c in mock_pool.enqueue_job.call_args_list
        if c.args[0] == "rescore_parcels_for_document"
    ]
    assert len(rescore_calls) == 0, (
        f"rescore must NOT be called for already-live row; got: {rescore_calls}"
    )


# ---------------------------------------------------------------------------
# T6 — probe missing→live for non-woonvisie → no rescore enqueue
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_probe_non_woonvisie_missing_to_live_no_rescore(
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """Probe that flips welstandsnota from missing→live must NOT enqueue rescore
    (welstandsnota is not in CASCADE_RESCORE_SOURCE_KEYS)."""
    user, org = await create_test_user(email="probe_t6@test.example", is_superuser=True)

    # Pre-condition: welstandsnota is not in CASCADE_RESCORE_SOURCE_KEYS
    assert "welstandsnota" not in CASCADE_RESCORE_SOURCE_KEYS, (
        "Test pre-condition violated: welstandsnota should not be in CASCADE_RESCORE_SOURCE_KEYS"
    )

    # Seed a PolicyDocument for welstandsnota so the probe returns 'live'
    test_db.add(PolicyDocument(
        id=uuid.uuid4(),
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="welstandsnota",
        is_global=True,
        filename="welstandsnota_t6.pdf",
        content_type="application/pdf",
        file_data=b"x",
        file_size=1,
        uploaded_by_user_id=user.id,
        version_number=1,
    ))
    await test_db.commit()

    missing_row = DataSourceRow(
        source_key="welstandsnota",
        label_nl="Welstandsnota",
        source_type="A",
        status="missing",
        available_actions=[],
    )

    mock_pool = AsyncMock()

    await run_opportunistic_probes(
        gemeente_code="GM0983",
        cascade_uploads=[missing_row],
        db=test_db,
        name_map={},
        arq_pool=mock_pool,
    )

    rescore_calls = [
        c for c in mock_pool.enqueue_job.call_args_list
        if c.args[0] == "rescore_parcels_for_document"
    ]
    assert len(rescore_calls) == 0, (
        f"rescore must NOT be called for non-CASCADE key welstandsnota; got: {rescore_calls}"
    )
