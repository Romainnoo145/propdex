"""Integration tests for POST /api/parcels/favorites/bulk endpoint."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.parcel_favorite import ParcelFavorite


async def _get_auth_token(
    client: AsyncClient,
    email: str = "test@example.com",
    password: str = "TestPass123!",
) -> str:
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_bulk_favorites_creates(async_client: AsyncClient, create_test_user, test_db):
    """Bulk create favorites for new parcel_ids."""
    user, org = await create_test_user()
    token = await _get_auth_token(async_client, user.email)

    response = await async_client.post(
        "/api/parcels/favorites/bulk",
        json={
            "parcel_ids": ["BULK-001", "BULK-002", "BULK-003"],
            "gemeente_naam": "Venlo",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["created"] == 3
    assert data["existing"] == 0
    assert data["failed"] == 0

    # Verify in DB
    result = await test_db.execute(
        select(ParcelFavorite).where(
            ParcelFavorite.user_id == user.id,
            ParcelFavorite.parcel_id.in_(["BULK-001", "BULK-002", "BULK-003"]),
        )
    )
    favorites = result.scalars().all()
    assert len(favorites) == 3
    assert all(f.gemeente_naam == "Venlo" for f in favorites)
    assert all(f.pipeline_stage == "Gesignaleerd" for f in favorites)


@pytest.mark.asyncio
async def test_bulk_favorites_idempotent(async_client: AsyncClient, create_test_user, test_db):
    """Repeat bulk create returns existing count, doesn't duplicate."""
    user, org = await create_test_user()
    token = await _get_auth_token(async_client, user.email)
    headers = {"Authorization": f"Bearer {token}"}

    # First call
    resp1 = await async_client.post(
        "/api/parcels/favorites/bulk",
        json={"parcel_ids": ["IDEM-001", "IDEM-002"]},
        headers=headers,
    )
    assert resp1.status_code == 201
    assert resp1.json()["created"] == 2

    # Second call — same IDs
    resp2 = await async_client.post(
        "/api/parcels/favorites/bulk",
        json={"parcel_ids": ["IDEM-001", "IDEM-002", "IDEM-003"]},
        headers=headers,
    )
    assert resp2.status_code == 201
    data2 = resp2.json()
    assert data2["existing"] == 2
    assert data2["created"] == 1  # only IDEM-003 is new


@pytest.mark.asyncio
async def test_bulk_favorites_deduplicates_input(async_client: AsyncClient, create_test_user):
    """Duplicate parcel_ids in input are deduplicated."""
    user, org = await create_test_user()
    token = await _get_auth_token(async_client, user.email)

    response = await async_client.post(
        "/api/parcels/favorites/bulk",
        json={"parcel_ids": ["DUP-001", "DUP-001", "DUP-001"]},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["created"] == 1
    assert data["existing"] == 0


@pytest.mark.asyncio
async def test_bulk_favorites_empty_list(async_client: AsyncClient, create_test_user):
    """Empty parcel_ids list returns zeros."""
    user, org = await create_test_user()
    token = await _get_auth_token(async_client, user.email)

    response = await async_client.post(
        "/api/parcels/favorites/bulk",
        json={"parcel_ids": []},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["created"] == 0
    assert data["existing"] == 0


@pytest.mark.asyncio
async def test_bulk_favorites_requires_auth(async_client: AsyncClient):
    """Bulk endpoint requires auth."""
    response = await async_client.post(
        "/api/parcels/favorites/bulk",
        json={"parcel_ids": ["TEST-001"]},
    )
    assert response.status_code == 401
