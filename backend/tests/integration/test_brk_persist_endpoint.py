"""Integration tests for POST /api/parcels/{parcel_id}/brk/persist (M050/S02).

Closes ENG-PLAN §Test coverage diagram endpoint GAPS — full D12 status-code
mapping registry:

| Status | Cause                                              | Test                                                  |
|--------|----------------------------------------------------|-------------------------------------------------------|
| 200    | Happy path (rechtspersoon + overheid persisted)    | test_persist_endpoint_200_happy_path_when_flag_on     |
| 200    | Only natuurlijk_persoon in upstream (D9 empty)     | test_persist_endpoint_200_empty_list_when_only_np     |
| 200    | Cache HIT within 30d (no HTTP fired)               | test_persist_endpoint_cache_hit_skips_http            |
| 401    | Unauthenticated                                    | test_persist_endpoint_401_unauthenticated             |
| 422    | rechtspersoon with eigenaar_naam=None              | test_persist_endpoint_422_when_rechtspersoon_naam_null|
| 502    | Kadaster upstream 5xx (masked)                     | test_persist_endpoint_502_when_upstream_5xx           |
| 502    | Kadaster timeout                                   | test_persist_endpoint_502_when_upstream_timeout       |
| 503    | M050_BRK_PERSIST_ENABLED=False (DPA pending)       | test_persist_endpoint_503_when_feature_flag_off       |
| 503    | IntegrationCredential row missing                  | test_persist_endpoint_503_when_credentials_missing    |

D13: pytest_httpx intercepts the BRK Bevragen v2 endpoint (project respx
substitute — same request-level mocking semantics). SSL context construction
is monkeypatched out because the test env has no mTLS certs (vendor-managed
cert config is deferred per ENG-PLAN §NOT in scope).
"""
from __future__ import annotations

import uuid
from typing import Any

import httpx
import pytest

from app.auth.jwt import create_access_token
from app.core.config import settings
from app.government_apis.base import GovernmentAPIError
from app.models.integration_credential import IntegrationCredential
from app.models.organization import Organization
from app.models.user import User
from app.services import credential_crypto, credential_resolver

# Anonymized crafted BRK Bevragen v2 response shape (mirrors parser input)
MIXED_RAW: dict[str, Any] = {
    "_embedded": {
        "zakelijkGerechtigden": [
            {
                "persoon": {
                    "type": "NatuurlijkPersoon",
                    "voornamen": "Geheim",
                    "geslachtsnaam": "X",
                },
                "type": "Eigendom",
            },
            {
                "persoon": {
                    "type": "NietNatuurlijkPersoon",
                    "statutaireNaam": "BV Voorbeeld",
                    "kvkNummer": "12345678",
                    "statutaireZetel": "Amsterdam",
                },
                "type": "Eigendom",
                "aandeel": {"teller": 1, "noemer": 1},
                "stukken": [{"koopsom": {"koopsom": 250000, "koopjaar": 2023}}],
            },
            {
                "persoon": {
                    "type": "NietNatuurlijkPersoon",
                    "statutaireNaam": "Gemeente Venlo",
                },
                "beschikkingsbevoegdheid": {
                    "code": "PubliekrechtelijkRechtspersoon",
                },
                "type": "Eigendom",
            },
        ]
    }
}

ONLY_NATUURLIJK: dict[str, Any] = {
    "_embedded": {
        "zakelijkGerechtigden": [
            {
                "persoon": {
                    "type": "NatuurlijkPersoon",
                    "voornamen": "Alleen",
                    "geslachtsnaam": "Particulier",
                },
                "type": "Eigendom",
            }
        ]
    }
}

NULL_NAAM_RECHTSPERSOON: dict[str, Any] = {
    "_embedded": {
        "zakelijkGerechtigden": [
            {
                "persoon": {
                    "type": "NietNatuurlijkPersoon",
                    # statutaireNaam intentionally missing → D8 violation
                    "kvkNummer": "99999999",
                },
                "type": "Eigendom",
            },
        ]
    }
}


@pytest.fixture(autouse=True)
def _flush_credential_cache():
    """credential_resolver has a 60s in-process cache — flush per test."""
    credential_resolver._clear_cache_for_tests()
    yield
    credential_resolver._clear_cache_for_tests()


