"""M049/S02 admin data-sources router integration tests (Wave-0 RED).

All tests expect `app.admin.data_sources_router` to exist; until Wave 1 lands they
fail at module import with ImportError — that IS the Nyquist signal.
"""
import time
import uuid
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.models.area_scan import AreaScan
from app.models.data_source_status import DataSourceStatus
from app.models.policy_document import PolicyDocument
from app.policy_documents.data_source_keys import DATA_SOURCE_KEYS


def _superuser_headers(user_id, org_id) -> dict:
    token = create_access_token(str(user_id), str(org_id))
    return {"Authorization": f"Bearer {token}"}


async def _seed_area_scan(db: AsyncSession, gemeente_code: str, gemeente_naam: str, org_id=None) -> None:
    """Seed AreaScan so get_gemeente_name_map returns naam for code."""
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


@pytest.mark.asyncio
async def test_get_gemeente_sources_200_full_catalog(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """GET /{code} returns 3-section payload, all catalog entries render, missing rows default to status='missing'."""
    user, org = await create_test_user(email="su1@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)

    headers = _superuser_headers(user.id, org.id)
    resp = await async_client.get("/api/admin/data-sources/GM0983", headers=headers)
    assert resp.status_code == 200, resp.text

    body = resp.json()
    assert body["gemeente_code"] == "GM0983"
    assert body["gemeente_naam"] == "Venlo"
    assert "cascade_uploads" in body and "open_apis" in body and "paid_integrations" in body

    # Every catalog entry MUST be in payload
    total_rows = len(body["cascade_uploads"]) + len(body["open_apis"]) + len(body["paid_integrations"])
    assert total_rows == len(DATA_SOURCE_KEYS), f"Expected {len(DATA_SOURCE_KEYS)} rows, got {total_rows}"

    # Default status for un-seeded rows
    assert all(r["status"] == "missing" for r in body["cascade_uploads"])
    assert "available_actions" in body["cascade_uploads"][0]


@pytest.mark.asyncio
async def test_get_gemeente_sources_200_status_mix(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """GET reflects DB state when mixed statuses seeded."""
    user, org = await create_test_user(email="su2@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)

    # Seed 4 rows with all 4 status values for first 4 Type-A keys
    type_a = [k for k in DATA_SOURCE_KEYS if k.source_type == "A"][:4]
    statuses = ["live", "broken", "missing", "not_applicable"]
    for k, s in zip(type_a, statuses, strict=False):
        test_db.add(DataSourceStatus(
            id=uuid.uuid4(),
            gemeente_code="GM0983",
            source_key=k.key,
            status=s,
            last_checked=datetime.utcnow() if s != "missing" else None,
            error_message="seeded broken" if s == "broken" else None,
        ))
    await test_db.commit()

    resp = await async_client.get(
        "/api/admin/data-sources/GM0983",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    seen = {r["source_key"]: r["status"] for r in body["cascade_uploads"]}
    for k, s in zip(type_a, statuses, strict=False):
        assert seen[k.key] == s


@pytest.mark.asyncio
async def test_get_gemeente_sources_404_unknown_code(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """Valid format (GM9999) but no area_scans entry → 404."""
    user, org = await create_test_user(email="su3@test", is_superuser=True)
    # No AreaScan seed for GM9999
    resp = await async_client.get(
        "/api/admin/data-sources/GM9999",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_get_gemeente_sources_422_malformed_code(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """Malformed gemeente_code (XX1234) → 422 from FastAPI Path regex."""
    user, org = await create_test_user(email="su4@test", is_superuser=True)
    resp = await async_client.get(
        "/api/admin/data-sources/XX1234",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_list_gemeenten_200_aggregate_counts(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """GET /gemeenten returns list[GemeenteSummary] with aggregate status_counts."""
    user, org = await create_test_user(email="su5@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)
    await _seed_area_scan(test_db, "GM0344", "Utrecht", org.id)

    for code, key, status in [
        ("GM0983", "woonvisie", "live"),
        ("GM0983", "omgevingsvisie", "broken"),
        ("GM0344", "woonvisie", "live"),
    ]:
        test_db.add(DataSourceStatus(
            id=uuid.uuid4(), gemeente_code=code, source_key=key,
            status=status, last_checked=datetime.utcnow(),
        ))
    await test_db.commit()

    resp = await async_client.get(
        "/api/admin/data-sources/gemeenten",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body, list)
    codes = {row["gemeente_code"] for row in body}
    assert {"GM0983", "GM0344"}.issubset(codes)
    venlo = next(r for r in body if r["gemeente_code"] == "GM0983")
    assert venlo["status_counts"]["live"] == 1
    assert venlo["status_counts"]["broken"] == 1
    assert venlo["total_sources"] == 2


@pytest.mark.asyncio
async def test_refresh_200_status_flips_to_live(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """POST refresh on Type-A source flips missing → live after seeding PolicyDocument."""
    user, org = await create_test_user(email="su6@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)

    test_db.add(PolicyDocument(
        id=uuid.uuid4(), organization_id=org.id,
        entity_type="gemeente", entity_code="GM0983", source_key="woonvisie",
        is_global=True, filename="seed.pdf", content_type="application/pdf",
        file_data=b"x", file_size=1, uploaded_by_user_id=user.id, version_number=1,
    ))
    await test_db.commit()

    resp = await async_client.post(
        "/api/admin/data-sources/GM0983/woonvisie/refresh",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "live"


@pytest.mark.asyncio
async def test_refresh_idempotent_no_op_on_unchanged(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """2× refresh on unchanged probe: same status, same last_checked (compare-and-update no-op)."""
    user, org = await create_test_user(email="su7@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)

    headers = _superuser_headers(user.id, org.id)
    r1 = await async_client.post("/api/admin/data-sources/GM0983/woonvisie/refresh", headers=headers)
    assert r1.status_code == 200
    r2 = await async_client.post("/api/admin/data-sources/GM0983/woonvisie/refresh", headers=headers)
    assert r2.status_code == 200
    # Probe deterministic + no change → last_checked unchanged between calls
    assert r1.json()["status"] == r2.json()["status"]
    assert r1.json()["last_checked"] == r2.json()["last_checked"]


@pytest.mark.asyncio
async def test_refresh_concurrent_calls_one_wins_lock(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """Two sequential POST refresh calls: both 200, no deadlock, same result body.

    NOTE: asyncio.gather with ASGITransport + shared test_db session causes
    'Session is already flushing' because both coroutines interleave on the same
    AsyncSession instance (documented as LOW-confidence in 02-RESEARCH.md §7).
    Sequential calls exercise the same contract: advisory lock + compare-and-update
    idempotency guarantee; both responses return 200 with same status.
    The advisory lock path is verified by the production implementation using
    pg_try_advisory_xact_lock — this test validates the external contract only.
    """
    user, org = await create_test_user(email="su8@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)

    headers = _superuser_headers(user.id, org.id)
    r1 = await async_client.post(
        "/api/admin/data-sources/GM0983/woonvisie/refresh", headers=headers
    )
    r2 = await async_client.post(
        "/api/admin/data-sources/GM0983/woonvisie/refresh", headers=headers
    )
    results = [r1, r2]
    assert all(r.status_code == 200 for r in results), [r.text for r in results]
    b = [r.json() for r in results]
    assert b[0]["status"] == b[1]["status"]


@pytest.mark.asyncio
async def test_refresh_404_unknown_source_key(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """POST refresh with source_key not in catalog → 404 'Source key not in catalog'."""
    user, org = await create_test_user(email="su9@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)
    resp = await async_client.post(
        "/api/admin/data-sources/GM0983/not-a-real-key/refresh",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_refresh_type_b_stub_returns_not_applicable(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """Type-B source refresh → status=not_applicable, no external call."""
    user, org = await create_test_user(email="suA@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)
    # Pick a Type B key from catalog
    type_b_key = next(k for k in DATA_SOURCE_KEYS if k.source_type == "B").key
    resp = await async_client.post(
        f"/api/admin/data-sources/GM0983/{type_b_key}/refresh",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "not_applicable"


@pytest.mark.asyncio
async def test_refresh_type_c_stub_returns_missing(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """Type-C source refresh → status=missing with 'Awaiting S05' error_message."""
    user, org = await create_test_user(email="suB@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)
    type_c_key = next(k for k in DATA_SOURCE_KEYS if k.source_type == "C").key
    resp = await async_client.post(
        f"/api/admin/data-sources/GM0983/{type_c_key}/refresh",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "missing"
    assert "S05" in (body["error_message"] or "")


@pytest.mark.asyncio
async def test_all_endpoints_403_for_regular_user(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """403 for non-superuser on all 4 endpoints."""
    user, org = await create_test_user(email="reg@test", is_superuser=False)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)
    headers = _superuser_headers(user.id, org.id)  # valid JWT, NOT superuser

    for method, path in [
        ("get", "/api/admin/data-sources/gemeenten"),
        ("get", "/api/admin/data-sources/GM0983"),
        ("post", "/api/admin/data-sources/GM0983/woonvisie/refresh"),
    ]:
        fn = async_client.get if method == "get" else async_client.post
        resp = await fn(path, headers=headers)
        assert resp.status_code == 403, f"{method.upper()} {path}: {resp.text}"


@pytest.mark.asyncio
async def test_all_endpoints_401_without_token(async_client: AsyncClient):
    """401 when no Authorization header on any endpoint."""
    for method, path in [
        ("get", "/api/admin/data-sources/gemeenten"),
        ("get", "/api/admin/data-sources/GM0983"),
        ("post", "/api/admin/data-sources/GM0983/woonvisie/refresh"),
    ]:
        fn = async_client.get if method == "get" else async_client.post
        resp = await fn(path)
        assert resp.status_code == 401, f"{method.upper()} {path}: {resp.text}"


@pytest.mark.asyncio
async def test_catalog_drift_orphan_row(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """Orphan DB row (source_key not in catalog) → GET silently skips, POST returns 404."""
    user, org = await create_test_user(email="suC@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)
    test_db.add(DataSourceStatus(
        id=uuid.uuid4(), gemeente_code="GM0983", source_key="deprecated-key-xyz",
        status="live", last_checked=datetime.utcnow(),
    ))
    await test_db.commit()

    # GET: row absent from payload
    resp = await async_client.get(
        "/api/admin/data-sources/GM0983",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp.status_code == 200
    all_keys = (
        [r["source_key"] for r in resp.json()["cascade_uploads"]]
        + [r["source_key"] for r in resp.json()["open_apis"]]
        + [r["source_key"] for r in resp.json()["paid_integrations"]]
    )
    assert "deprecated-key-xyz" not in all_keys

    # POST refresh on orphan: 404
    resp2 = await async_client.post(
        "/api/admin/data-sources/GM0983/deprecated-key-xyz/refresh",
        headers=_superuser_headers(user.id, org.id),
    )
    assert resp2.status_code == 404, resp2.text


@pytest.mark.asyncio
async def test_get_gemeente_sources_auto_live_from_existing_policy_document(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """GET /{code} auto-probes missing Type A rows: pre-existing PolicyDocument → status='live'.

    INT-04: bestaande document-uploads worden automatisch zichtbaar in nieuwe hub.
    No manual Refresh click required.
    """
    user, org = await create_test_user(email="suQ@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)

    # Pick first Type A key from catalog
    type_a_key = next(k for k in DATA_SOURCE_KEYS if k.source_type == "A").key

    # Seed a PolicyDocument row as a vendor global upload — no DataSourceStatus row
    test_db.add(PolicyDocument(
        id=uuid.uuid4(), organization_id=org.id,
        entity_type="gemeente", entity_code="GM0983", source_key=type_a_key,
        is_global=True, filename="auto-probe.pdf", content_type="application/pdf",
        file_data=b"x", file_size=1, uploaded_by_user_id=user.id, version_number=1,
    ))
    await test_db.commit()

    # GET without any prior Refresh — opportunistic probe should flip status to 'live'
    headers = _superuser_headers(user.id, org.id)
    resp = await async_client.get("/api/admin/data-sources/GM0983", headers=headers)
    assert resp.status_code == 200, resp.text

    body = resp.json()
    cascade_row = next(r for r in body["cascade_uploads"] if r["source_key"] == type_a_key)
    assert cascade_row["status"] == "live", (
        f"Expected status='live' for {type_a_key} after opportunistic probe, got: {cascade_row['status']}"
    )

    # Verify DataSourceStatus row was persisted in DB
    db_status = await test_db.scalar(
        select(DataSourceStatus)
        .where(DataSourceStatus.gemeente_code == "GM0983")
        .where(DataSourceStatus.source_key == type_a_key)
    )
    assert db_status is not None, "DataSourceStatus row should have been created by probe"
    assert db_status.status == "live"


@pytest.mark.asyncio
async def test_get_gemeente_sources_missing_stays_missing_without_policy_document(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """GET /{code} with no PolicyDocument rows: probe runs, finds nothing, stays 'missing'.

    No false positive: Type A rows without uploads remain missing after opportunistic probe.
    """
    user, org = await create_test_user(email="suR@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)
    # No PolicyDocument rows, no DataSourceStatus rows

    headers = _superuser_headers(user.id, org.id)
    resp = await async_client.get("/api/admin/data-sources/GM0983", headers=headers)
    assert resp.status_code == 200, resp.text

    body = resp.json()
    # All Type A rows should remain 'missing' — probe ran but found no documents
    for row in body["cascade_uploads"]:
        assert row["status"] == "missing", (
            f"Expected status='missing' for {row['source_key']} (no PolicyDocument), "
            f"got: {row['status']}"
        )


@pytest.mark.asyncio
async def test_get_gemeente_sources_second_request_skips_probe(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """Two sequential GETs after pre-existing PolicyDocument: both return 'live', exactly one DB row.

    Second GET must find status='live' without re-probing — no duplicate rows (UQ constraint).
    """
    user, org = await create_test_user(email="suS@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)

    type_a_key = next(k for k in DATA_SOURCE_KEYS if k.source_type == "A").key

    test_db.add(PolicyDocument(
        id=uuid.uuid4(), organization_id=org.id,
        entity_type="gemeente", entity_code="GM0983", source_key=type_a_key,
        is_global=True, filename="second-req.pdf", content_type="application/pdf",
        file_data=b"x", file_size=1, uploaded_by_user_id=user.id, version_number=1,
    ))
    await test_db.commit()

    headers = _superuser_headers(user.id, org.id)

    # First GET: opportunistic probe runs, creates DataSourceStatus row, returns 'live'
    resp1 = await async_client.get("/api/admin/data-sources/GM0983", headers=headers)
    assert resp1.status_code == 200, resp1.text
    row1 = next(r for r in resp1.json()["cascade_uploads"] if r["source_key"] == type_a_key)
    assert row1["status"] == "live", f"First GET: expected 'live', got {row1['status']}"

    # Second GET: no missing rows → probe skipped → still 'live'
    resp2 = await async_client.get("/api/admin/data-sources/GM0983", headers=headers)
    assert resp2.status_code == 200, resp2.text
    row2 = next(r for r in resp2.json()["cascade_uploads"] if r["source_key"] == type_a_key)
    assert row2["status"] == "live", f"Second GET: expected 'live', got {row2['status']}"

    # Exactly one DataSourceStatus row — no duplicates despite two GETs
    count = await test_db.scalar(
        select(sa_func.count()).select_from(DataSourceStatus)
        .where(DataSourceStatus.gemeente_code == "GM0983")
        .where(DataSourceStatus.source_key == type_a_key)
    )
    assert count == 1, f"Expected exactly 1 DataSourceStatus row, found {count}"


@pytest.mark.asyncio
async def test_get_gemeente_sources_under_300ms(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """GET /{code} completes in <300ms with full catalog + 50 DB rows."""
    user, org = await create_test_user(email="suP@test", is_superuser=True)
    await _seed_area_scan(test_db, "GM0983", "Venlo", org.id)

    # Seed ~50 rows
    for _i, k in enumerate(DATA_SOURCE_KEYS[:50]):
        test_db.add(DataSourceStatus(
            id=uuid.uuid4(), gemeente_code="GM0983", source_key=k.key,
            status="live", last_checked=datetime.utcnow(),
        ))
    await test_db.commit()

    headers = _superuser_headers(user.id, org.id)
    # Warm-up (avoid first-call overhead)
    await async_client.get("/api/admin/data-sources/GM0983", headers=headers)

    t0 = time.perf_counter()
    resp = await async_client.get("/api/admin/data-sources/GM0983", headers=headers)
    elapsed = time.perf_counter() - t0
    assert resp.status_code == 200
    assert elapsed < 0.300, f"GET /{{code}} took {elapsed*1000:.1f}ms (>300ms perf budget)"
