"""M049/S02 admin data-source probe-registry + lock-key helper.

Probe-registry pattern (strangler-fig): Type-B and Type-C probes are stubs today.
Later milestones swap them for live probes without touching data_sources_router.py.
"""

import hashlib
from collections.abc import Awaitable, Callable
from typing import TypedDict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.policy_document import PolicyDocument


class ProbeResult(TypedDict):
    status: str  # one of DataSourceStatusValue
    error_message: str | None


ProbeFn = Callable[[str, str, AsyncSession], Awaitable[ProbeResult]]


def compute_lock_key(gemeente_code: str, source_key: str) -> int:
    """Cross-process stable 63-bit lock key (PYTHONHASHSEED-safe).

    Uses blake2b 8-byte digest masked to int8 positive range for
    pg_try_advisory_xact_lock(bigint).

    Python's hash() is PYTHONHASHSEED-randomized across processes — multiple
    workers would compute different keys, defeating cross-worker lock protection.
    blake2b is deterministic regardless of runtime environment.
    """
    raw = f"{gemeente_code}:{source_key}".encode()
    digest = hashlib.blake2b(raw, digest_size=8).digest()
    return int.from_bytes(digest, "big", signed=False) & 0x7FFFFFFFFFFFFFFF


async def probe_type_a_cascade(
    source_key: str,
    gemeente_code: str,
    db: AsyncSession,
) -> ProbeResult:
    """Count vendor PolicyDocument rows for this (gemeente, source_key).

    PolicyDocument uses entity_type='gemeente' + entity_code=<code>,
    NOT a `gemeente_code` column. is_global=True filters to vendor uploads
    only — klant-org overrides don't flip vendor catalog state.

    count > 0 → live; count == 0 → missing.
    """
    count = await db.scalar(
        select(func.count())
        .select_from(PolicyDocument)
        .where(PolicyDocument.entity_type == "gemeente")
        .where(PolicyDocument.entity_code == gemeente_code)
        .where(PolicyDocument.source_key == source_key)
        .where(PolicyDocument.is_global.is_(True))
    )
    if count and count > 0:
        return {"status": "live", "error_message": None}
    return {"status": "missing", "error_message": "No vendor PolicyDocument rows found"}


async def probe_type_b_stub(
    source_key: str,
    gemeente_code: str,
    db: AsyncSession,
) -> ProbeResult:
    """Type-B (open APIs) — live probe deferred to later milestone."""
    return {
        "status": "not_applicable",
        "error_message": "Open-API probe not yet wired (deferred to later milestone)",
    }


async def probe_type_c_stub(
    source_key: str,
    gemeente_code: str,
    db: AsyncSession,
) -> ProbeResult:
    """Type-C (paid integrations) — awaits S05 IntegrationCredential support."""
    return {
        "status": "missing",
        "error_message": "Awaiting S05 IntegrationCredential support",
    }


PROBE_REGISTRY: dict[str, ProbeFn] = {
    "A": probe_type_a_cascade,
    "B": probe_type_b_stub,
    "C": probe_type_c_stub,
}
