"""End-to-end integration coverage for GET /api/parcels/{id}/brk (Phase 8 Plan 08-08).

Pins multi-tenant isolation + soft-delete filter + latest-fetch-cycle semantics
across the HTTP boundary. These tests exercise the full FastAPI stack:
JWT auth → router → brk_read_service → DB. Unit tests in
``tests/unit/services/test_brk_read_service.py`` cover the service in isolation;
this file proves the contract holds through the HTTP layer + dependency-injection
chain.

Companion regression file:
    ``tests/regression/test_multi_tenant_brk_isolation.py`` — pins AD2 iron-rule
    (cross-org returns []) via WHERE-clause SQL inspection + signature drift guard.
This file pins the same contract via OBSERVABLE HTTP behavior (no SQL mocks).

Phase 8 §"Test coverage diagram" flows covered:
    1. [E2E CRITICAL] Cross-org GET /brk returns [] (no leak of existence)
    + happy-path multi-owner, soft-delete, latest-cycle, 401 auth gate.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.auth.password import hash_password
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.organization import Organization
from app.models.user import User


def _make_record(
    *,
    org_id: uuid.UUID,
    parcel_id: str,
    eigenaar_naam: str,
    fetched_at: datetime | None = None,
    soft_deleted_at: datetime | None = None,
) -> BrkOwnershipRecord:
    """Helper: build a BrkOwnershipRecord fixture row.

    Uses microsecond-distinct utcnow() per default — matches production
    persist_record() behaviour (uq_brk_org_parcel_fetched constraint blocks
    identical timestamps in real DB).
    """
    return BrkOwnershipRecord(
        organization_id=org_id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam=eigenaar_naam,
        kvk_nummer="12345678",
        statutaire_zetel="Amsterdam",
        zakelijk_recht_type="eigendom",
        aandeel="1/1",
        koopsom=Decimal("250000.00"),
        koopjaar=2015,
        heeft_hypotheek=True,
        raw_brk_response=None,
        fetched_at=fetched_at if fetched_at is not None else datetime.utcnow(),
        soft_deleted_at=soft_deleted_at,
        hard_delete_after=(
            soft_deleted_at + timedelta(days=60) if soft_deleted_at else None
        ),
    )


async def _make_user(
    test_db: AsyncSession, org: Organization, email: str
) -> User:
    user = User(
        email=email,
        hashed_password=hash_password("TestPass123!"),
        full_name="E2E Test User",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


def _auth_headers_for(user: User) -> dict[str, str]:
    token = create_access_token(str(user.id), str(user.organization_id))
    return {"Authorization": f"Bearer {token}"}


# ──────────────────────────────────────────────────────────────────────────
# Flow 1 — Cross-org GET returns [] (E2E CRITICAL — AD2 silent isolation)
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_e2e_cross_org_get_returns_empty_list_not_403(
    async_client: AsyncClient, test_db: AsyncSession
) -> None:
    """E2E CRITICAL: cross-org GET MUST be 200 + [] (NIET 403, NIET 404).

    Setup: org_b owns BRK record for parcel_X.
    Action: org_a user GETs /api/parcels/parcel_X/brk.
    Assert: status 200, body [].

    AD2 iron-rule: 403/404 would leak existence ("exists in another org");
    only 200+[] is indistinguishable from a parcel that never had BRK data.
    """
    org_a = Organization(name="E2E Org A")
    org_b = Organization(name="E2E Org B")
    test_db.add_all([org_a, org_b])
    await test_db.commit()
    await test_db.refresh(org_a)
    await test_db.refresh(org_b)

    parcel_id = "NL.IMKAD.E2ECrossOrg.1"
    test_db.add(
        _make_record(
            org_id=org_b.id, parcel_id=parcel_id, eigenaar_naam="Org-B BV"
        )
    )
    await test_db.commit()

    user_a = await _make_user(test_db, org_a, "e2e-cross-org-a@test.io")

    response = await async_client.get(
        f"/api/parcels/{parcel_id}/brk", headers=_auth_headers_for(user_a)
    )

    assert response.status_code == 200, (
        f"AVG breach guard: cross-org GET must be 200 (NIET 403/404). "
        f"Got {response.status_code} — existence leak risk."
    )
    assert response.json() == [], (
        "AVG breach: org_a saw org_b's records — organization_id filter "
        "dropped from query layer."
    )


# ──────────────────────────────────────────────────────────────────────────
# Flow 2 — Same-org multi-owner returned
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_e2e_same_org_multi_owner_returned(
    async_client: AsyncClient, test_db: AsyncSession
) -> None:
    """Multi-owner (multiple rechtspersoon rows for same parcel) all returned.

    Setup: org_a inserts 2 rows for parcel_X with distinct fetched_at (uniq
    constraint allows multiple historical rows per (org, parcel)). Both are
    in the latest fetch-cycle when fetched_at values are identical-second.

    Plan §"Behavior Flow 2" calls for 2 rows at the SAME timestamp; the DB
    UNIQUE constraint (uq_brk_org_parcel_fetched) blocks that in production —
    see Plan 08-01 Deviation #1 + service-layer unit test
    (test_returns_multi_owner_when_same_fetched_at via mock-DB). At the E2E
    layer we cannot violate the UNIQUE constraint, so we assert the
    happy-path: 2 historical rows present, the LATEST (most recent fetched_at)
    returned, len==1. The multi-owner-same-timestamp branch is proven at
    the unit layer.
    """
    org_a = Organization(name="E2E Org A — multi-owner")
    test_db.add(org_a)
    await test_db.commit()
    await test_db.refresh(org_a)

    parcel_id = "NL.IMKAD.E2EMultiOwner.1"
    older = datetime.utcnow() - timedelta(days=30)
    newer = datetime.utcnow()
    test_db.add_all(
        [
            _make_record(
                org_id=org_a.id,
                parcel_id=parcel_id,
                eigenaar_naam="Old Owner BV",
                fetched_at=older,
            ),
            _make_record(
                org_id=org_a.id,
                parcel_id=parcel_id,
                eigenaar_naam="New Owner BV",
                fetched_at=newer,
            ),
        ]
    )
    await test_db.commit()

    user_a = await _make_user(test_db, org_a, "e2e-multiowner@test.io")

    response = await async_client.get(
        f"/api/parcels/{parcel_id}/brk", headers=_auth_headers_for(user_a)
    )

    assert response.status_code == 200
    body = response.json()
    # Latest-fetch-cycle semantics: only newer row returned
    assert len(body) == 1, (
        f"Latest-cycle drift: expected only newest fetched_at returned, got "
        f"{len(body)} rows."
    )
    assert body[0]["eigenaar_naam"] == "New Owner BV"
    assert body[0]["parcel_id"] == parcel_id


# ──────────────────────────────────────────────────────────────────────────
# Flow 3 — GET excludes soft-deleted rows
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_e2e_soft_deleted_excluded(
    async_client: AsyncClient, test_db: AsyncSession
) -> None:
    """Soft-deleted rows MUST NOT surface in GET response (D3 contract).

    Setup: org_a inserts BRK row with soft_deleted_at=NOW().
    Action: org_a GETs.
    Assert: 200 + [] (row is soft-deleted; not yet hard-deleted by cron, but
    invisible to read API).
    """
    org_a = Organization(name="E2E Org A — soft-delete")
    test_db.add(org_a)
    await test_db.commit()
    await test_db.refresh(org_a)

    parcel_id = "NL.IMKAD.E2ESoftDel.1"
    test_db.add(
        _make_record(
            org_id=org_a.id,
            parcel_id=parcel_id,
            eigenaar_naam="Deleted BV",
            soft_deleted_at=datetime.utcnow(),
        )
    )
    await test_db.commit()

    user_a = await _make_user(test_db, org_a, "e2e-softdel@test.io")

    response = await async_client.get(
        f"/api/parcels/{parcel_id}/brk", headers=_auth_headers_for(user_a)
    )

    assert response.status_code == 200
    assert response.json() == [], (
        "D3 drift: soft-deleted row surfaced through GET response."
    )


# ──────────────────────────────────────────────────────────────────────────
# Flow 4 — Latest fetch-cycle anchored on MAX(fetched_at)
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_e2e_latest_fetch_cycle_only(
    async_client: AsyncClient, test_db: AsyncSession
) -> None:
    """Latest fetch-cycle semantics at HTTP boundary.

    Setup: org_a inserts 3 historical rows for same parcel — T1, T2, T3
    (T3 most recent). Action: GET.
    Assert: only the T3 row returned (len==1, eigenaar_naam matches T3).
    """
    org_a = Organization(name="E2E Org A — latest-cycle")
    test_db.add(org_a)
    await test_db.commit()
    await test_db.refresh(org_a)

    parcel_id = "NL.IMKAD.E2ELatestCycle.1"
    base = datetime.utcnow() - timedelta(days=60)
    test_db.add_all(
        [
            _make_record(
                org_id=org_a.id,
                parcel_id=parcel_id,
                eigenaar_naam="T1 — Oldest BV",
                fetched_at=base,
            ),
            _make_record(
                org_id=org_a.id,
                parcel_id=parcel_id,
                eigenaar_naam="T2 — Middle BV",
                fetched_at=base + timedelta(days=20),
            ),
            _make_record(
                org_id=org_a.id,
                parcel_id=parcel_id,
                eigenaar_naam="T3 — Newest BV",
                fetched_at=base + timedelta(days=40),
            ),
        ]
    )
    await test_db.commit()

    user_a = await _make_user(test_db, org_a, "e2e-latest-cycle@test.io")

    response = await async_client.get(
        f"/api/parcels/{parcel_id}/brk", headers=_auth_headers_for(user_a)
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1, (
        f"Latest-cycle drift: expected only T3 row, got {len(body)}."
    )
    assert body[0]["eigenaar_naam"] == "T3 — Newest BV"


# ──────────────────────────────────────────────────────────────────────────
# Flow 5 — Anonymous request → 401
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_e2e_unauthenticated_returns_401(
    async_client: AsyncClient,
) -> None:
    """No Authorization header → 401. Pure auth-gate check; no DB setup needed."""
    response = await async_client.get(
        "/api/parcels/NL.IMKAD.NoAuth.1/brk"
    )

    assert response.status_code == 401, (
        f"Auth-gate drift: unauthenticated GET should 401, got "
        f"{response.status_code}."
    )


# ──────────────────────────────────────────────────────────────────────────
# Flow 6 — Empty-data parcel (no BRK rows) returns 200 + []
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_e2e_no_data_parcel_returns_empty_list(
    async_client: AsyncClient, test_db: AsyncSession
) -> None:
    """Parcel with NO BRK rows returns 200 + [] — indistinguishable from
    cross-org case per AD2 silent-isolation.

    Pins the "absent-data" + "cross-tenant-data" response shapes are identical.
    """
    org_a = Organization(name="E2E Org A — no-data")
    test_db.add(org_a)
    await test_db.commit()
    await test_db.refresh(org_a)

    user_a = await _make_user(test_db, org_a, "e2e-nodata@test.io")

    response = await async_client.get(
        "/api/parcels/NL.IMKAD.NeverFetched.1/brk",
        headers=_auth_headers_for(user_a),
    )

    assert response.status_code == 200
    assert response.json() == []
