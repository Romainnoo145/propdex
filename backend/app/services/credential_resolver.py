"""credential_resolver — vendor-managed credential resolution for cascade Type-C APIs.

Per M050/S02 ENG-PLAN locked 2026-05-18 (D1, D6, D7):

- **D1 vendor-managed:** Reads ONE row from `integration_credentials` WHERE
  `source_key='brk' AND credential_name='api_key'`. NO `organization_id` filter
  on credential lookup — `IntegrationCredential` has no `organization_id` column
  by design (eng-review lock 2026-05-14 + 2026-05-16). Multi-tenant safety
  lives at the PERSISTENCE layer (S01 mechanism via `BrkOwnershipRecord`
  filtered by `organization_id`), NOT the credential layer. This is the SOLE
  documented exception to the CLAUDE.md "every query filters by
  organization_id" rule.

- **D6 60s in-process cache:** Cache-hit path skips the DB; rotation visible on
  next call past TTL. No restart required. Tests use `_clear_cache_for_tests()`
  to reset between cases.

- **D7 cert/key stay on disk:** This module ONLY resolves the `api_key`. mTLS
  client certificate + private key remain env-driven
  (`BRK_CLIENT_CERT_PATH` / `BRK_CLIENT_KEY_PATH` / `BRK_CA_BUNDLE_PATH`).
  `CREDENTIAL_FIELDS['brk'].client_cert` is documented "unused for now" pending
  the deferred InfoSec hardening pass.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration_credential import IntegrationCredential
from app.services.credential_crypto import decrypt

logger = logging.getLogger(__name__)

# D6: 60s cache TTL on the resolved credential
CRED_CACHE_TTL_SECONDS = 60

# D1: canonical source_key + credential_name for the BRK api_key row
BRK_SOURCE_KEY = "brk"
BRK_CREDENTIAL_NAME = "api_key"


class BrkCredentials(NamedTuple):
    """Resolved BRK API credentials.

    Today: api_key is the only field. mTLS cert/key stay on disk (D7).
    """

    api_key: str


class CredentialNotConfigured(Exception):
    """Raised when no IntegrationCredential row exists for the requested source.

    Maps to HTTP 503 at the router layer (D12).
    """


# Module-level in-process cache: source_key -> (creds, expires_at)
_CACHE: dict[str, tuple[BrkCredentials, datetime]] = {}


def _clear_cache_for_tests() -> None:
    """Test-only: clear the resolver cache. Production code MUST NOT call this."""
    _CACHE.clear()


async def get_brk_credentials(db: AsyncSession) -> BrkCredentials:
    """Resolve the BRK api_key from `integration_credentials` with 60s cache.

    Args:
        db: AsyncSession used for the cache-miss DB lookup.

    Returns:
        BrkCredentials(api_key=<plaintext>)

    Raises:
        CredentialNotConfigured: When no row exists for
            (source_key='brk', credential_name='api_key').
        cryptography.fernet.InvalidToken: When decryption fails (e.g. key rotated
            mid-flight). Caller maps to 503.
    """
    now = datetime.utcnow()

    cached = _CACHE.get(BRK_SOURCE_KEY)
    if cached is not None:
        creds, expires_at = cached
        if expires_at > now:
            return creds

    # Cache miss — D1: NO organization_id filter (vendor-managed)
    stmt = select(IntegrationCredential).where(
        IntegrationCredential.source_key == BRK_SOURCE_KEY,
        IntegrationCredential.credential_name == BRK_CREDENTIAL_NAME,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        raise CredentialNotConfigured(
            "BRK api_key niet geconfigureerd in integration_credentials "
            "(source_key='brk', credential_name='api_key'). "
            "Configureer via /instellingen/data-bronnen vóór persist-aanvraag."
        )

    plaintext_bytes = decrypt(row.encrypted_value)
    plaintext = plaintext_bytes.decode() if isinstance(plaintext_bytes, bytes) else plaintext_bytes
    creds = BrkCredentials(api_key=plaintext)

    _CACHE[BRK_SOURCE_KEY] = (creds, now + timedelta(seconds=CRED_CACHE_TTL_SECONDS))
    logger.debug(
        "credential_resolver.brk cache_refresh ttl=%ds",
        CRED_CACHE_TTL_SECONDS,
    )
    return creds
