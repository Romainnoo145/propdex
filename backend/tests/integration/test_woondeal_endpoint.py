"""Integration tests for GET /api/gemeente/{gemeente_code}/woondeal (M054/S06)."""
import uuid

import pytest
from httpx import AsyncClient

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.auth.jwt import create_access_token
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.gemeente_provincie_map import GemeenteProvincieMap
from app.models.policy_document import PolicyDocument


@pytest.mark.asyncio
async def test_woondeal_endpoint_returns_gemeente_row(
    async_client: AsyncClient, create_test_user, test_db
):
    user, org = await create_test_user(
        email=f"woondeal-ep-{uuid.uuid4().hex[:6]}@test.nl",
        org_name="Woondeal Endpoint Org",
    )
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}

    test_db.add(GemeenteProvincieMap(gemeente_code="GM0983", provincie_code="PV31"))
    doc = PolicyDocument(
        entity_type="provincie",
        entity_code="PV31",
        source_key="woondeals",
        filename="woondeal-limburg-2022-2030.pdf",
        content_type="application/pdf",
        file_data=b"%PDF fake",
        file_size=9,
        uploaded_by_user_id=user.id,
        organization_id=org.id,
        status="uploaded",
        is_global=True,
        version_number=1,
    )
    test_db.add(doc)
    await test_db.flush()

    test_db.add(
        FactorExtractionCache(
            policy_document_id=doc.id,
            parcel_id=DOCUMENT_SENTINEL,
            factor_id="woondeal",
            schema_version=SCHEMA_VERSION,
            extracted_payload={
                "regio_naam": "Noord-Limburg",
                "provincie": "Limburg",
                "periode": "2022-2030",
                "gemeenten": [
                    {
                        "gemeente_naam": "Venlo",
                        "toevoegingen": 1745,
                        "plancapaciteit": 1594,
                        "sleutelprojecten_aantal": 2,
                        "sleutelprojecten_woningen": 706,
                    }
                ],
                "aandeel_betaalbaar": 0.667,
                "betaalbaar_definitie": "huur/koop grenzen",
                "regelingen": ["KLC", "BIRK", "Woningbouwimpuls"],
                "doelgroepen": [],
                "randvoorwaarden": [],
                "algemeen_citaat": "",
                "confidence": 0.9,
            },
        )
    )
    await test_db.commit()

    resp = await async_client.get(
        "/api/gemeente/GM0983/woondeal?gemeente_naam=Venlo", headers=headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["heeft_woondeal"] is True
    assert body["regio_naam"] == "Noord-Limburg"
    assert body["opgave"]["toevoegingen"] == 1745
    assert body["opgave"]["gat"] == 151  # 1745 - 1594
    assert "Woningbouwimpuls" in body["regelingen"]


@pytest.mark.asyncio
async def test_woondeal_endpoint_absent_doc(
    async_client: AsyncClient, create_test_user, test_db
):
    user, org = await create_test_user(
        email=f"woondeal-absent-{uuid.uuid4().hex[:6]}@test.nl",
        org_name="Absent Woondeal Org",
    )
    token = create_access_token(str(user.id), str(org.id))
    headers = {"Authorization": f"Bearer {token}"}

    resp = await async_client.get(
        "/api/gemeente/GM9999/woondeal?gemeente_naam=Nergens", headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["heeft_woondeal"] is False
