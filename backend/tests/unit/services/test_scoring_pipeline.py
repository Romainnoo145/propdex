"""Unit tests for app.services.scoring_pipeline (M050/S03 Plan 03-01).

Covers D1 + D8 + D9 non-regression-critical paths:
- D8 FF=False short-circuit (no key inserted)
- empty-result path (empty list inserted)
- soft_deleted_at IS NOT NULL exclusion
- ORDER BY fetched_at DESC honored

REGRESSION-CRITICAL F2 (organization_id filter) is pinned separately in
backend/tests/regression/test_m050_s03_multitenant.py.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.services.scoring_pipeline import enrich_parcel_data_with_brk


def _make_record(
    org_id,
    parcel_id: str,
    **overrides,
) -> BrkOwnershipRecord:
    """Build a fully-populated BrkOwnershipRecord for fixture seeding."""
    defaults: dict = {
        "organization_id": org_id,
        "parcel_id": parcel_id,
        "eigenaar_type": "rechtspersoon",
        "eigenaar_naam": "Acme BV",
        "kvk_nummer": "12345678",
        "statutaire_zetel": "Amsterdam",
        "zakelijk_recht_type": "eigendom",
        "aandeel": "1/1",
        "koopsom": Decimal("250000.00"),
        "koopjaar": 2015,
        "heeft_hypotheek": True,
        "raw_brk_response": None,
        "fetched_at": datetime.utcnow(),
        "soft_deleted_at": None,
        "hard_delete_after": None,
    }
    defaults.update(overrides)
    return BrkOwnershipRecord(**defaults)


# ──────────────────────────────────────────────────────────────────────────
# D8 — feature flag short-circuit
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_enrich_returns_unchanged_when_flag_off(
    test_db: AsyncSession,
    create_test_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """D8: when M050_S03_FACTORS_ENABLED=False, parcel_data returned UNCHANGED.

    Critically: the 'brk_records' key is NOT inserted, so factor functions
    observe None via parcel_data.get('brk_records') and call _missing_brk.
    """
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", False)
    _, org = await create_test_user()
    # Even with a real row present, the flag-off path must short-circuit
    # without executing the query.
    test_db.add(_make_record(org.id, "NL.IMKAD.FFOff.1"))
    await test_db.commit()

    parcel_data: dict = {"parcel_id": "NL.IMKAD.FFOff.1"}
    result = await enrich_parcel_data_with_brk(parcel_data, org.id, test_db)

    assert "brk_records" not in result, (
        "D8 violation: FF=False must NOT insert 'brk_records' key. "
        "Factor functions rely on the key's absence to trigger _missing_brk."
    )
    # Same dict identity returned (caller-side ergonomics)
    assert result is parcel_data


# ──────────────────────────────────────────────────────────────────────────
# D1 — empty-result path
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_enrich_empty_result_returns_empty_list(
    test_db: AsyncSession,
    create_test_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No matching rows → parcel_data['brk_records'] == [] (NOT missing key)."""
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)
    _, org = await create_test_user()
    # No BRK rows seeded for this parcel

    parcel_data: dict = {"parcel_id": "NL.IMKAD.Empty.1"}
    result = await enrich_parcel_data_with_brk(parcel_data, org.id, test_db)

    assert "brk_records" in result
    assert result["brk_records"] == []


# ──────────────────────────────────────────────────────────────────────────
# D1 — soft_deleted_at IS NOT NULL exclusion
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_enrich_excludes_soft_deleted_rows(
    test_db: AsyncSession,
    create_test_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """soft_deleted_at IS NOT NULL rows are excluded from enrich output."""
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)
    _, org = await create_test_user()

    parcel_id = "NL.IMKAD.Soft.1"
    test_db.add_all(
        [
            _make_record(
                org.id,
                parcel_id,
                eigenaar_naam="LIVE BV",
                soft_deleted_at=None,
            ),
            _make_record(
                org.id,
                parcel_id,
                eigenaar_naam="DELETED BV",
                soft_deleted_at=datetime.utcnow(),
                # Distinct fetched_at to satisfy UNIQUE (org, parcel, fetched_at)
                fetched_at=datetime.utcnow() - timedelta(seconds=1),
            ),
        ]
    )
    await test_db.commit()

    parcel_data: dict = {"parcel_id": parcel_id}
    result = await enrich_parcel_data_with_brk(parcel_data, org.id, test_db)

    assert len(result["brk_records"]) == 1
    assert result["brk_records"][0]["eigenaar_naam"] == "LIVE BV"


# ──────────────────────────────────────────────────────────────────────────
# D1 — ORDER BY fetched_at DESC
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_enrich_orders_by_fetched_at_desc(
    test_db: AsyncSession,
    create_test_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Records returned ORDER BY fetched_at DESC (most recent first).

    koopwaarde_trend factor (Plan 03-02) takes brk_records[0] as the
    'most-recent record' — order here is load-bearing for D6.
    """
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)
    _, org = await create_test_user()

    parcel_id = "NL.IMKAD.Order.1"
    now = datetime.utcnow()
    test_db.add_all(
        [
            _make_record(
                org.id,
                parcel_id,
                eigenaar_naam="2-DAYS-OLD",
                fetched_at=now - timedelta(days=2),
                koopjaar=2010,
            ),
            _make_record(
                org.id,
                parcel_id,
                eigenaar_naam="1-DAY-OLD",
                fetched_at=now - timedelta(days=1),
                koopjaar=2015,
            ),
            _make_record(
                org.id,
                parcel_id,
                eigenaar_naam="MOST-RECENT",
                fetched_at=now,
                koopjaar=2020,
            ),
        ]
    )
    await test_db.commit()

    parcel_data: dict = {"parcel_id": parcel_id}
    result = await enrich_parcel_data_with_brk(parcel_data, org.id, test_db)

    records = result["brk_records"]
    assert len(records) == 3
    # Most recent first
    assert records[0]["eigenaar_naam"] == "MOST-RECENT"
    assert records[0]["koopjaar"] == 2020
    # Oldest last
    assert records[2]["eigenaar_naam"] == "2-DAYS-OLD"
    assert records[2]["koopjaar"] == 2010

    # Sanity: fetched_at coerced to ISO-8601 string (D1 boundary contract)
    assert isinstance(records[0]["fetched_at"], str)
    # koopsom coerced to float (D1 boundary contract — Decimal → float)
    assert isinstance(records[0]["koopsom"], float)
