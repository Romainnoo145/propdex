"""credential_crypto — Fernet/MultiFernet wrapper for integration_credentials.

Encrypt always uses INTEGRATION_CREDENTIAL_KEY (NEW).
Decrypt prefers NEW; falls back to INTEGRATION_CREDENTIAL_KEY_OLD via MultiFernet
so rotation rolls forward without downtime.

Lazy module-level instance: built on first call so tests can override settings
via monkeypatch before any code triggers construction. Use ``reset_cache()`` in
tests when settings change mid-test.
"""
from __future__ import annotations

from cryptography.fernet import Fernet, MultiFernet

from app.core.config import settings

_multifernet: MultiFernet | None = None


def _build() -> MultiFernet:
    fernets = [Fernet(settings.INTEGRATION_CREDENTIAL_KEY.encode())]
    if settings.INTEGRATION_CREDENTIAL_KEY_OLD is not None:
        fernets.append(Fernet(settings.INTEGRATION_CREDENTIAL_KEY_OLD.encode()))
    return MultiFernet(fernets)


def _get() -> MultiFernet:
    global _multifernet
    if _multifernet is None:
        _multifernet = _build()
    return _multifernet


def reset_cache() -> None:
    """Test-only: clear the cached MultiFernet so the next call rebuilds.

    Production code must NOT call this — rotation is driven by env-var change
    + process restart, not in-process key swap.
    """
    global _multifernet
    _multifernet = None


def encrypt(plaintext: bytes | str) -> str:
    """Encrypt ``plaintext`` under the NEW key and return a urlsafe-b64 token."""
    if isinstance(plaintext, str):
        plaintext = plaintext.encode()
    token = _get().encrypt(plaintext)
    return token.decode()


def decrypt(token: str) -> bytes:
    """Decrypt ``token`` (prefers NEW key, falls back to OLD if configured)."""
    return _get().decrypt(token.encode())
