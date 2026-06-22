"""Integration tests: list_favorites score enrichment from scan_results.

Pins the behavior that ``list_favorites`` joins each favorite (by
``parcel_cache_id``) to its ScanResult and surfaces ``potentie_score`` /
``risico_score`` from ``flags["scores"]``. This is the safety net for the
query rewrite that drops the redundant per-parcel DISTINCT-ON dedup (a
``UNIQUE(parcel_id)`` constraint on scan_results guarantees one row/parcel).

Covers:
- enrichment hit: favorite -> ScanResult on a completed scan -> scores returned
- completed-only: a favorite whose ScanResult sits on a non-completed scan -> None
- favorite with no ScanResult -> None
"""
from __future__ import annotations

import pytest
from geoalchemy2 import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.favorites.favorites_service import list_favorites
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.parcel_favorite import ParcelFavorite
from app.models.scan_result import ScanResult


async def _parcel_with_scan(
    test_db: AsyncSession,
    code: str,
    *,
    potentie: float,
    risico: float,
    status: str = "completed",
    x: int = 155000,
    y: int = 463000,
) -> ParcelCache:
    """Create a ParcelCache + AreaScan(status) + ScanResult with scores."""
    parcel = ParcelCache(
        parcel_id=code,
        parcel_code=code,
        geometry=WKTElement(
            f"MULTIPOLYGON((({x} {y},{x + 10} {y},{x + 10} {y + 10},{x} {y + 10},{x} {y})))",
            srid=28992,
        ),
        address=f"{code} straat 1",
        gemeente_code="0983",
        area_m2=120.0,
        has_pand=True,
        bestemmingen=[],
    )
    test_db.add(parcel)
    await test_db.flush()

    scan = AreaScan(
        gemeente_code="0983",
        gemeente_naam="Venlo",
        wijk_naam="Centrum",
        bbox_minx=x,
        bbox_miny=y,
        bbox_maxx=x + 10,
        bbox_maxy=y + 10,
        status=status,
        progress_pct=100,
        parcels_total=1,
        parcels_processed=1,
        parcels_failed=0,
    )
    test_db.add(scan)
    await test_db.flush()

    test_db.add(
        ScanResult(
            scan_id=scan.id,
            parcel_id=parcel.id,
            score=potentie,
            flags={"scores": {"potentie": potentie, "risico": risico}},
        )
    )
    await test_db.flush()
    return parcel


@pytest.mark.asyncio
async def test_favorite_enriched_with_scan_scores(
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """A favorite linked (via parcel_cache_id) to a completed-scan ScanResult
    surfaces that ScanResult's potentie/risico scores."""
    user, _org = await create_test_user(email="score-hit@example.com", org_name="ScoreHit Org")
    parcel = await _parcel_with_scan(test_db, "VENLO-SC1", potentie=72.4, risico=31.6)
    test_db.add(
        ParcelFavorite(
            user_id=user.id,
            parcel_id="VENLO-SC1",
            parcel_cache_id=parcel.id,
            pipeline_stage="Gesignaleerd",
            gemeente_naam="Venlo",
        )
    )
    await test_db.commit()

    favs = await list_favorites(user_id=user.id, db=test_db)

    assert len(favs) == 1
    assert favs[0].potentie_score == 72.4
    assert favs[0].risico_score == 31.6


@pytest.mark.asyncio
async def test_favorite_scores_only_from_completed_scan(
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """A favorite whose only ScanResult sits on a non-completed scan gets None
    scores (the completed-only filter must survive the rewrite)."""
    user, _org = await create_test_user(email="score-pending@example.com", org_name="Pending Org")
    parcel = await _parcel_with_scan(
        test_db, "VENLO-SC2", potentie=88.0, risico=12.0, status="running"
    )
    test_db.add(
        ParcelFavorite(
            user_id=user.id,
            parcel_id="VENLO-SC2",
            parcel_cache_id=parcel.id,
            pipeline_stage="Gesignaleerd",
            gemeente_naam="Venlo",
        )
    )
    await test_db.commit()

    favs = await list_favorites(user_id=user.id, db=test_db)

    assert len(favs) == 1
    assert favs[0].potentie_score is None
    assert favs[0].risico_score is None


@pytest.mark.asyncio
async def test_favorite_without_scan_has_none_scores(
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """A favorite with no ScanResult at all returns None scores (LEFT JOIN)."""
    user, _org = await create_test_user(email="score-miss@example.com", org_name="ScoreMiss Org")
    test_db.add(
        ParcelFavorite(
            user_id=user.id,
            parcel_id="VENLO-SC3",
            pipeline_stage="Gesignaleerd",
            gemeente_naam="Venlo",
        )
    )
    await test_db.commit()

    favs = await list_favorites(user_id=user.id, db=test_db)

    assert len(favs) == 1
    assert favs[0].potentie_score is None
    assert favs[0].risico_score is None
