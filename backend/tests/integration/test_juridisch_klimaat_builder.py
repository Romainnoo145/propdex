"""Integration tests for juridisch_klimaat_builder.build_juridisch_klimaat_payload.

Seeds RulingCache in propdex_test and validates the payload shape consumed by
score_v3 factors (score_vergunning_succeskans, score_juridisch_klimaat).
"""

from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ruling_cache import RulingCache
from app.services.juridisch_klimaat_builder import build_juridisch_klimaat_payload


def _make_ruling(
    ecli: str, gemeente: str, uitkomst: str, vergunningstype: str | None
) -> RulingCache:
    ai_analysis: dict = {"uitkomst": uitkomst}
    if vergunningstype is not None:
        ai_analysis["vergunningstype"] = vergunningstype
    return RulingCache(
        ecli=ecli,
        court_code="RBAMS",
        gemeente_query=gemeente,
        fetched_at=datetime.utcnow(),
        ai_analysis=ai_analysis,
        vergunningstype=vergunningstype,
        uitkomst=uitkomst,
        full_text="sample",
    )


@pytest.mark.asyncio
async def test_payload_dev_filtered_on_canonical_mixed_fixture(test_db: AsyncSession):
    """13-ruling mixed dataset — dev-filtered payload matches aggregator output."""
    rulings = [
        # 5 nieuwbouw: 3T/2A
        _make_ruling("ECLI:NL:TEST:2024:BN1", "BuilderDorp", "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:BN2", "BuilderDorp", "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:BN3", "BuilderDorp", "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:BN4", "BuilderDorp", "afgewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:BN5", "BuilderDorp", "afgewezen", "nieuwbouw"),
        # 5 dakopbouw: 1T/4A
        _make_ruling("ECLI:NL:TEST:2024:BD1", "BuilderDorp", "toegewezen", "dakopbouw"),
        _make_ruling("ECLI:NL:TEST:2024:BD2", "BuilderDorp", "afgewezen", "dakopbouw"),
        _make_ruling("ECLI:NL:TEST:2024:BD3", "BuilderDorp", "afgewezen", "dakopbouw"),
        _make_ruling("ECLI:NL:TEST:2024:BD4", "BuilderDorp", "afgewezen", "dakopbouw"),
        _make_ruling("ECLI:NL:TEST:2024:BD5", "BuilderDorp", "afgewezen", "dakopbouw"),
        # 2 milieu, 1 bestemmingswijziging
        _make_ruling("ECLI:NL:TEST:2024:BM1", "BuilderDorp", "afgewezen", "milieu"),
        _make_ruling("ECLI:NL:TEST:2024:BM2", "BuilderDorp", "afgewezen", "milieu"),
        _make_ruling("ECLI:NL:TEST:2024:BB1", "BuilderDorp", "toegewezen", "bestemmingswijziging"),
    ]
    for r in rulings:
        test_db.add(r)
    await test_db.commit()

    payload = await build_juridisch_klimaat_payload(test_db, "BuilderDorp")

    assert payload is not None
    # Dev-filtered: 4 toegewezen / 6 dev-rulings → succeskans=67 → approval_rate=0.67
    assert payload["approval_rate"] == pytest.approx(0.67, abs=0.01)
    assert payload["ruling_count"] == 13
    assert payload["ruling_count_dev_types"] == 6
    assert payload["missing"] is False
    assert payload["reason"] is None


@pytest.mark.asyncio
async def test_payload_returns_none_when_no_rulings(test_db: AsyncSession):
    """Empty DB → return None so caller omits the juridisch_klimaat key."""
    payload = await build_juridisch_klimaat_payload(test_db, "LeegDorp")
    assert payload is None


@pytest.mark.asyncio
async def test_payload_missing_when_below_threshold(test_db: AsyncSession):
    """3 nieuwbouw < MIN_DEV_RULINGS_FOR_AGGREGATION=5 → missing=True, approval_rate=0.5."""
    rulings = [
        _make_ruling("ECLI:NL:TEST:2024:SN1", "SparseBuilderDorp", "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:SN2", "SparseBuilderDorp", "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:SN3", "SparseBuilderDorp", "toegewezen", "nieuwbouw"),
    ]
    for r in rulings:
        test_db.add(r)
    await test_db.commit()

    payload = await build_juridisch_klimaat_payload(test_db, "SparseBuilderDorp")

    assert payload is not None
    assert payload["missing"] is True
    assert payload["reason"] == "insufficient_dev_type_rulings"
    assert payload["approval_rate"] == 0.5  # neutral default when succeskans=None
    assert payload["ruling_count"] == 3
    assert payload["ruling_count_dev_types"] == 3
