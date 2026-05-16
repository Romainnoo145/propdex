"""Integration tests: Phase 04.1 — Manual Upload Rescore Wire-up (INT-04).

Tests T1–T3: upload route enqueues both document_summary_job AND
rescore_parcels_for_document via the request.app.state.arq_pool.
"""
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.main import app

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
    # Set arq_pool directly on app.state (httpx AsyncClient wraps ASGI transport,
    # not FastAPI app directly — use app.state instead of async_client.app)
    original_arq_pool = getattr(app.state, "arq_pool", None)
    app.state.arq_pool = mock_pool
    try:
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
    finally:
        app.state.arq_pool = original_arq_pool


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
    original_arq_pool = getattr(app.state, "arq_pool", None)
    app.state.arq_pool = mock_pool
    try:
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
    finally:
        app.state.arq_pool = original_arq_pool


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
    original_arq_pool = getattr(app.state, "arq_pool", None)
    app.state.arq_pool = mock_pool
    try:
        pdf_bytes = b"%PDF-1.4 fake"
        resp = await async_client.post(
            "/api/policy-documents/gemeente/GM0983?source_key=woonvisie",
            files={"file": ("woonvisie_fail.pdf", pdf_bytes, "application/pdf")},
            headers=_superuser_headers(user.id, org.id),
        )
        # Despite enqueue failure, upload must succeed
        assert resp.status_code == 201, resp.text
        assert resp.json()["id"] is not None
    finally:
        app.state.arq_pool = original_arq_pool
