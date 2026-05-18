"""brk_fetch_service — BRK fetch + persist orchestration (M050/S02).

Implements decisions D3/D4/D5/D6/D8/D9/D10/D12 from M050/S02 ENG-PLAN locked
2026-05-18 (see ``.planning/milestones/M050-S02-ENG-PLAN.md``). Distinct from
the Phase 105 ephemeral channel which MUST NOT persist.

- D3 30-day cache TTL via ``get_latest_for_parcel``.
- D4 two-txn boundary: Txn1 lock+cache → HTTP outside any txn → Txn2 persist.
- D5 advisory-lock dedup via ``pg_try_advisory_xact_lock(hash(org, parcel))``
  with stable ``hashlib.sha256`` keys (Python ``hash()`` is per-process random).
- D6 per-request ``build_brk_client(creds)`` factory consumed in HTTP phase.
- D8 ``record_brk_lookup`` AFTER Txn2 commit, wrapped non-blocking.
- D9 return shape ``list[BRKOwnershipRecordRead]`` — persist-channel schema only.
- D10 import direction: this module imports from ``brk_persistence_service``;
  the reverse is FORBIDDEN.
- D12 service-layer no-fastapi: typed Python exceptions only; the router
  (``brk_router.py``) maps them to HTTP status codes.
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any

import httpx
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.brk_bevragen import (
    BRKBevragenClient,
    _create_brk_ssl_context,
    build_brk_client,
)
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.schemas.brk_ownership_record import (
    BRKOwnershipRecordCreate,
    BRKOwnershipRecordRead,
)
from app.services.brk_persistence_service import persist_record
from app.services.credential_resolver import (
    BrkCredentials,
    get_brk_credentials,
)
from app.services.quota_service import record_brk_lookup

logger = logging.getLogger(__name__)

# D3 — within CACHE_TTL_DAYS, the newest row for (org, parcel) is a cache HIT.
CACHE_TTL_DAYS = 30


class ParcelNotFound(Exception):
    """Raised when parcel does not exist for this org (D12 → router maps to 404)."""


class CrossOrgParcelAccess(Exception):
    """Raised when parcel exists in a different org (D12 → router maps to 403)."""


def _lock_key(organization_id: uuid.UUID, parcel_id: str) -> int:
    """Derive a stable signed 64-bit lock key from (org_id, parcel_id).

    Python's built-in ``hash()`` is per-process random (PYTHONHASHSEED) — unsafe
    for cross-process advisory locks. Use a stable SHA-256 truncation instead.
    """
    digest = hashlib.sha256(f"{organization_id}:{parcel_id}".encode()).digest()
    return int.from_bytes(digest[:8], byteorder="big", signed=True)


async def _acquire_advisory_lock(
    db: AsyncSession, organization_id: uuid.UUID, parcel_id: str
) -> bool:
    """D5: try-acquire ``pg_try_advisory_xact_lock(hash(org, parcel))``.

    Returns True if acquired (winner — proceeds with fetch). Returns False if
    contended (caller should wait + re-read cache). Lock is xact-scoped:
    auto-released at commit/rollback. SET LOCAL + asyncpg cannot use $1
    parameters, so the int is inlined (safe: derived from validated UUID + str).
    """
    key = _lock_key(organization_id, parcel_id)
    result = await db.execute(
        sa.text(f"SELECT pg_try_advisory_xact_lock({key}) AS acquired")
    )
    return bool(result.scalar_one())


async def _wait_for_advisory_lock(
    db: AsyncSession, organization_id: uuid.UUID, parcel_id: str
) -> None:
    """D5 contended-path: block until the lock is released by the winner."""
    key = _lock_key(organization_id, parcel_id)
    await db.execute(sa.text(f"SELECT pg_advisory_xact_lock({key})"))


async def get_latest_for_parcel(
    db: AsyncSession, organization_id: uuid.UUID, parcel_id: str
) -> list[BRKOwnershipRecordRead]:
    """Return all non-soft-deleted rows for (org, parcel), newest fetched_at first.

    Empty list = cache MISS. Non-empty + newest within CACHE_TTL_DAYS = HIT.
    Non-empty + newest older than CACHE_TTL_DAYS = stale → refetch.

    Backed by partial composite index ``idx_brk_latest`` (D15, Plan 02-01).
    """
    result = await db.execute(
        select(BrkOwnershipRecord)
        .where(
            BrkOwnershipRecord.organization_id == organization_id,
            BrkOwnershipRecord.parcel_id == parcel_id,
            BrkOwnershipRecord.soft_deleted_at.is_(None),
        )
        .order_by(BrkOwnershipRecord.fetched_at.desc())
    )
    rows = result.scalars().all()
    return [BRKOwnershipRecordRead.model_validate(r) for r in rows]


def _is_cache_fresh(records: list[BRKOwnershipRecordRead]) -> bool:
    """D3: True if newest fetched_at is within CACHE_TTL_DAYS of now."""
    if not records:
        return False
    newest = max(r.fetched_at for r in records)
    return (datetime.utcnow() - newest) < timedelta(days=CACHE_TTL_DAYS)


def _parse_brk_response_into_records(
    raw: dict[str, Any],
    parcel_id: str,
) -> list[BRKOwnershipRecordCreate]:
    """Translate the BRK Bevragen response → persist-shape records.

    Mirrors ``property_aggregator._parse_perceel_ownership`` (canonical Phase
    105 parser). AVG defense layer 1: SKIPS entries with
    ``persoon.type == "NatuurlijkPersoon"``. Only rechtspersoon + overheid
    reach the persistence layer (DB CHECK is layer 3). The full ``raw`` is
    passed through to each record's raw_brk_response — ``persist_record``
    applies the D2 strip helper before INSERT.
    """
    embedded = raw.get("_embedded", {})
    raw_gerechtigden = embedded.get("zakelijkGerechtigden", []) or []

    records: list[BRKOwnershipRecordCreate] = []
    for item in raw_gerechtigden:
        persoon = item.get("persoon", {}) or {}
        persoon_type = persoon.get("type", "")

        if persoon_type == "NatuurlijkPersoon":
            continue  # AVG layer 1: drop natural persons before persist
        if persoon_type != "NietNatuurlijkPersoon":
            continue  # unknown / onbekend — DB CHECK would reject anyway

        eigenaar_type: str = "rechtspersoon"

        # Detect overheid (mirrors aggregator)
        beschikkings = item.get("beschikkingsbevoegdheid", {}) or {}
        if beschikkings.get("code") == "PubliekrechtelijkRechtspersoon":
            eigenaar_type = "overheid"
        naam_val = persoon.get("statutaireNaam") or persoon.get("naam") or ""
        if any(
            kw in naam_val.lower()
            for kw in (
                "gemeente ",
                "waterschap ",
                "provincie ",
                "staat der nederlanden",
                "rijksvastgoedbedrijf",
            )
        ):
            eigenaar_type = "overheid"

        naam: str | None = persoon.get("statutaireNaam") or persoon.get("naam")
        kvk_nummer: str | None = persoon.get("kvkNummer")
        statutaire_zetel: str | None = persoon.get("statutaireZetel")
        zakelijk_recht_type: str | None = item.get("type")

        aandeel_data = item.get("aandeel", {}) or {}
        aandeel: str | None = None
        teller = aandeel_data.get("teller")
        noemer = aandeel_data.get("noemer")
        if teller is not None and noemer is not None:
            aandeel = f"{teller}/{noemer}"

        koopsom: int | None = None
        koopjaar: int | None = None
        for stuk in item.get("stukken", []) or []:
            ks = stuk.get("koopsom", {}) or {}
            if ks.get("koopsom"):
                koopsom = int(ks["koopsom"])
                koopjaar = ks.get("koopjaar")
                break
        if koopsom is None:
            top_ks = item.get("koopsom", {}) or {}
            if top_ks.get("koopsom"):
                koopsom = int(top_ks["koopsom"])
                koopjaar = top_ks.get("koopjaar")

        heeft_hypotheek = bool(
            zakelijk_recht_type and "Hypotheek" in zakelijk_recht_type
        )

        records.append(
            BRKOwnershipRecordCreate(
                parcel_id=parcel_id,
                eigenaar_type=eigenaar_type,
                eigenaar_naam=naam,
                kvk_nummer=kvk_nummer,
                statutaire_zetel=statutaire_zetel,
                zakelijk_recht_type=zakelijk_recht_type,
                aandeel=aandeel,
                koopsom=koopsom,
                koopjaar=koopjaar,
                heeft_hypotheek=heeft_hypotheek,
                raw_brk_response=raw,
            )
        )
    return records


async def _call_kadaster(creds: BrkCredentials, parcel_id: str) -> dict[str, Any]:
    """D4 + D6: HTTP-Kadaster call OUTSIDE any DB transaction.

    Mirrors Phase 105 http-client construction: D6 factory client + mTLS
    ``httpx.AsyncClient`` against the configured SSL context.
    """
    client: BRKBevragenClient = build_brk_client(creds)
    ssl_context = _create_brk_ssl_context()
    async with httpx.AsyncClient(verify=ssl_context, timeout=30.0) as http_client:
        return await client.get_eigendom(parcel_id, http_client)


async def fetch_and_persist(
    db: AsyncSession, organization_id: uuid.UUID, parcel_id: str
) -> list[BRKOwnershipRecordRead]:
    """Orchestrate D4 + D5 + D3 + D6 + D8 — the BRK persist write-path.

    Flow::

        Txn1: try-acquire advisory lock → cache-check → commit
            HIT (<30d)   → return cached (no HTTP, no quota)
            MISS / stale → continue
            contended    → wait → re-read cache → return cached
        HTTP-Kadaster (no DB locks held): get_brk_credentials → get_eigendom
        Txn2: persist_record loop → commit
        AFTER commit: record_brk_lookup wrapped in try/except (D8 non-blocking)

    D12: typed Python exceptions only; router maps to HTTP status codes.
    D9: returns ``list[BRKOwnershipRecordRead]`` (persist-channel schema only).
    """
    # === Txn 1 — advisory lock + cache check ===
    acquired = await _acquire_advisory_lock(db, organization_id, parcel_id)
    if not acquired:
        await _wait_for_advisory_lock(db, organization_id, parcel_id)
        cached = await get_latest_for_parcel(db, organization_id, parcel_id)
        await db.commit()  # release lock + close Txn1
        logger.info(
            "brk.fetch.cache_hit_via_lock_wait org=%s parcel=%s rows=%d",
            organization_id, parcel_id, len(cached),
        )
        return cached

    cached = await get_latest_for_parcel(db, organization_id, parcel_id)
    await db.commit()  # release lock + close Txn1

    if _is_cache_fresh(cached):
        logger.info(
            "brk.fetch.cache_hit org=%s parcel=%s rows=%d",
            organization_id, parcel_id, len(cached),
        )
        return cached  # D3: no HTTP, no quota spend

    # === HTTP-Kadaster (no DB locks held) ===
    creds: BrkCredentials = await get_brk_credentials(db)
    raw = await _call_kadaster(creds, parcel_id)
    records_to_persist = _parse_brk_response_into_records(raw, parcel_id)

    # === Txn 2 — persist loop ===
    for record_data in records_to_persist:
        await persist_record(db, organization_id, record_data)
    await db.commit()

    # === D8 quota hook (AFTER Txn2 commit, non-blocking) ===
    try:
        await record_brk_lookup(organization_id, parcel_id)
    except Exception:  # noqa: BLE001 — non-blocking by contract (D8)
        logger.exception(
            "brk.fetch.quota_hook_failed org=%s parcel=%s (non-blocking)",
            organization_id, parcel_id,
        )

    logger.info(
        "brk.fetch.persisted org=%s parcel=%s rows=%d",
        organization_id, parcel_id, len(records_to_persist),
    )
    return await get_latest_for_parcel(db, organization_id, parcel_id)
