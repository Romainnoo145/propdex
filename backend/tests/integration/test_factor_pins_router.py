"""PIN-03 + SC#3 + SC#9 + SC#10 stub — REST endpoints for factor pins.

FAILS until Plan 02 creates backend/app/users/factor_pins/router.py
AND mounts it in backend/app/main.py.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_pins_requires_auth(async_client: AsyncClient) -> None:
    resp = await async_client.get("/api/users/me/factor-pins?category=potentie")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_pins_returns_empty_for_new_user(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    resp = await async_client.get(
        "/api/users/me/factor-pins?category=potentie", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_post_pin_creates_with_position_zero(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    resp = await async_client.post(
        "/api/users/me/factor-pins",
        headers=auth_headers,
        json={"category": "potentie", "factor_key": "vrije_grond"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["category"] == "potentie"
    assert body["factor_key"] == "vrije_grond"
    assert body["position"] == 0
    assert "id" in body
    assert "created_at" in body


@pytest.mark.asyncio
async def test_post_duplicate_pin_returns_409(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    await async_client.post(
        "/api/users/me/factor-pins",
        headers=auth_headers,
        json={"category": "potentie", "factor_key": "bestemming"},
    )
    resp = await async_client.post(
        "/api/users/me/factor-pins",
        headers=auth_headers,
        json={"category": "potentie", "factor_key": "bestemming"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_post_fifth_pin_returns_400_max_pins_reached(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    keys = [
        "vrije_grond", "optoppotentie", "bestemming", "leegstand",
    ]
    for key in keys:
        r = await async_client.post(
            "/api/users/me/factor-pins",
            headers=auth_headers,
            json={"category": "potentie", "factor_key": key},
        )
        assert r.status_code == 201, r.text
    # 5th pin
    resp = await async_client.post(
        "/api/users/me/factor-pins",
        headers=auth_headers,
        json={"category": "potentie", "factor_key": "funda_frictie"},
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["code"] == "MAX_PINS_REACHED"


@pytest.mark.asyncio
async def test_delete_pin_returns_204(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    post = await async_client.post(
        "/api/users/me/factor-pins",
        headers=auth_headers,
        json={"category": "potentie", "factor_key": "vrije_grond"},
    )
    pin_id = post.json()["id"]
    resp = await async_client.delete(
        f"/api/users/me/factor-pins/{pin_id}", headers=auth_headers
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_pin_persists_across_sessions(
    async_client: AsyncClient, auth_headers: dict
) -> None:
    """SC#9 backend portion: POST then GET round-trip."""
    await async_client.post(
        "/api/users/me/factor-pins",
        headers=auth_headers,
        json={"category": "potentie", "factor_key": "woonvisie_match"},
    )
    resp = await async_client.get(
        "/api/users/me/factor-pins?category=potentie", headers=auth_headers
    )
    keys = [p["factor_key"] for p in resp.json()]
    assert "woonvisie_match" in keys


@pytest.mark.asyncio
async def test_org_a_user_cannot_see_org_b_pins(
    async_client: AsyncClient, create_test_user
) -> None:
    """SC#10 multi-tenant isolation."""
    from app.auth.jwt import create_access_token

    user_a, org_a = await create_test_user(email="a@x.com", org_name="Org A")
    user_b, org_b = await create_test_user(email="b@x.com", org_name="Org B")
    headers_a = {"Authorization": f"Bearer {create_access_token(str(user_a.id), str(org_a.id))}"}
    headers_b = {"Authorization": f"Bearer {create_access_token(str(user_b.id), str(org_b.id))}"}

    # Org B user pins funda_frictie
    await async_client.post(
        "/api/users/me/factor-pins",
        headers=headers_b,
        json={"category": "potentie", "factor_key": "funda_frictie"},
    )
    # Org A user lists — must not see B's pin
    resp = await async_client.get(
        "/api/users/me/factor-pins?category=potentie", headers=headers_a
    )
    assert resp.status_code == 200
    assert resp.json() == []
