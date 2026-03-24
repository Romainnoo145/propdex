"""Integration coverage for monitoring flow and favorites metadata handling."""

from datetime import datetime

from geoalchemy2 import WKTElement
from sqlalchemy import select

from app.auth.jwt import create_access_token
from app.models.area_scan import AreaScan
from app.models.change_record import ChangeRecord
from app.models.parcel_cache import ParcelCache
from app.models.project import Project
from app.models.scan_result import ScanResult
from app.models.user_notification_state import UserNotificationState


async def test_get_project_changes_has_no_viewed_side_effect(
    async_client,
    create_test_user,
    test_db,
):
    """GET /changes should no longer create notification state rows."""
    user, org = await create_test_user()
    project = Project(
        name="Venlo",
        organization_id=org.id,
        gemeente_code="GM0983",
        is_monitored=True,
    )
    test_db.add(project)
    await test_db.flush()

    change = ChangeRecord(
        project_id=project.id,
        change_type="permit",
        external_id="perm-1",
        title="Omgevingsvergunning verleend",
        change_date=datetime.utcnow(),
        gemeente_naam="Venlo",
        address="Straat 1, 5911AA Venlo",
        metadata_json={},
        source_url=None,
        postcode="5911AA",
        matched_parcel_id=None,
    )
    test_db.add(change)
    await test_db.commit()

    token = create_access_token(str(user.id), str(org.id))
    response = await async_client.get(
        f"/api/monitoring/changes?project_id={project.id}&include_matches=true",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1

    states = (
        await test_db.execute(select(UserNotificationState))
    ).scalars().all()
    assert states == []


async def test_mark_viewed_creates_notification_state(
    async_client,
    create_test_user,
    test_db,
):
    """POST /viewed/{project_id} remains the explicit place to clear unread state."""
    user, org = await create_test_user(email="monitoring@example.com")
    project = Project(
        name="Amsterdam",
        organization_id=org.id,
        gemeente_code="GM0363",
        is_monitored=True,
    )
    test_db.add(project)
    await test_db.commit()

    token = create_access_token(str(user.id), str(org.id))
    response = await async_client.post(
        f"/api/monitoring/viewed/{project.id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    state = (
        await test_db.execute(
            select(UserNotificationState).where(
                UserNotificationState.user_id == user.id,
                UserNotificationState.project_id == project.id,
            )
        )
    ).scalar_one()
    assert state.project_id == project.id


async def test_create_favorite_enriches_location_metadata(
    async_client,
    create_test_user,
    test_db,
):
    """Favorites should recover gemeente context from parcel/scan data."""
    user, org = await create_test_user(email="favorites@example.com")

    parcel = ParcelCache(
        parcel_id="HTT02-A-1234",
        parcel_code="HTT02-A-1234",
        geometry=WKTElement(
            "MULTIPOLYGON(((155000 463000,155010 463000,155010 463010,155000 463010,155000 463000)))",
            srid=28992,
        ),
        address="Keizersgracht 1, 1015CJ Amsterdam",
        gemeente_code="0363",
        area_m2=120.0,
        has_pand=True,
        bouwjaar=1999,
        pand_status="Pand in gebruik",
        bestemmingen=[],
        enrichment_data=None,
        enriched_at=None,
    )
    test_db.add(parcel)
    await test_db.flush()

    scan = AreaScan(
        gemeente_code="0363",
        gemeente_naam="Amsterdam",
        wijk_naam="Centrum",
        project_id=None,
        bbox_minx=155000,
        bbox_miny=463000,
        bbox_maxx=155010,
        bbox_maxy=463010,
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
            score=83.0,
            flags={},
        )
    )
    await test_db.commit()

    token = create_access_token(str(user.id), str(org.id))
    response = await async_client.post(
        "/api/parcels/favorites",
        headers={"Authorization": f"Bearer {token}"},
        json={"parcel_id": "HTT02-A-1234"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["gemeente_code"] == "GM0363"
    assert data["gemeente_naam"] == "Amsterdam"
    assert data["wijk_naam"] == "Centrum"
    assert data["address"] == "Keizersgracht 1, 1015CJ Amsterdam"
