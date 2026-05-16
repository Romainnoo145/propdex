"""TEST-03d — startup validator rejects bad INTEGRATION_CREDENTIAL_KEY values.

Covers:
  1. Missing key                  -> ValidationError
  2. Sentinel `changeme`          -> ValidationError
  3. Empty string                 -> ValidationError
  4. Too-short / non-32-byte b64  -> ValidationError ("32 bytes" / "Fernet" / "urlsafe-base64")
  5. Valid Fernet key, OLD unset  -> loads
  6. Valid NEW + valid OLD        -> loads
  7. Valid NEW + bad OLD          -> ValidationError
"""
from __future__ import annotations

import pytest
from cryptography.fernet import Fernet
from pydantic import ValidationError

from app.core.config import Settings


@pytest.fixture
def base_env(monkeypatch):
    """Wire up the bare minimum env so Settings can load, then strip credential keys."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@h:5432/d")
    monkeypatch.setenv("SECRET_KEY", "CHANGE_ME_IN_PRODUCTION")
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.delenv("INTEGRATION_CREDENTIAL_KEY", raising=False)
    monkeypatch.delenv("INTEGRATION_CREDENTIAL_KEY_OLD", raising=False)


def test_missing_key_raises(base_env):
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_sentinel_value_raises(base_env, monkeypatch):
    monkeypatch.setenv("INTEGRATION_CREDENTIAL_KEY", "changeme")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_empty_string_raises(base_env, monkeypatch):
    monkeypatch.setenv("INTEGRATION_CREDENTIAL_KEY", "")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_too_short_key_raises(base_env, monkeypatch):
    monkeypatch.setenv("INTEGRATION_CREDENTIAL_KEY", "too-short")
    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)
    message = str(exc_info.value)
    assert any(
        token in message for token in ("32 bytes", "Fernet", "urlsafe-base64")
    ), f"Expected validation message to mention 32 bytes / Fernet / urlsafe-base64, got: {message}"


def test_valid_new_key_loads(base_env, monkeypatch):
    new_key = Fernet.generate_key().decode()
    monkeypatch.setenv("INTEGRATION_CREDENTIAL_KEY", new_key)
    settings = Settings(_env_file=None)
    assert settings.INTEGRATION_CREDENTIAL_KEY == new_key
    assert settings.INTEGRATION_CREDENTIAL_KEY_OLD is None


def test_valid_new_and_old_loads(base_env, monkeypatch):
    new_key = Fernet.generate_key().decode()
    old_key = Fernet.generate_key().decode()
    monkeypatch.setenv("INTEGRATION_CREDENTIAL_KEY", new_key)
    monkeypatch.setenv("INTEGRATION_CREDENTIAL_KEY_OLD", old_key)
    settings = Settings(_env_file=None)
    assert settings.INTEGRATION_CREDENTIAL_KEY == new_key
    assert settings.INTEGRATION_CREDENTIAL_KEY_OLD == old_key


def test_valid_new_with_bad_old_raises(base_env, monkeypatch):
    new_key = Fernet.generate_key().decode()
    monkeypatch.setenv("INTEGRATION_CREDENTIAL_KEY", new_key)
    monkeypatch.setenv("INTEGRATION_CREDENTIAL_KEY_OLD", "not-a-fernet-key")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
