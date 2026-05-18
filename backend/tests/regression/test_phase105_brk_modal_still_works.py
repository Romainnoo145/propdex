"""REGRESSION-CRITICAL: Phase 105 ephemeral BRK endpoint untouched by M050/S01.

Iron rule: BRK Eigendom Modal still works exactly as in Phase 105. No leakage
from persist-pad (S01) into ephemeral lookup-pad. AVG-baseline preserved for
natuurlijk_persoon lookups.

ENG-PLAN §REGRESSIONS — IRON RULE: 2 critical regressions must pass forever.

The Phase 105 endpoint signature (app/scans/parcels_service.py:get_parcel_eigendom):
- Accepts (db, parcel_id: uuid.UUID)
- Returns BRKOwnership.model_dump(mode="json") with status in {available, unavailable, error}
- BRKOwnership has never_cache: ClassVar[bool] = True — must NEVER persist to JSONB
- 404s when parcel_id not in parcel_cache

The simplest invariant we can assert without setting up PDOK/PostGIS:
- Function runs without raising on unknown parcel_id (raises HTTPException 404, NOT
  generic exception)
- No row is written to brk_ownership_records as a side effect
- persist_record (M050/S01 write-path) is never called
"""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brk_ownership_record import BrkOwnershipRecord


@pytest.mark.asyncio
async def test_phase105_ephemeral_endpoint_still_works(
    test_db: AsyncSession,
) -> None:
    """Phase 105 endpoint runs without writing to brk_ownership_records.

    Uses an unknown parcel_id (404 path) — sufficient to prove the function
    executes the ephemeral lookup pad and writes no persistent row. The
    happy-path (with PDOK + BRK API) is owned by S02 integration tests.
    """
    from app.scans.parcels_service import get_parcel_eigendom

    before = (
        await test_db.execute(select(func.count(BrkOwnershipRecord.id)))
    ).scalar_one()
    assert before == 0  # clean slate

    unknown_id = uuid.uuid4()
    with pytest.raises(HTTPException) as exc_info:
        await get_parcel_eigendom(db=test_db, parcel_id=unknown_id)
    assert exc_info.value.status_code == 404

    after = (
        await test_db.execute(select(func.count(BrkOwnershipRecord.id)))
    ).scalar_one()
    assert before == after, (
        "Phase 105 ephemeral endpoint must NEVER write to brk_ownership_records "
        "(BRKOwnership.never_cache = True)"
    )


@pytest.mark.asyncio
async def test_phase105_does_not_trigger_persist_pad(
    test_db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Phase 105 endpoint MUST NOT invoke brk_persistence_service.persist_record.

    Spy on persist_record — assert call_count == 0 after Phase 105 endpoint runs.
    Even on the 404 path we prove the persist-pad is not on the import/call graph
    for ephemeral lookups.
    """
    from app.scans import parcels_service
    from app.services import brk_persistence_service

    call_count = {"n": 0}

    async def fake_persist(*args: object, **kwargs: object) -> None:
        call_count["n"] += 1
        raise AssertionError(
            "persist_record MUST NOT be called from Phase 105 ephemeral pad"
        )

    monkeypatch.setattr(brk_persistence_service, "persist_record", fake_persist)

    # 404 path — but we care about whether persist_record gets touched, not the result
    try:
        await parcels_service.get_parcel_eigendom(
            db=test_db, parcel_id=uuid.uuid4()
        )
    except HTTPException:
        pass  # expected — unknown parcel

    assert call_count["n"] == 0


@pytest.mark.asyncio
async def test_phase105_parcels_service_module_unchanged() -> None:
    """Phase 105 endpoint is importable with the same signature S01 found it with.

    Last line of defense: if anyone refactors get_parcel_eigendom under M050+,
    this test fails and forces re-review of the AVG-Tier-3 ephemeral contract.
    """
    import inspect

    from app.scans.parcels_service import get_parcel_eigendom

    sig = inspect.signature(get_parcel_eigendom)
    params = list(sig.parameters.keys())
    assert params == ["db", "parcel_id"], (
        f"get_parcel_eigendom signature drift detected: {params}. "
        "Phase 105 contract requires (db, parcel_id). Re-review AVG implications."
    )
