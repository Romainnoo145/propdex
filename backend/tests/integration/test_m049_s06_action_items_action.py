"""Integration tests for M049/S06 — view_action_item action surfaces in
GET /api/admin/data-sources/{gemeente_code} for source_keys present in
ACTION_ITEMS_CATALOG."""
from __future__ import annotations

import uuid
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.models.area_scan import AreaScan
from app.models.data_source_status import DataSourceStatus
from app.services.action_items_catalog import ACTION_ITEMS_CATALOG

pytestmark = pytest.mark.asyncio

# welstandsnota is Type-A AND in ACTION_ITEMS_CATALOG → ideal subject.
CATALOG_KEY = "welstandsnota"


def _superuser_headers(user_id, org_id) -> dict[str, str]:
    token = create_access_token(str(user_id), str(org_id))
    return {"Authorization": f"Bearer {token}"}


async def _seed_area_scan(
    db: AsyncSession, gemeente_code: str, gemeente_naam: str
) -> None:
    """Seed AreaScan so get_gemeente_name_map resolves code → naam."""
    scan = AreaScan(
        id=uuid.uuid4(),
        gemeente_code=gemeente_code,
        gemeente_naam=gemeente_naam,
        bbox_minx=5.9,
        bbox_miny=51.3,
        bbox_maxx=6.2,
        bbox_maxy=51.5,
        status="completed",
    )
    db.add(scan)
    await db.commit()


async def test_view_action_item_appears_for_catalog_source(
    async_client: AsyncClient,
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """T1 — Catalog source (welstandsnota) has view_action_item action."""
    assert CATALOG_KEY in ACTION_ITEMS_CATALOG, (
        f"Precondition: {CATALOG_KEY} must be in catalog"
    )

    user, org = await create_test_user(email="s06_t1@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo")

    resp = await async_client.get(
        "/api/admin/data-sources/GM0983",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200, resp.text

    payload = resp.json()
    all_rows = (
        payload["cascade_uploads"]
        + payload["open_apis"]
        + payload["paid_integrations"]
    )
    row = next((r for r in all_rows if r["source_key"] == CATALOG_KEY), None)
    assert row is not None, f"{CATALOG_KEY} row missing from payload"

    via = [a for a in row["available_actions"] if a["action"] == "view_action_item"]
    assert len(via) == 1, (
        f"Expected exactly 1 view_action_item action, got {len(via)}: {via}"
    )
    assert via[0]["enabled"] is True
    assert via[0]["label_nl"] == "Bekijk action item"


async def test_view_action_item_absent_for_non_catalog_source(
    async_client: AsyncClient,
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """T2 — Non-catalog source has NO view_action_item action."""
    user, org = await create_test_user(email="s06_t2@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo")

    resp = await async_client.get(
        "/api/admin/data-sources/GM0983",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200

    payload = resp.json()
    all_rows = (
        payload["cascade_uploads"]
        + payload["open_apis"]
        + payload["paid_integrations"]
    )

    non_catalog_row = next(
        (r for r in all_rows if r["source_key"] not in ACTION_ITEMS_CATALOG),
        None,
    )
    assert non_catalog_row is not None, (
        "Could not find any non-catalog row in payload"
    )

    via = [
        a for a in non_catalog_row["available_actions"]
        if a["action"] == "view_action_item"
    ]
    assert not via, (
        f"view_action_item should NOT appear for non-catalog source "
        f"{non_catalog_row['source_key']}, got {via}"
    )


async def test_type_a_live_row_with_action_item_has_four_actions(
    async_client: AsyncClient,
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """T3 — Type-A live + catalog → 4 actions in exact order."""
    user, org = await create_test_user(email="s06_t3@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo")

    # Seed a 'live' DataSourceStatus row for (GM0983, welstandsnota).
    # Probes only flip missing → live (never live → missing), so this stays live
    # through the GET orchestration even without a backing PolicyDocument.
    status_row = DataSourceStatus(
        id=uuid.uuid4(),
        gemeente_code="GM0983",
        source_key=CATALOG_KEY,
        status="live",
        last_checked=datetime.utcnow(),
        error_message=None,
        configuratie=None,
    )
    test_db.add(status_row)
    await test_db.commit()

    resp = await async_client.get(
        "/api/admin/data-sources/GM0983",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200

    payload = resp.json()
    row = next(
        (r for r in payload["cascade_uploads"] if r["source_key"] == CATALOG_KEY),
        None,
    )
    assert row is not None
    assert row["status"] == "live"

    action_keys = [a["action"] for a in row["available_actions"]]
    assert action_keys == [
        "view_versions",
        "upload",
        "refresh",
        "view_action_item",
    ], (
        f"Expected exact order "
        f"[view_versions, upload, refresh, view_action_item], got {action_keys}"
    )
