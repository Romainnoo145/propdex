"""Endpoint-tests GET /api/reports-v2/dakkapel/{parcel_id} (M055/S02)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dakkapel_endpoint_returns_report(
    async_client: AsyncClient, auth_headers: dict, seed_parcel
) -> None:
    parcel = await seed_parcel(gemeente_code="0983", bestemmingen=[{"type": "wonen"}])
    resp = await async_client.get(
        f"/api/reports-v2/dakkapel/{parcel.parcel_id}", headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["perceel"]["gemeente_code"] == "0983"
    assert "mits" in body["oordeel"]["achterdakvlak"].lower()
    assert isinstance(body["jurisprudentie"], list)


@pytest.mark.asyncio
async def test_dakkapel_endpoint_unknown_parcel_404(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    resp = await async_client.get("/api/reports-v2/dakkapel/NOPE", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_dakkapel_endpoint_requires_auth(
    async_client: AsyncClient, seed_parcel
) -> None:
    parcel = await seed_parcel(gemeente_code="0983")
    resp = await async_client.get(f"/api/reports-v2/dakkapel/{parcel.parcel_id}")
    assert resp.status_code in (401, 403)
