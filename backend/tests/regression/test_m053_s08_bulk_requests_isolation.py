"""REGRESSION-CRITICAL — M053/S08 bulk-requests tenant isolation.

GET /api/agents/bulk-requests must return ONLY the calling user's rows.
Before the fix the query was `select(BulkRequest)` with no filter, leaking
every tenant's natural-language portfolio queries (commercial intent).

Drift-detection: remove the `BulkRequest.user_id == user.id` filter in
`app/agents/router.py::list_bulk_requests` → this test fails.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.password import hash_password
from app.models.bulk_request import BulkRequest
from app.models.organization import Organization
from app.models.user import User


@pytest.mark.asyncio
async def test_bulk_requests_only_returns_callers_rows(
    async_client: AsyncClient,
    test_db: AsyncSession,
    auth_headers: dict[str, str],
):
    # Fetch user A — the user created by the auth_headers fixture (default email).
    user_a = (await test_db.execute(select(User).where(User.email == "test@example.com"))).scalar_one()

    # Seed a BulkRequest owned by user A — it MUST appear in the response.
    test_db.add(BulkRequest(user_id=user_a.id, query_text="A's own query", status="pending"))
    await test_db.flush()

    # Create a second user B in a separate org with their own BulkRequest —
    # it must NEVER appear in A's response.
    org_b = Organization(name=f"OrgB-{uuid.uuid4()}")
    test_db.add(org_b)
    await test_db.flush()
    user_b = User(
        email=f"b-{uuid.uuid4()}@example.com",
        hashed_password=hash_password("Whatever#1234"),
        full_name="B",
        organization_id=org_b.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(user_b)
    await test_db.flush()
    test_db.add(BulkRequest(user_id=user_b.id, query_text="B's secret query", status="pending"))
    await test_db.commit()

    resp = await async_client.get("/api/agents/bulk-requests", headers=auth_headers)
    assert resp.status_code == 200
    texts = [r["query_text"] for r in resp.json()["requests"]]
    # Positive assertion: caller's own row is present.
    assert "A's own query" in texts
    # Negative assertion: other tenant's row is absent.
    assert "B's secret query" not in texts
