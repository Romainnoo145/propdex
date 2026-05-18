"""M050/S03 — F7: concurrent persists dedup via ARQ ``_job_id``.

Two ``asyncio.gather``-ed POSTs on the same ``(org, parcel)`` both return 200,
but ``enqueue_job`` returns a real job object on the first call and ``None`` on
the second (simulating ARQ's ``_job_id`` dedup-collapse guarantee). The
``_job_id`` string is identical across both calls.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth.jwt import create_access_token
from app.auth.password import hash_password
from app.core.config import settings
from app.main import app
from app.models.organization import Organization
from app.models.user import User

PARCEL_ID = "NL.IMKAD.TEST.0003"


@pytest.fixture
def _mock_arq_pool_dedup_simulation():
    """enqueue_job returns Job once, then None forever (ARQ _job_id dedup)."""
    previous = getattr(app.state, "arq_pool", None)
    mock_pool = AsyncMock()
    # AsyncMock side_effect with mix of values is supported via side_effect=list
    mock_pool.enqueue_job = AsyncMock(side_effect=[MagicMock(), None])
    app.state.arq_pool = mock_pool
    yield mock_pool
    app.state.arq_pool = previous


async def _seed_org_and_user(test_db) -> tuple[Organization, User]:
    org = Organization(name=f"TestOrg-{uuid.uuid4()}")
    test_db.add(org)
    await test_db.flush()
    user = User(
        email=f"u{uuid.uuid4().hex[:8]}@test.com",
        hashed_password=hash_password("TestPass123!"),
        full_name="Test User",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(user)
    await test_db.commit()
    return org, user


def _stub_fetch_and_persist(
    monkeypatch: pytest.MonkeyPatch, return_value: list[Any] | None = None
) -> None:
    async def _fake(**kwargs):
        return return_value if return_value is not None else []

    from app.scans import brk_router
    from app.services import brk_fetch_service

    monkeypatch.setattr(brk_fetch_service, "fetch_and_persist", _fake)
    monkeypatch.setattr(brk_router, "fetch_and_persist", _fake)


@pytest.mark.asyncio
async def test_concurrent_persists_dedup_via_arq_job_id(
    test_db,
    async_client,
    monkeypatch: pytest.MonkeyPatch,
    _mock_arq_pool_dedup_simulation: AsyncMock,
) -> None:
    """F7: asyncio.gather 2 POSTs → both 200, ``_job_id`` identical, dedup-collapse."""
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)

    org, user = await _seed_org_and_user(test_db)
    _stub_fetch_and_persist(monkeypatch, return_value=[])

    headers = {"Authorization": f"Bearer {create_access_token(str(user.id), str(org.id))}"}

    # Fire 2 concurrent POSTs on the same (org, parcel)
    coros = [
        async_client.post(f"/api/parcels/{PARCEL_ID}/brk/persist", headers=headers),
        async_client.post(f"/api/parcels/{PARCEL_ID}/brk/persist", headers=headers),
    ]
    responses = await asyncio.gather(*coros)

    # Both return 200 (D7 best-effort + ARQ dedup is transparent at HTTP layer)
    assert all(r.status_code == 200 for r in responses), [r.status_code for r in responses]

    # Both enqueue attempts were awaited
    enqueue_mock = _mock_arq_pool_dedup_simulation.enqueue_job
    assert enqueue_mock.await_count == 2

    # _job_id identical across both calls (deterministic format)
    expected_job_id = f"rescore:{org.id}:{PARCEL_ID}"
    assert all(
        c.kwargs["_job_id"] == expected_job_id for c in enqueue_mock.call_args_list
    )

    # One call returned a Job, the other returned None — dedup-collapse simulated.
    returned = enqueue_mock.side_effect  # already exhausted; re-mock to verify shape
    # Verify the side_effect list shape (Job, then None) was honoured.
    # AsyncMock pops side_effect entries one-by-one; assert it was exhausted
    # (StopIteration on a 3rd call would mean side_effect ran out — what we want).
    with pytest.raises(StopAsyncIteration):
        await enqueue_mock()
    # Reset for cleanup safety (test_db teardown doesn't touch the mock).
    _ = returned
