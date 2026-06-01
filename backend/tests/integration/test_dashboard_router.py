"""M052/S03 — Dashboard router (twee-signalen acquisitie-radar) tests."""

import pytest
from geoalchemy2 import WKTElement
from httpx import AsyncClient

from app.auth.jwt import create_access_token
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.parcel_favorite import ParcelFavorite
from app.models.scan_result import ScanResult


async def _user_headers(create_test_user, **kwargs):
    """Create a user + org and return (user, org, bearer-headers)."""
    user, org = await create_test_user(**kwargs)
    token = create_access_token(str(user.id), str(org.id))
    return user, org, {"Authorization": f"Bearer {token}"}


async def _scored_parcel(test_db, code, gemeente_naam, potentie, *, x=155000, y=463000):
    """Create a ParcelCache + completed AreaScan + ScanResult with a potentie score."""
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
        bouwjaar=1980,
        pand_status="Pand in gebruik",
        bestemmingen=[],
        enrichment_data=None,
        enriched_at=None,
    )
    test_db.add(parcel)
    await test_db.flush()

    scan = AreaScan(
        gemeente_code="0983",
        gemeente_naam=gemeente_naam,
        wijk_naam="Centrum",
        project_id=None,
        bbox_minx=x,
        bbox_miny=y,
        bbox_maxx=x + 10,
        bbox_maxy=y + 10,
        status="completed",
        progress_pct=100,
        current_phase=None,
        parcels_total=1,
        parcels_processed=1,
        parcels_failed=0,
        coverage_ratio=None,
        address_resolution_ratio=None,
        error_detail=None,
        neighborhood_metrics=None,
        error_message=None,
        started_at=None,
        completed_at=None,
        job_id=None,
    )
    test_db.add(scan)
    await test_db.flush()

    test_db.add(
        ScanResult(
            scan_id=scan.id,
            parcel_id=parcel.id,
            score=potentie,
            flags={"scores": {"potentie": potentie, "risico": 30.0}},
        )
    )
    await test_db.flush()
    return parcel


@pytest.mark.asyncio
async def test_pijplijn_counts_per_stage(async_client: AsyncClient, create_test_user, test_db):
    """Pijplijn-strip telt de favorites van de huidige user per pipeline_stage."""
    user, org, headers = await _user_headers(create_test_user)
    for code, stage in [
        ("VENLO-A1", "Gesignaleerd"),
        ("VENLO-A2", "Gesignaleerd"),
        ("VENLO-A3", "Onderzoek"),
    ]:
        test_db.add(
            ParcelFavorite(
                parcel_id=code,
                user_id=user.id,
                pipeline_stage=stage,
                gemeente_naam="Venlo",
            )
        )
    await test_db.commit()

    resp = await async_client.get("/api/dashboard/pijplijn", headers=headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    counts = {row["stage"]: row["count"] for row in data["stages"]}
    assert counts["Gesignaleerd"] == 2
    assert counts["Onderzoek"] == 1


@pytest.mark.asyncio
async def test_pijplijn_does_not_leak_other_users(
    async_client: AsyncClient, create_test_user, test_db
):
    """IRON RULE: een user ziet nooit de pijplijn van een andere user/org."""
    user_a, _, headers_a = await _user_headers(create_test_user, email="a@example.com", org_name="Org A")
    user_b, _, _ = await _user_headers(create_test_user, email="b@example.com", org_name="Org B")

    test_db.add(ParcelFavorite(parcel_id="A-1", user_id=user_a.id, pipeline_stage="Gesignaleerd"))
    test_db.add(ParcelFavorite(parcel_id="B-1", user_id=user_b.id, pipeline_stage="Onderzoek"))
    test_db.add(ParcelFavorite(parcel_id="B-2", user_id=user_b.id, pipeline_stage="Contact"))
    await test_db.commit()

    resp = await async_client.get("/api/dashboard/pijplijn", headers=headers_a)

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1  # only user_a's single favorite


@pytest.mark.asyncio
async def test_kansen_top_scored_excluding_favorites(
    async_client: AsyncClient, create_test_user, test_db
):
    """Off-market kansen: top gescoorde percelen in de gemeente, favorites uitgesloten, op score."""
    user, org, headers = await _user_headers(create_test_user)
    await _scored_parcel(test_db, "VENLO-K1", "Venlo", 80.0, x=155000)
    await _scored_parcel(test_db, "VENLO-K2", "Venlo", 65.0, x=155100)
    # high score, maar al in de pijplijn → moet uitgesloten worden
    await _scored_parcel(test_db, "VENLO-FAV", "Venlo", 90.0, x=155200)
    test_db.add(
        ParcelFavorite(
            parcel_id="VENLO-FAV",
            user_id=user.id,
            pipeline_stage="Onderzoek",
            gemeente_naam="Venlo",
        )
    )
    await test_db.commit()

    resp = await async_client.get("/api/dashboard/kansen?gemeente=Venlo", headers=headers)

    assert resp.status_code == 200
    data = resp.json()
    ids = [k["parcel_id"] for k in data["kansen"]]
    assert "VENLO-FAV" not in ids  # favorite uitgesloten
    assert "VENLO-K1" in ids and "VENLO-K2" in ids
    assert ids.index("VENLO-K1") < ids.index("VENLO-K2")  # op potentie desc
    k1 = next(k for k in data["kansen"] if k["parcel_id"] == "VENLO-K1")
    assert k1["potentie_score"] == 80.0
    assert k1["address"] == "VENLO-K1 straat 1"


@pytest.mark.asyncio
async def test_kansen_does_not_leak_other_gemeente(
    async_client: AsyncClient, create_test_user, test_db
):
    """Kansen respecteren de gemeente-scope: een ander-gemeente perceel verschijnt niet."""
    user, org, headers = await _user_headers(create_test_user)
    await _scored_parcel(test_db, "VENLO-G1", "Venlo", 70.0, x=155000)
    await _scored_parcel(test_db, "ROERMOND-G1", "Roermond", 95.0, x=195000, y=355000)
    await test_db.commit()

    resp = await async_client.get("/api/dashboard/kansen?gemeente=Venlo", headers=headers)

    assert resp.status_code == 200
    ids = [k["parcel_id"] for k in resp.json()["kansen"]]
    assert ids == ["VENLO-G1"]
