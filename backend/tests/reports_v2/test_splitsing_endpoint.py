"""Endpoint-tests voor GET /api/reports-v2/splitsing/{parcel_id} (M055/S01).

Fixture-deviantie t.o.v. brief: `client` heet in dit project `async_client`
(conform root conftest en alle andere integration-tests).
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_splitsing_endpoint_returns_report(
    async_client: AsyncClient,
    auth_headers: dict,
    seed_parcel,
    seed_huisvestingsverordening,
) -> None:
    parcel = await seed_parcel(
        gemeente_code="0983",
        buurt_code="BU09831401",
        bestemmingen=[{"type": "wonen"}],
    )
    await seed_huisvestingsverordening(
        gemeente_code="0983", vergunningplichten=["splitsing"]
    )

    resp = await async_client.get(
        f"/api/reports-v2/splitsing/{parcel.parcel_id}", headers=auth_headers
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["perceel"]["gemeente_code"] == "0983"
    assert body["beleid"]["vergunningplichten"] == ["splitsing"]
    assert isinstance(body["jurisprudentie"], list)


@pytest.mark.asyncio
async def test_splitsing_endpoint_unknown_parcel_404(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    resp = await async_client.get("/api/reports-v2/splitsing/NOPE", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_splitsing_endpoint_requires_auth(
    async_client: AsyncClient, seed_parcel
) -> None:
    parcel = await seed_parcel(gemeente_code="0983")
    resp = await async_client.get(f"/api/reports-v2/splitsing/{parcel.parcel_id}")
    assert resp.status_code in (401, 403)
