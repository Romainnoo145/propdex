"""TEST-03a — credential_crypto Fernet/MultiFernet roundtrip + rotation.

Covers:
  1. Roundtrip str: decrypt(encrypt(str)) == str.encode(); ciphertext != plaintext
  2. Roundtrip bytes: decrypt(encrypt(bytes)) == bytes
  3. Tampered ciphertext -> cryptography.fernet.InvalidToken
  4. Rotation: encrypt with OLD key only, reconfigure to MultiFernet(NEW + OLD),
     decrypt succeeds; new writes use NEW so a Fernet(OLD)-only decrypt of a NEW
     write fails.
"""
from __future__ import annotations

import pytest
from cryptography.fernet import Fernet, InvalidToken

from app.services import credential_crypto


@pytest.fixture(autouse=True)
def _clear_cache():
    credential_crypto.reset_cache()
    yield
    credential_crypto.reset_cache()


@pytest.fixture
def fresh_keys(monkeypatch):
    new_key = Fernet.generate_key().decode()
    monkeypatch.setattr(
        "app.services.credential_crypto.settings.INTEGRATION_CREDENTIAL_KEY",
        new_key,
        raising=True,
    )
    monkeypatch.setattr(
        "app.services.credential_crypto.settings.INTEGRATION_CREDENTIAL_KEY_OLD",
        None,
        raising=False,
    )
    return new_key


def test_roundtrip_str(fresh_keys):
    plaintext = "plain-roundtrip-input"
    ciphertext = credential_crypto.encrypt(plaintext)
    assert isinstance(ciphertext, str)
    # Ciphertext is opaque urlsafe-b64 Fernet token — must not contain plaintext
    assert "plain-roundtrip-input" not in ciphertext
    assert credential_crypto.decrypt(ciphertext) == plaintext.encode()


def test_roundtrip_bytes(fresh_keys):
    plaintext = b"\x00\x01\x02 binary payload"
    ciphertext = credential_crypto.encrypt(plaintext)
    assert credential_crypto.decrypt(ciphertext) == plaintext


def test_tampered_token_raises(fresh_keys):
    ciphertext = credential_crypto.encrypt("hello")
    # Flip the last 2 chars to break the MAC without changing length-alignment
    tampered = ciphertext[:-2] + ("AA" if ciphertext[-2:] != "AA" else "BB")
    with pytest.raises(InvalidToken):
        credential_crypto.decrypt(tampered)


def test_rotation_old_key_path(monkeypatch):
    old_key = Fernet.generate_key().decode()
    new_key = Fernet.generate_key().decode()

    # Phase 1: encrypt under OLD key only (no NEW yet, OLD-only deployment)
    monkeypatch.setattr(
        "app.services.credential_crypto.settings.INTEGRATION_CREDENTIAL_KEY",
        old_key,
    )
    monkeypatch.setattr(
        "app.services.credential_crypto.settings.INTEGRATION_CREDENTIAL_KEY_OLD",
        None,
    )
    credential_crypto.reset_cache()
    old_ct = credential_crypto.encrypt("rotate-me")

    # Phase 2: reconfigure with NEW primary + OLD fallback (mid-rotation)
    monkeypatch.setattr(
        "app.services.credential_crypto.settings.INTEGRATION_CREDENTIAL_KEY",
        new_key,
    )
    monkeypatch.setattr(
        "app.services.credential_crypto.settings.INTEGRATION_CREDENTIAL_KEY_OLD",
        old_key,
    )
    credential_crypto.reset_cache()

    # MultiFernet decrypts OLD-key ciphertext via fallback
    assert credential_crypto.decrypt(old_ct) == b"rotate-me"

    # New writes use NEW key — a Fernet(OLD)-only decrypt should fail
    new_ct = credential_crypto.encrypt("future")
    with pytest.raises(InvalidToken):
        Fernet(old_key.encode()).decrypt(new_ct.encode())
