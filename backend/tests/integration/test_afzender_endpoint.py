"""M052/S04 — afzender (briefhoofd) GET/PATCH endpoint tests."""

import pytest
from httpx import AsyncClient

from app.auth.jwt import create_access_token


@pytest.mark.asyncio
async def test_get_afzender_defaults_to_org_name(
    async_client: AsyncClient, create_test_user, test_db
):
    user, org = await create_test_user(email="a@x.nl", org_name="Hauzer Vastgoed")
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.get("/api/users/org/afzender", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["bedrijfsnaam"] == "Hauzer Vastgoed"
    assert body["afzender_adres"] is None


@pytest.mark.asyncio
async def test_patch_afzender_persists(
    async_client: AsyncClient, create_test_user, test_db
):
    user, org = await create_test_user(email="b@x.nl", org_name="Hauzer Vastgoed")
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.patch(
        "/api/users/org/afzender",
        headers=headers,
        json={"afzender_adres": "Postbus 412, 5900 AK Venlo", "contact_email": "info@hauzer.nl"},
    )
    assert r.status_code == 200
    assert r.json()["afzender_adres"] == "Postbus 412, 5900 AK Venlo"
    r2 = await async_client.get("/api/users/org/afzender", headers=headers)
    assert r2.json()["contact_email"] == "info@hauzer.nl"
