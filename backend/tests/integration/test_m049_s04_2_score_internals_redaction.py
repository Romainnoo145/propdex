"""Integration tests for Phase 04.2 — expose_score_internals dependency wiring.

Asserts that the per-org flag flows correctly from request → dependency →
service kwarg. A regression here is the kind of bug that silently exposes
the weight table again after a future refactor — so we test the wiring
explicitly, not just the redaction helper.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.models.organization import Organization
from app.scans.schemas import ScanResultsResponse

_SVC = "app.scans.results_router"


async def _login_token(client: AsyncClient, email: str) -> str:
    resp = await client.post(
        "/auth/login", json={"email": email, "password": "TestPass123!"}
    )
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_results_endpoint_passes_expose_internals_false_by_default(
    async_client: AsyncClient,
    create_test_user,
    test_db,
):
    """New orgs default to expose_score_internals=False (redact)."""
    user, org = await create_test_user(email="redact_default@example.com")
    token = await _login_token(async_client, "redact_default@example.com")

    mock_results = ScanResultsResponse(
        scan_id=uuid.uuid4(),
        gemeente_naam="Amsterdam",
        scan_date="2024-01-01T00:00:00",
        parcels_total=0,
        total=0,
        total_unfiltered=0,
        offset=0,
        limit=50,
        results=[],
    )

    with patch(
        f"{_SVC}.results_service.list_results",
        new_callable=AsyncMock,
        return_value=mock_results,
    ) as mock:
        resp = await async_client.get(
            f"/api/scans/{uuid.uuid4()}/results",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert mock.call_args.kwargs["expose_internals"] is False


@pytest.mark.asyncio
async def test_results_endpoint_passes_expose_internals_true_for_paying_org(
    async_client: AsyncClient,
    create_test_user,
    test_db,
):
    """Org with expose_score_internals=True receives the unredacted breakdown."""
    user, org = await create_test_user(email="redact_paying@example.com")
    await test_db.execute(
        update(Organization)
        .where(Organization.id == org.id)
        .values(expose_score_internals=True)
    )
    await test_db.commit()
    token = await _login_token(async_client, "redact_paying@example.com")

    mock_results = ScanResultsResponse(
        scan_id=uuid.uuid4(),
        gemeente_naam="Amsterdam",
        scan_date="2024-01-01T00:00:00",
        parcels_total=0,
        total=0,
        total_unfiltered=0,
        offset=0,
        limit=50,
        results=[],
    )

    with patch(
        f"{_SVC}.results_service.list_results",
        new_callable=AsyncMock,
        return_value=mock_results,
    ) as mock:
        resp = await async_client.get(
            f"/api/scans/{uuid.uuid4()}/results",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert mock.call_args.kwargs["expose_internals"] is True
