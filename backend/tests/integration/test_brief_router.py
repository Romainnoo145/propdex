"""M052/S04 — Contact brief-genereer-endpoint tests."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.auth.jwt import create_access_token
from app.models.brief_dispatch import BriefDispatch


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


@pytest.mark.asyncio
async def test_generate_brief_auto_mode_with_rechtspersoon(
    async_client: AsyncClient, create_test_user, test_db
):
    from datetime import datetime

    from app.models.brk_ownership_record import BrkOwnershipRecord

    user, org = await create_test_user(email="auto@x.nl", org_name="Hauzer Vastgoed")
    rec = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.TEST.2",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="Vastgoed BV",
        statutaire_zetel="Industrieweg 5, Venlo",
        heeft_hypotheek=False,
        fetched_at=datetime.utcnow(),
    )
    test_db.add(rec)
    await test_db.commit()
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.post(
        "/api/parcels/NL.IMKAD.TEST.2/brief", headers=headers, json={}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "auto"
    assert "Vastgoed BV" in body["markdown"]


@pytest.mark.asyncio
async def test_send_brief_blocked_without_hauzer_demo(
    async_client: AsyncClient, create_test_user, test_db
):
    user, org = await create_test_user(email="s1@x.nl", org_name="Geen Demo")
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    r = await async_client.post(
        "/api/parcels/NL.IMKAD.TEST.3/brief/send",
        headers=headers,
        json={"markdown": "x"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_send_brief_fake_verzonden_with_hauzer_demo(
    async_client: AsyncClient, create_test_user, test_db
):
    user, org = await create_test_user(email="s2@x.nl", org_name="Hauzer Demo")
    org.hauzer_demo = True
    test_db.add(org)
    await test_db.commit()
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}
    parcel_id = "NL.IMKAD.TEST.3"
    r = await async_client.post(
        f"/api/parcels/{parcel_id}/brief/send",
        headers=headers,
        json={"markdown": "x"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "verzonden"

    # B4 regressie: persisteer exact één metadata-record, toegeschreven aan de
    # org van de caller, en ZONDER brief-inhoud (geen PII-opslag).
    rows = (
        (
            await test_db.execute(
                select(BriefDispatch).where(BriefDispatch.parcel_id == parcel_id)
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1
    row = rows[0]
    assert row.organization_id == org.id  # org-attributie vastgepind
    assert not hasattr(row, "markdown")
    assert not hasattr(row, "content")
    assert not hasattr(row, "body")
