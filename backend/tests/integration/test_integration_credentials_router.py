"""Integration tests for /api/admin/integration-credentials (M049/S05 Plan 02).

Covers:
- TEST-03b (RBAC: regular user 403 / superuser 200 on every verb)
- TEST-03c (GET-shape regression: encrypted_value / value NEVER in response)
- TEST-03e (audit emission on DELETE)
- Contract: unknown source_key 422, invalid credential_name 422, UQ conflict 409
"""
from __future__ import annotations

import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.admin.integration_credentials_router import router as creds_router
from app.auth.jwt import create_access_token
from app.core.database import get_db
from app.models.audit_log import AuditLog


def _build_app(db_override) -> FastAPI:
    app = FastAPI()
    app.include_router(creds_router)
    app.dependency_overrides[get_db] = db_override
    return app


async def _client(test_db) -> AsyncClient:
    async def db_override():
        yield test_db
    app = _build_app(db_override)
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _headers_for(create_test_user, *, is_superuser: bool, email: str):
    user, org = await create_test_user(email=email, is_superuser=is_superuser)
    tok = create_access_token(str(user.id), str(org.id))
    return user, {"Authorization": f"Bearer {tok}"}


# ─── TEST-03b: RBAC ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rbac_regular_user_get_403(test_db, create_test_user):
    _, headers = await _headers_for(create_test_user, is_superuser=False, email="r1@m049.test")
    async with await _client(test_db) as c:
        resp = await c.get("/api/admin/integration-credentials", headers=headers)
        assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_rbac_regular_user_post_403(test_db, create_test_user):
    _, headers = await _headers_for(create_test_user, is_superuser=False, email="r2@m049.test")
    async with await _client(test_db) as c:
        resp = await c.post(
            "/api/admin/integration-credentials",
            headers=headers,
            json={"source_key": "brk", "credential_name": "api_key", "value": "fake"},
        )
        assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_rbac_regular_user_delete_403(test_db, create_test_user):
    _, headers = await _headers_for(create_test_user, is_superuser=False, email="r3@m049.test")
    async with await _client(test_db) as c:
        resp = await c.delete(
            f"/api/admin/integration-credentials/{uuid.uuid4()}",
            headers=headers,
        )
        assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_rbac_superuser_post_201_and_delete_204(test_db, create_test_user):
    _, headers = await _headers_for(create_test_user, is_superuser=True, email="su1@m049.test")
    async with await _client(test_db) as c:
        resp = await c.post(
            "/api/admin/integration-credentials",
            headers=headers,
            json={"source_key": "brk", "credential_name": "api_key", "value": "fake-value-1"},
        )
        assert resp.status_code == 201, resp.text
        created_id = resp.json()["id"]

        resp = await c.delete(
            f"/api/admin/integration-credentials/{created_id}",
            headers=headers,
        )
        assert resp.status_code == 204, resp.text


# ─── TEST-03c: GET shape regression ────────────────────────────────────

EXPECTED_KEYS = {
    "id", "source_key", "credential_name",
    "configured", "configured_at", "last_rotated_at",
}


@pytest.mark.asyncio
async def test_get_response_shape_excludes_secrets(test_db, create_test_user):
    _, headers = await _headers_for(create_test_user, is_superuser=True, email="su2@m049.test")
    async with await _client(test_db) as c:
        # Create one credential first
        resp = await c.post(
            "/api/admin/integration-credentials",
            headers=headers,
            json={
                "source_key": "vindsubsidies",
                "credential_name": "api_key",
                "value": "fake-roundtrip-value",
            },
        )
        assert resp.status_code == 201

        # GET list
        resp = await c.get("/api/admin/integration-credentials", headers=headers)
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) >= 1
        for item in items:
            assert set(item.keys()) == EXPECTED_KEYS, item
            assert "encrypted_value" not in item
            assert "value" not in item
            assert "fake-roundtrip-value" not in str(item)
        assert items[0]["configured"] is True

        # GET per-source_key
        resp = await c.get(
            "/api/admin/integration-credentials/vindsubsidies", headers=headers,
        )
        assert resp.status_code == 200
        for item in resp.json():
            assert set(item.keys()) == EXPECTED_KEYS
            assert "encrypted_value" not in item


# ─── TEST-03e: audit emission ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_emits_audit_log(test_db, create_test_user):
    user, headers = await _headers_for(create_test_user, is_superuser=True, email="su3@m049.test")
    async with await _client(test_db) as c:
        resp = await c.post(
            "/api/admin/integration-credentials",
            headers=headers,
            json={
                "source_key": "nvm",
                "credential_name": "client_secret",
                "value": "fake-rotate-input",
            },
        )
        assert resp.status_code == 201
        cid = resp.json()["id"]

        resp = await c.delete(
            f"/api/admin/integration-credentials/{cid}", headers=headers,
        )
        assert resp.status_code == 204

    # Verify audit row directly
    audit = (
        await test_db.execute(
            select(AuditLog).where(AuditLog.target_id == cid)
        )
    ).scalars().first()
    assert audit is not None
    assert audit.action == "credential_rotated"
    assert audit.target_type == "integration_credential"
    assert audit.target_id == cid
    assert audit.actor_user_id == user.id
    assert audit.event_metadata == {
        "source_key": "nvm",
        "credential_name": "client_secret",
    }


# ─── Contract: credential_name + UQ + unknown source_key ───────────────

@pytest.mark.asyncio
async def test_post_unknown_source_key_returns_422(test_db, create_test_user):
    _, headers = await _headers_for(create_test_user, is_superuser=True, email="su4@m049.test")
    async with await _client(test_db) as c:
        resp = await c.post(
            "/api/admin/integration-credentials",
            headers=headers,
            json={"source_key": "no-such-source", "credential_name": "api_key", "value": "fake"},
        )
        assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_post_invalid_credential_name_returns_422(test_db, create_test_user):
    _, headers = await _headers_for(create_test_user, is_superuser=True, email="su5@m049.test")
    async with await _client(test_db) as c:
        resp = await c.post(
            "/api/admin/integration-credentials",
            headers=headers,
            json={"source_key": "brk", "credential_name": "not_in_registry", "value": "fake"},
        )
        assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_post_uq_conflict_returns_409(test_db, create_test_user):
    _, headers = await _headers_for(create_test_user, is_superuser=True, email="su6@m049.test")
    async with await _client(test_db) as c:
        payload = {"source_key": "brk", "credential_name": "api_key", "value": "fake"}
        resp = await c.post("/api/admin/integration-credentials", headers=headers, json=payload)
        assert resp.status_code == 201
        resp = await c.post("/api/admin/integration-credentials", headers=headers, json=payload)
        assert resp.status_code == 409, resp.text