async def _seed_brk_credential(test_db) -> None:
    test_db.add(
        IntegrationCredential(
            source_key="brk",
            credential_name="api_key",
            encrypted_value=credential_crypto.encrypt("test-api-key"),
        )
    )
    await test_db.commit()


async def _seed_user_in_org(test_db) -> tuple[User, Organization]:
    """Manually create user+org bound to the test_db session (parallel to
    create_test_user fixture but with FF/credential ordering control)."""
    from app.auth.password import hash_password

    org = Organization(name=f"TestOrg-{uuid.uuid4()}")
    test_db.add(org)
    await test_db.flush()

    user = User(
        email=f"u{uuid.uuid4().hex[:8]}@test.com",
        hashed_password=hash_password("TestPass123!"),
        full_name="Test User",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(user)
    await test_db.commit()
    return user, org


def _auth_headers(user: User, org: Organization) -> dict[str, str]:
    token = create_access_token(str(user.id), str(org.id))
    return {"Authorization": f"Bearer {token}"}


def _stub_call_kadaster(
    monkeypatch: pytest.MonkeyPatch, raw: dict[str, Any]
) -> dict[str, int]:
    """Monkeypatch brk_fetch_service._call_kadaster (avoids mTLS SSL setup).

    Returns a counter dict so tests can assert HTTP-substitute call count
    (== respx.calls.count in the original D13 strategy).
    """
    from app.services import brk_fetch_service

    counter = {"n": 0}

    async def fake_call_kadaster(creds, parcel_id):  # type: ignore[no-untyped-def]
        counter["n"] += 1
        return raw

    monkeypatch.setattr(brk_fetch_service, "_call_kadaster", fake_call_kadaster)
    return counter


# ──────────────────────────────────────────────────────────────────────────
# 503 — feature flag off (DPA pending, production default)
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_persist_endpoint_503_when_feature_flag_off(
    test_db, async_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """M050_BRK_PERSIST_ENABLED defaults to False → 503 even with valid creds.

    Proves DPA-pending lock holds at production default. Other happy-path
    tests must monkeypatch True to flip the gate.
    """
    # Confirm default False (don't monkeypatch)
    assert settings.M050_BRK_PERSIST_ENABLED is False
    await _seed_brk_credential(test_db)
    counter = _stub_call_kadaster(monkeypatch, MIXED_RAW)

    user, org = await _seed_user_in_org(test_db)
    response = await async_client.post(
        "/api/parcels/NL.IMKAD.FFOff.1/brk/persist", headers=_auth_headers(user, org)
    )
    assert response.status_code == 503
    detail = response.json().get("detail", "")
    assert any(
        kw in detail.lower() for kw in ("dpa", "persist", "feature", "beschikbaar")
    ), f"503 detail should reference DPA / persist disable, got: {detail}"
    assert counter["n"] == 1  # HTTP still fires; FF gate is in persist_record


# ──────────────────────────────────────────────────────────────────────────
# 200 — happy path
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_persist_endpoint_200_happy_path_when_flag_on(
    test_db, async_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    await _seed_brk_credential(test_db)
    _stub_call_kadaster(monkeypatch, MIXED_RAW)

    user, org = await _seed_user_in_org(test_db)
    response = await async_client.post(
        "/api/parcels/NL.IMKAD.Happy.1/brk/persist", headers=_auth_headers(user, org)
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 2  # natuurlijk_persoon dropped; rechtspersoon + overheid kept
    eigenaar_types = {row["eigenaar_type"] for row in body}
    assert eigenaar_types == {"rechtspersoon", "overheid"}


# ──────────────────────────────────────────────────────────────────────────
# 503 — credentials missing
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_persist_endpoint_503_when_credentials_missing(
    test_db, async_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    # NO IntegrationCredential row seeded
    user, org = await _seed_user_in_org(test_db)
    response = await async_client.post(
        "/api/parcels/NL.IMKAD.NoCred.1/brk/persist",
        headers=_auth_headers(user, org),
    )
    assert response.status_code == 503
    detail = response.json().get("detail", "").lower()
    assert "api_key" in detail or "geconfigureerd" in detail or "credential" in detail


# ──────────────────────────────────────────────────────────────────────────
# 502 — upstream 5xx + timeout
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_persist_endpoint_502_when_upstream_5xx(
    test_db, async_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.services import brk_fetch_service

    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    await _seed_brk_credential(test_db)

    async def fail_call(creds, parcel_id):  # type: ignore[no-untyped-def]
        raise GovernmentAPIError("brk-bevragen", "upstream HTTP 500")

    monkeypatch.setattr(brk_fetch_service, "_call_kadaster", fail_call)

    user, org = await _seed_user_in_org(test_db)
    response = await async_client.post(
        "/api/parcels/NL.IMKAD.Up5xx.1/brk/persist",
        headers=_auth_headers(user, org),
    )
    assert response.status_code == 502
    # D12: detail is MASKED — does NOT leak the upstream Kadaster code/message
    detail = response.json().get("detail", "")
    assert "upstream BRK error" in detail
    assert "500" not in detail  # masked


@pytest.mark.asyncio
async def test_persist_endpoint_502_when_upstream_timeout(
    test_db, async_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.services import brk_fetch_service

    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    await _seed_brk_credential(test_db)

    async def timeout_call(creds, parcel_id):  # type: ignore[no-untyped-def]
        raise GovernmentAPIError("brk-bevragen", "timeout after 30s")

    monkeypatch.setattr(brk_fetch_service, "_call_kadaster", timeout_call)

    user, org = await _seed_user_in_org(test_db)
    response = await async_client.post(
        "/api/parcels/NL.IMKAD.Timeout.1/brk/persist",
        headers=_auth_headers(user, org),
    )
    assert response.status_code == 502


# ──────────────────────────────────────────────────────────────────────────
# 422 — NULL naam on rechtspersoon (D8 ValidationError)
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_persist_endpoint_422_when_rechtspersoon_naam_null(
    test_db, async_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    await _seed_brk_credential(test_db)
    _stub_call_kadaster(monkeypatch, NULL_NAAM_RECHTSPERSOON)

    user, org = await _seed_user_in_org(test_db)
    response = await async_client.post(
        "/api/parcels/NL.IMKAD.NullNaam.1/brk/persist",
        headers=_auth_headers(user, org),
    )
    assert response.status_code == 422
    detail = response.json().get("detail", "").lower()
    assert "naam" in detail or "rechtspersoon" in detail


# ──────────────────────────────────────────────────────────────────────────
# 401 — unauthenticated
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_persist_endpoint_401_unauthenticated(async_client) -> None:
    response = await async_client.post(
        "/api/parcels/NL.IMKAD.Auth.1/brk/persist"
    )
    assert response.status_code == 401


# ──────────────────────────────────────────────────────────────────────────
# 200 — empty list when only natuurlijk_persoon (D9)
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_persist_endpoint_200_empty_list_when_only_natuurlijk_persoon(
    test_db, async_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    await _seed_brk_credential(test_db)
    _stub_call_kadaster(monkeypatch, ONLY_NATUURLIJK)

    user, org = await _seed_user_in_org(test_db)
    response = await async_client.post(
        "/api/parcels/NL.IMKAD.OnlyNP.1/brk/persist",
        headers=_auth_headers(user, org),
    )
    assert response.status_code == 200, response.text
    assert response.json() == []


# ──────────────────────────────────────────────────────────────────────────
# 200 — cache HIT within 30 days skips HTTP (D3 + D4)
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_persist_endpoint_cache_hit_skips_http(
    test_db, async_client, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Pre-existing fresh row → endpoint returns cached, no HTTP fires."""
    from datetime import datetime, timedelta

    from app.models.brk_ownership_record import BrkOwnershipRecord

    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    await _seed_brk_credential(test_db)
    counter = _stub_call_kadaster(monkeypatch, MIXED_RAW)

    user, org = await _seed_user_in_org(test_db)
    parcel_id = "NL.IMKAD.CacheHit.1"

    # Pre-seed a fresh BRK row (1 day old, well within 30d TTL)
    fresh_row = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Pre-existing",
        fetched_at=datetime.utcnow() - timedelta(days=1),
    )
    test_db.add(fresh_row)
    await test_db.commit()

    response = await async_client.post(
        f"/api/parcels/{parcel_id}/brk/persist",
        headers=_auth_headers(user, org),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["eigenaar_naam"] == "BV Pre-existing"
    # D3 cache hit: HTTP substitute MUST NOT have fired
    assert counter["n"] == 0, (
        "Cache HIT within 30 days must NOT call Kadaster (D3 + D4)"
    )


# Silence unused-import warning in tests with no httpx ref
_ = httpx
