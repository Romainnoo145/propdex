"""Unit tests for GET /api/parcels/{parcel_id}/brk router handler (M050/S06 — Plan 08-01).

Covers:
- 200 + [] when no records persisted (cache miss is a normal state)
- 200 + records when service returns rows
- Handler passes current_user.organization_id to read_for_parcel
- Auth required: missing Authorization header → 401

Cross-org silent isolation lives at the service layer; this file mocks
``read_for_parcel`` at the router boundary so router-layer wiring is unit-isolated.
The end-to-end multi-tenant + cross-org checks live in
``tests/regression/test_multi_tenant_brk_isolation.py``.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.schemas.brk_ownership_record import BRKOwnershipRecordRead


def _fake_record(*, org_id: uuid.UUID, parcel_id: str) -> BRKOwnershipRecordRead:
    now = datetime.utcnow()
    return BRKOwnershipRecordRead(
        id=uuid.uuid4(),
        organization_id=org_id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Test",
        kvk_nummer=None,
        statutaire_zetel=None,
        zakelijk_recht_type=None,
        aandeel=None,
        koopsom=None,
        koopjaar=None,
        heeft_hypotheek=False,
        fetched_at=now,
        soft_deleted_at=None,
        hard_delete_after=None,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_get_returns_200_empty_list_no_records(
    async_client: AsyncClient,
    auth_headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """200 OK + [] when no records persisted — empty is a normal state, not an error."""
    mock_read = AsyncMock(return_value=[])
    monkeypatch.setattr("app.scans.brk_router.read_for_parcel", mock_read)

    response = await async_client.get(
        "/api/parcels/NL.IMKAD.Empty.1/brk", headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json() == []
    assert mock_read.await_count == 1


@pytest.mark.asyncio
async def test_get_returns_records_when_present(
    async_client: AsyncClient,
    auth_headers,
    create_test_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """200 OK + serialized records when service returns rows."""
    # Re-create the user matched by auth_headers so we can derive an org_id
    # for the fake record. auth_headers fixture already created one; we
    # parallel-create just to obtain a real UUID (router serialisation only
    # cares about shape, not identity for this test).
    _, org = await create_test_user(
        email="records-present@example.com", org_name="Records Org"
    )
    mock_read = AsyncMock(
        return_value=[_fake_record(org_id=org.id, parcel_id="NL.IMKAD.Has.1")]
    )
    monkeypatch.setattr("app.scans.brk_router.read_for_parcel", mock_read)

    response = await async_client.get(
        "/api/parcels/NL.IMKAD.Has.1/brk", headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["parcel_id"] == "NL.IMKAD.Has.1"
    assert body[0]["eigenaar_type"] == "rechtspersoon"
    assert body[0]["eigenaar_naam"] == "BV Test"


@pytest.mark.asyncio
async def test_get_passes_org_id_from_jwt(
    async_client: AsyncClient,
    auth_headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Handler MUST pass current_user.organization_id to read_for_parcel — multi-tenant gate."""
    mock_read = AsyncMock(return_value=[])
    monkeypatch.setattr("app.scans.brk_router.read_for_parcel", mock_read)

    response = await async_client.get(
        "/api/parcels/NL.IMKAD.OrgCheck.1/brk", headers=auth_headers
    )

    assert response.status_code == 200
    assert mock_read.await_count == 1
    call_kwargs = mock_read.await_args.kwargs
    assert "organization_id" in call_kwargs, (
        "Handler must pass organization_id kwarg to read_for_parcel"
    )
    assert isinstance(call_kwargs["organization_id"], uuid.UUID)
    assert call_kwargs["parcel_id"] == "NL.IMKAD.OrgCheck.1"


@pytest.mark.asyncio
async def test_get_requires_auth(async_client: AsyncClient) -> None:
    """No Authorization header → 401 Unauthorized (gate enforced by get_current_user)."""
    response = await async_client.get("/api/parcels/NL.IMKAD.NoAuth.1/brk")
    assert response.status_code == 401
