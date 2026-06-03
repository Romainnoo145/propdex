"""M052/S04 — Contact brief-genereer-endpoint tests."""

import pytest
from httpx import AsyncClient

from app.auth.jwt import create_access_token


@pytest.mark.asyncio
async def test_generate_brief_manual_mode_when_no_brk(
    async_client: AsyncClient, create_test_user, test_db
):
    user, org = await create_test_user(email="g@x.nl", org_name="Hauzer Vastgoed")
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.post(
        "/api/parcels/NL.IMKAD.TEST.1/brief",
        headers=headers,
        json={
            "addressee": {
                "eigenaar_aanhef": "Geachte heer Janssen",
                "eigenaar_adres": "Kazernestraat 12, Venlo",
            }
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "manual"
    assert "Hauzer Vastgoed" in body["markdown"]
    assert "Geachte heer Janssen" in body["markdown"]
