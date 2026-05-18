"""Unit tests for credential_resolver (M050/S02 D1 + D6 + D7).

Closes ENG-PLAN §Test coverage diagram GAPS for the credential resolution layer:
- D1: NO organization_id filter on credential lookup (vendor-managed, single row)
- D1: IntegrationCredential has no organization_id attribute (iron-rule pinned)
- D6: 60s in-process cache hit-path skips DB
- D6: TTL refresh past 60s
- Decrypt-failure propagation (cryptography.fernet.InvalidToken — NOT
  CredentialNotConfigured; mapped to 503 at router via a separate rescue path)
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from cryptography.fernet import InvalidToken

from app.models.integration_credential import IntegrationCredential
from app.services import credential_crypto, credential_resolver
from app.services.credential_resolver import (
    BRK_CREDENTIAL_NAME,
    BRK_SOURCE_KEY,
    BrkCredentials,
    CredentialNotConfigured,
    _clear_cache_for_tests,
    get_brk_credentials,
)


@pytest.fixture(autouse=True)
def _flush_cache():
    _clear_cache_for_tests()
    yield
    _clear_cache_for_tests()


@pytest.mark.asyncio
async def test_get_brk_credentials_reads_one_row_no_org_filter(test_db) -> None:
    """D1: ONE row read by (source_key, credential_name) only — no org filter.

    Iron-rule pin: IntegrationCredential MUST NOT have organization_id attribute
    (eng-review lock 2026-05-14 + 2026-05-16). Multi-tenant safety lives at the
    brk_ownership_records persistence layer, NOT the credential layer.
    """
    encrypted = credential_crypto.encrypt("test-api-key-D1")
    row = IntegrationCredential(
        source_key=BRK_SOURCE_KEY,
        credential_name=BRK_CREDENTIAL_NAME,
        encrypted_value=encrypted,
    )
    test_db.add(row)
    await test_db.commit()

    creds = await get_brk_credentials(test_db)
    assert isinstance(creds, BrkCredentials)
    assert creds.api_key == "test-api-key-D1"

    # D1 iron-rule enforcement: model has no organization_id attribute
    assert not hasattr(IntegrationCredential, "organization_id"), (
        "D1 IRON RULE: IntegrationCredential must NOT have organization_id "
        "(M049 vendor-managed lock 2026-05-14/16). Multi-tenant safety lives "
        "at brk_ownership_records, not the credential layer."
    )


@pytest.mark.asyncio
async def test_get_brk_credentials_raises_when_no_row(test_db) -> None:
    """Empty integration_credentials → CredentialNotConfigured (→ 503 at router)."""
    with pytest.raises(CredentialNotConfigured):
        await get_brk_credentials(test_db)


@pytest.mark.asyncio
async def test_get_brk_credentials_caches_within_ttl(
    test_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    """D6: second call within 60s does NOT call decrypt() again."""
    encrypted = credential_crypto.encrypt("cache-key")
    test_db.add(
        IntegrationCredential(
            source_key=BRK_SOURCE_KEY,
            credential_name=BRK_CREDENTIAL_NAME,
            encrypted_value=encrypted,
        )
    )
    await test_db.commit()

    decrypt_calls = {"n": 0}
    real_decrypt = credential_crypto.decrypt

    def counting_decrypt(token: str) -> bytes:
        decrypt_calls["n"] += 1
        return real_decrypt(token)

    monkeypatch.setattr(credential_resolver, "decrypt", counting_decrypt)

    creds1 = await get_brk_credentials(test_db)
    creds2 = await get_brk_credentials(test_db)
    assert creds1 == creds2
    assert decrypt_calls["n"] == 1, (
        f"D6 cache miss: decrypt called {decrypt_calls['n']}x — must be 1 within TTL"
    )


@pytest.mark.asyncio
async def test_get_brk_credentials_refreshes_past_ttl(
    test_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    """D6: after TTL expires the next call refreshes the cache (decrypt called 2x)."""
    encrypted = credential_crypto.encrypt("ttl-key")
    test_db.add(
        IntegrationCredential(
            source_key=BRK_SOURCE_KEY,
            credential_name=BRK_CREDENTIAL_NAME,
            encrypted_value=encrypted,
        )
    )
    await test_db.commit()

    decrypt_calls = {"n": 0}
    real_decrypt = credential_crypto.decrypt

    def counting_decrypt(token: str) -> bytes:
        decrypt_calls["n"] += 1
        return real_decrypt(token)

    monkeypatch.setattr(credential_resolver, "decrypt", counting_decrypt)

    # First call populates cache at "now"
    await get_brk_credentials(test_db)
    assert decrypt_calls["n"] == 1

    # Time-warp: replace credential_resolver.datetime so utcnow() returns now + 61s
    real_datetime = credential_resolver.datetime
    future = real_datetime.utcnow() + timedelta(seconds=61)

    class _FrozenDatetime(datetime):  # type: ignore[misc]
        @classmethod
        def utcnow(cls) -> datetime:
            return future

    monkeypatch.setattr(credential_resolver, "datetime", _FrozenDatetime)

    await get_brk_credentials(test_db)
    assert decrypt_calls["n"] == 2, (
        "D6 TTL refresh failed: decrypt should fire again after 60s expiry"
    )


@pytest.mark.asyncio
async def test_get_brk_credentials_decrypt_failure_propagates(test_db) -> None:
    """Decrypt of garbage encrypted_value → cryptography.fernet.InvalidToken.

    Distinct from CredentialNotConfigured — the row EXISTS, decrypt just fails
    (e.g. key rotated mid-flight). Router maps this via a separate rescue path.
    """
    # gAAAAAB is the Fernet prefix; invalid payload after it triggers InvalidToken
    test_db.add(
        IntegrationCredential(
            source_key=BRK_SOURCE_KEY,
            credential_name=BRK_CREDENTIAL_NAME,
            encrypted_value="gAAAAABnotarealtokenshouldfaildecryption",
        )
    )
    await test_db.commit()

    with pytest.raises(InvalidToken):
        await get_brk_credentials(test_db)
