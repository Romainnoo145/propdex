"""Task 2 — probe_type_a_for_entity: generalized (entity_type, entity_code) probe.

Tests that the new probe works for non-gemeente entity types (e.g. provincie),
and that the backward-compatible gemeente delegation via probe_type_a_cascade
still passes the existing router tests.
"""
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.data_source_probes import probe_type_a_for_entity
from app.models.policy_document import PolicyDocument


@pytest.mark.asyncio
async def test_type_a_probe_live_for_provincie_doc(
    test_db: AsyncSession, create_test_user
) -> None:
    user, org = await create_test_user(email="probe-scope-test@test")

    test_db.add(PolicyDocument(
        id=uuid.uuid4(),
        organization_id=org.id,
        entity_type="provincie",
        entity_code="PV31",
        source_key="provinciale-omgevingsvisie",
        is_global=True,
        filename="x.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4",
        file_size=8,
        uploaded_by_user_id=user.id,
        version_number=1,
        status="parsed",
    ))
    await test_db.commit()

    live = await probe_type_a_for_entity(
        "provinciale-omgevingsvisie", "provincie", "PV31", test_db
    )
    assert live["status"] == "live"

    missing = await probe_type_a_for_entity(
        "provinciaal-erfgoed", "provincie", "PV31", test_db
    )
    assert missing["status"] == "missing"


from tests.integration.test_admin_data_sources_router import _superuser_headers


@pytest.mark.asyncio
async def test_scopes_endpoint_lists_landelijk(async_client, test_db, create_test_user):
    user, org = await create_test_user(email="scope1@test", is_superuser=True)
    resp = await async_client.get(
        "/api/admin/data-sources/scopes",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200, resp.text
    types = {s["entity_type"] for s in resp.json()}
    assert "landelijk" in types


@pytest.mark.asyncio
async def test_scope_payload_landelijk_is_type_a_only(async_client, test_db, create_test_user):
    user, org = await create_test_user(email="scope2@test", is_superuser=True)
    resp = await async_client.get(
        "/api/admin/data-sources/scope/landelijk/NL",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["open_apis"] == [] and body["paid_integrations"] == []
    assert len(body["cascade_uploads"]) >= 1
