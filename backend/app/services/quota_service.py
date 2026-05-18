"""quota_service — paid-API lookup counter (stub for M050/S02).

Per M050/S02 ENG-PLAN locked 2026-05-18 (D8):

- Emit-hook-only in S02: `record_brk_lookup` is an async no-op that returns
  `None`. The full counter (decrement + tier-limit ledger) lands in
  **M050.5/S02**; pre-flight `assert_can_lookup` enforcement lands in
  **M050/S07** wiring.

- **Call site contract** (locked for S02 + future-compat):
    Called AFTER Txn2 commit on the cache-MISS path only. Cache-HIT path SKIPS
    it (no credit spent). Caller MUST wrap in try/except — quota recording is
    non-blocking; a failure here MUST NOT roll back the persist-write.
"""
from __future__ import annotations

import logging
import uuid

logger = logging.getLogger(__name__)


async def record_brk_lookup(
    organization_id: uuid.UUID,
    parcel_id: str,
) -> None:
    """STUB. Records a BRK lookup against the org's quota counter.

    M050.5/S02 implements the counter. Today: log + return None (no-op).

    Args:
        organization_id: The organization whose quota is being charged.
        parcel_id: The parcel that was looked up (for audit trail).
    """
    logger.debug(
        "quota_service.brk_lookup org=%s parcel=%s (stub, no-op)",
        organization_id,
        parcel_id,
    )
    return None
