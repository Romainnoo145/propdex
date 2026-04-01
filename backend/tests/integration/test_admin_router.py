"""Integration tests for admin router — superuser auth gate and AI usage endpoint."""

import pytest
from httpx import AsyncClient

from app.models.ai_usage_log import AIUsageLog


pytestmark = pytest.mark.anyio


async def _get_auth_token(client: AsyncClient, email: str, password: str) -> str:
    """Log in and return the access_token."""
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


async def test_admin_ai_usage_returns_401_without_auth(async_client: AsyncClient):
    """GET /api/admin/ai-usage without token → 401."""
    resp = await async_client.get("/api/admin/ai-usage")
    assert resp.status_code == 401


async def test_admin_ai_usage_returns_403_for_non_superuser(
    async_client: AsyncClient, create_test_user
):
    """Normal user gets 403 on admin endpoint."""
    user, _ = await create_test_user(email="normal@example.com", password="NormalPass123!")
    token = await _get_auth_token(async_client, "normal@example.com", "NormalPass123!")

    resp = await async_client.get(
        "/api/admin/ai-usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Superuser access required"


async def test_admin_ai_usage_returns_200_for_superuser(
    async_client: AsyncClient, create_test_user
):
    """Superuser gets 200 with empty list when no logs exist."""
    user, _ = await create_test_user(
        email="admin@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin@example.com", "AdminPass123!")

    resp = await async_client.get(
        "/api/admin/ai-usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_admin_ai_usage_filters_by_call_site(
    async_client: AsyncClient, create_test_user, test_db
):
    """Filtering by call_site returns only matching rows."""
    user, org = await create_test_user(
        email="admin2@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin2@example.com", "AdminPass123!")

    # Insert two log rows with different call_sites
    log1 = AIUsageLog(
        call_site="property_analysis",
        model="claude-3-5-sonnet",
        input_tokens=100,
        output_tokens=50,
        total_tokens=150,
        estimated_cost_usd=0.0015,
        user_id=user.id,
        organization_id=org.id,
    )
    log2 = AIUsageLog(
        call_site="document_summary",
        model="claude-3-5-sonnet",
        input_tokens=200,
        output_tokens=100,
        total_tokens=300,
        estimated_cost_usd=0.003,
        user_id=user.id,
        organization_id=org.id,
    )
    test_db.add_all([log1, log2])
    await test_db.commit()

    # Filter by property_analysis
    resp = await async_client.get(
        "/api/admin/ai-usage",
        params={"call_site": "property_analysis"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["call_site"] == "property_analysis"
    assert data[0]["total_tokens"] == 150

    # Without filter — both returned
    resp_all = await async_client.get(
        "/api/admin/ai-usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_all.status_code == 200
    assert len(resp_all.json()) == 2


async def test_admin_ai_usage_summary_returns_aggregated_data(
    async_client: AsyncClient, create_test_user, test_db
):
    """Summary endpoint returns cost_by_day, cost_by_call_site, cost_by_user with aggregations."""
    user, org = await create_test_user(
        email="admin_sum@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin_sum@example.com", "AdminPass123!")

    # Insert usage logs across two call sites
    log1 = AIUsageLog(
        call_site="property_analysis",
        model="claude-3-5-sonnet",
        input_tokens=100,
        output_tokens=50,
        total_tokens=150,
        estimated_cost_usd=0.002,
        user_id=user.id,
        organization_id=org.id,
    )
    log2 = AIUsageLog(
        call_site="property_analysis",
        model="claude-3-5-sonnet",
        input_tokens=200,
        output_tokens=100,
        total_tokens=300,
        estimated_cost_usd=0.004,
        user_id=user.id,
        organization_id=org.id,
    )
    log3 = AIUsageLog(
        call_site="document_summary",
        model="claude-3-5-sonnet",
        input_tokens=50,
        output_tokens=25,
        total_tokens=75,
        estimated_cost_usd=0.001,
        user_id=user.id,
        organization_id=org.id,
    )
    test_db.add_all([log1, log2, log3])
    await test_db.commit()

    resp = await async_client.get(
        "/api/admin/ai-usage/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()

    # Top-level keys
    assert "cost_by_day" in data
    assert "cost_by_call_site" in data
    assert "cost_by_user" in data

    # cost_by_call_site: property_analysis should have 2 calls, document_summary 1
    sites = {s["call_site"]: s for s in data["cost_by_call_site"]}
    assert "property_analysis" in sites
    assert sites["property_analysis"]["total_calls"] == 2
    assert abs(sites["property_analysis"]["total_cost"] - 0.006) < 1e-6
    assert "document_summary" in sites
    assert sites["document_summary"]["total_calls"] == 1

    # cost_by_user: single user with 3 calls
    assert len(data["cost_by_user"]) >= 1
    user_entry = data["cost_by_user"][0]
    assert user_entry["email"] == "admin_sum@example.com"
    assert user_entry["total_calls"] == 3
    assert "total_cost" in user_entry

    # cost_by_day: at least one day entry (today)
    assert len(data["cost_by_day"]) >= 1
    day_entry = data["cost_by_day"][0]
    assert "date" in day_entry
    assert "total_cost" in day_entry
    assert "total_calls" in day_entry


async def test_admin_ai_usage_summary_returns_403_for_non_superuser(
    async_client: AsyncClient, create_test_user
):
    """Normal user gets 403 on summary endpoint."""
    user, _ = await create_test_user(
        email="normal_sum@example.com", password="NormalPass123!"
    )
    token = await _get_auth_token(async_client, "normal_sum@example.com", "NormalPass123!")

    resp = await async_client.get(
        "/api/admin/ai-usage/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Superuser access required"
