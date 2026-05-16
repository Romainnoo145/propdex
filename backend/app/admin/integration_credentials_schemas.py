"""Pydantic schemas for integration-credentials admin API (M049/S05 Plan 02).

REGRESSION-CRITICAL: ``CredentialEntryRead`` has NO ``encrypted_value`` or
``value`` field. TEST-03c asserts the response shape exactly.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CredentialEntryRead(BaseModel):
    """Public read shape — see TEST-03c regression assertion."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_key: str
    credential_name: str
    configured: bool
    configured_at: datetime | None
    last_rotated_at: datetime | None


class CredentialCreate(BaseModel):
    """Create payload — plaintext value is encrypted server-side before insert."""

    model_config = ConfigDict(extra="forbid")

    source_key: str
    credential_name: str
    value: str  # plaintext — encrypted server-side before insert
