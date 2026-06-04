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


@pytest.mark.asyncio
async def test_afzender_is_org_scoped(
    async_client: AsyncClient, create_test_user, test_db
):
    user_a, org_a = await create_test_user(email="a@orga.nl", org_name="Org A Vastgoed")
    user_b, org_b = await create_test_user(email="b@orgb.nl", org_name="Org B Vastgoed")
    token_a = create_access_token(str(user_a.id), str(org_a.id))
    token_b = create_access_token(str(user_b.id), str(org_b.id))
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Org A sets its afzender.
    r_patch = await async_client.patch(
        "/api/users/org/afzender",
        headers=headers_a,
        json={"contact_email": "a@orga.nl"},
    )
    assert r_patch.status_code == 200

    # Org B must not see org A's data.
    r_b = await async_client.get("/api/users/org/afzender", headers=headers_b)
    assert r_b.status_code == 200
    body_b = r_b.json()
    assert body_b["contact_email"] is None
    assert body_b["bedrijfsnaam"] == "Org B Vastgoed"
