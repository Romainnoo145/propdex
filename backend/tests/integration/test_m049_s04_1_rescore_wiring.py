"""Integration tests: Phase 04.1 — Manual Upload Rescore Wire-up (INT-04).

Tests T1–T3: upload route enqueues both document_summary_job AND rescore_parcels_for_document
Tests T4–T6: probe orchestrator enqueues rescore on missing→live for CASCADE_RESCORE_SOURCE_KEYS only
"""
import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.data_source_probe_orchestrator import run_opportunistic_probes
from app.admin.data_sources_schemas import DataSourceRow
from app.auth.jwt import create_access_token
from app.jobs.rescore_cascade_job import CASCADE_RESCORE_SOURCE_KEYS
from app.models.policy_document import PolicyDocument


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _superuser_headers(user_id, org_id) -> dict:
    token = create_access_token(str(user_id), str(org_id))
    return {"Authorization": f"Bearer {token}"}


async def _make_vendor_user_and_org(db: AsyncSession, email: str):
    """Create a user + org and return (user, org). Uses direct model creation."""
    from app.models.organization import Organization
    from app.models.user import User

    org = Organization(name=f"Vendor Org ({email})")
    db.add(org)
    await db.flush()

    user = User(
        email=email,
        hashed_password="hashed",
        full_name="Vendor Admin",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=True,
    )
    db.add(user)
    await db.flush()
    return user, org


# ---------------------------------------------------------------------------
# T1 — woonvisie upload enqueues both jobs
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_woonvisie_upload_enqueues_both_jobs(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST upload with source_key=woonvisie + PDF: both document_summary_job AND
    rescore_parcels_for_document are enqueued via the arq_pool."""
    from app.core.config import settings

    user, org = await _make_vendor_user_and_org(test_db, "upload_t1@test.example")
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", org.id)
    await test_db.commit()

    mock_pool = AsyncMock()
    monkeypatch.setattr(async_client.app.state, "arq_pool", mock_pool)

    pdf_bytes = b"%PDF-1.4 fake"
    resp = await async_client.post(
        "/api/policy-documents/gemeente/GM0983?source_key=woonvisie",
        files={"file": ("woonvisie.pdf", pdf_bytes, "application/pdf")},
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 201, resp.text

    doc_id = resp.json()["id"]

    # Extract all enqueue_job call arg sets
    call_jobs = [call.args[0] for call in mock_pool.enqueue_job.call_args_list]
    assert "document_summary_job" in call_jobs, (
        f"Expected document_summary_job to be enqueued; got: {call_jobs}"
    )
    assert "rescore_parcels_for_document" in call_jobs, (
        f"Expected rescore_parcels_for_document to be enqueued; got: {call_jobs}"
    )

    # Verify rescore was called with correct document_id kwarg
    rescore_calls = [
        c for c in mock_pool.enqueue_job.call_args_list
        if c.args[0] == "rescore_parcels_for_document"
    ]
    assert len(rescore_calls) == 1
    assert rescore_calls[0].kwargs.get("document_id") == doc_id, (
        f"rescore_parcels_for_document called with wrong document_id: {rescore_calls[0].kwargs}"
    )


# ---------------------------------------------------------------------------
# T2 — non-woonvisie upload enqueues summary only
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_non_woonvisie_upload_enqueues_summary_only(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST upload with source_key=welstandsnota: only document_summary_job is enqueued.
    rescore_parcels_for_document must NOT be called."""
    from app.core.config import settings

    user, org = await _make_vendor_user_and_org(test_db, "upload_t2@test.example")
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", org.id)
    await test_db.commit()

    mock_pool = AsyncMock()
    monkeypatch.setattr(async_client.app.state, "arq_pool", mock_pool)

    pdf_bytes = b"%PDF-1.4 fake"
    resp = await async_client.post(
        "/api/policy-documents/gemeente/GM0983?source_key=welstandsnota",
        files={"file": ("welstandsnota.pdf", pdf_bytes, "application/pdf")},
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 201, resp.text

    call_jobs = [call.args[0] for call in mock_pool.enqueue_job.call_args_list]
    assert "document_summary_job" in call_jobs, (
        f"Expected document_summary_job to be enqueued; got: {call_jobs}"
    )

    rescore_calls = [c for c in mock_pool.enqueue_job.call_args_list
                     if c.args[0] == "rescore_parcels_for_document"]
    assert len(rescore_calls) == 0, (
        f"rescore_parcels_for_document must NOT be called for welstandsnota; got: {rescore_calls}"
    )


# ---------------------------------------------------------------------------
# T3 — upload handles rescore enqueue failure gracefully
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upload_rescore_enqueue_failure_graceful(
    async_client: AsyncClient,
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If rescore_parcels_for_document enqueue raises, the upload still returns 201
    and the document is stored in the DB."""
    from app.core.config import settings

    user, org = await _make_vendor_user_and_org(test_db, "upload_t3@test.example")
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", org.id)
    await test_db.commit()

    # Mock: succeed for summary_job, fail for rescore
    async def _side_effect(job_name, *args, **kwargs):
        if job_name == "rescore_parcels_for_document":
            raise RuntimeError("ARQ connection lost")
        # document_summary_job: succeed silently

    mock_pool = AsyncMock()
    mock_pool.enqueue_job.side_effect = _side_effect
    monkeypatch.setattr(async_client.app.state, "arq_pool", mock_pool)

    pdf_bytes = b"%PDF-1.4 fake"
    resp = await async_client.post(
        "/api/policy-documents/gemeente/GM0983?source_key=woonvisie",
        files={"file": ("woonvisie_fail.pdf", pdf_bytes, "application/pdf")},
        headers=_superuser_headers(user.id, org.id),
    )
    # Despite enqueue failure, upload must succeed
    assert resp.status_code == 201, resp.text
    assert resp.json()["id"] is not None


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

    result = await run_opportunistic_probes(
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
