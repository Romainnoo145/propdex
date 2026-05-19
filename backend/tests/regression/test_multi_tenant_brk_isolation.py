"""REGRESSION-CRITICAL: do not remove. Iron-rule per ENG-PLAN AD2.

If this test breaks, AVG isolation is compromised. The GET
``/api/parcels/{parcel_id}/brk`` endpoint MUST silently return [] for
cross-org access (NOT 403, NOT 404) so existence of cross-tenant BRK
records is never leaked.

Iron-rule pattern (MEMORY.md ``feedback_iron_rule_regression_pattern``):
encode 'X must not change' as a regression test, never as a comment.

Drift-detection (verified during execution per 08-01 plan T3 action):
    Remove ``BrkOwnershipRecord.organization_id == organization_id``
    from the query in ``app/services/brk_read_service.py`` →
    ``test_cross_org_get_returns_empty`` fails with cross-tenant leak.
    Restore the filter → test passes.

Mirrors S03's ``test_m050_s03_multitenant.py`` but at the read-endpoint
layer (S06 read-path), not the scoring-pipeline layer.

Companion file:
    ``tests/integration/test_brk_fetch_multi_tenant.py`` (S02 fetch layer).
This file pins the S06 read-endpoint layer.
"""
from __future__ import annotations

import inspect
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.organization import Organization
from app.models.user import User
from app.services.brk_read_service import read_for_parcel


def _make_record(
    *,
    org_id,
    parcel_id: str,
    eigenaar_naam: str,
    soft_deleted_at: datetime | None = None,
) -> BrkOwnershipRecord:
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
        fetched_at=datetime.utcnow(),
        soft_deleted_at=soft_deleted_at,
        hard_delete_after=(
            soft_deleted_at + timedelta(days=60) if soft_deleted_at else None
        ),
    )


async def _make_user_for_org(
    test_db: AsyncSession, org: Organization, email: str
) -> User:
    from app.auth.password import hash_password

    user = User(
        email=email,
        hashed_password=hash_password("TestPass123!"),
        full_name="Test User",
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
# Test 1: cross-org silent isolation (THE iron rule)
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cross_org_get_returns_empty(
    async_client: AsyncClient, test_db: AsyncSession
) -> None:
    """REGRESSION-CRITICAL: cross-org GET returns [] (NIET 403, NIET 404).

    Scenario A (ENG-PLAN AD2): Org B has BRK row for parcel P. Org A user
    GET /api/parcels/P/brk MUST return 200 + [] — no leak of existence,
    no 404 (would also leak: "exists somewhere"), no 403 (would also leak:
    "exists in another org").

    AVG-breach narrative: if the WHERE clause loses organization_id, Org A
    sees Org B's rechtspersoon + kvk + koopsom data. This is the precise
    failure mode the M050 AVG Tier-3 classification engineers against.
    """
    org_a = Organization(name="Org A — read isolation")
    org_b = Organization(name="Org B — read isolation")
    test_db.add_all([org_a, org_b])
    await test_db.commit()
    await test_db.refresh(org_a)
    await test_db.refresh(org_b)

    parcel_id = "NL.IMKAD.IsolationTest.1"
    test_db.add(
        _make_record(
            org_id=org_b.id, parcel_id=parcel_id, eigenaar_naam="Org-B BV"
        )
    )
    await test_db.commit()

    user_a = await _make_user_for_org(test_db, org_a, "user-a@isolation.test")

    response = await async_client.get(
        f"/api/parcels/{parcel_id}/brk", headers=_auth_headers_for(user_a)
    )

    assert response.status_code == 200, (
        f"AVG breach guard: cross-org GET must be 200 (NIET 403, NIET 404). "
        f"Got {response.status_code} — existence-leak risk."
    )
    body = response.json()
    assert body == [], (
        f"AVG breach: org_a saw {len(body)} rows belonging to org_b — "
        f"organization_id filter dropped from query."
    )


# ──────────────────────────────────────────────────────────────────────────
# Test 2: same-org happy path — proves the filter doesn't over-restrict
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_same_org_sees_own_records(
    async_client: AsyncClient, test_db: AsyncSession
) -> None:
    """Same-org GET returns the org's own row — filter MUST NOT over-restrict.

    Org A has BRK for parcel P. Org A user GET → 200 + [the row]. Pairs
    with Test 1 to bound the filter on both sides (not too loose, not too
    tight).
    """
    org_a = Organization(name="Org A — same-org happy")
    test_db.add(org_a)
    await test_db.commit()
    await test_db.refresh(org_a)

    parcel_id = "NL.IMKAD.SameOrgHappy.1"
    test_db.add(
        _make_record(
            org_id=org_a.id, parcel_id=parcel_id, eigenaar_naam="Org-A BV"
        )
    )
    await test_db.commit()

    user_a = await _make_user_for_org(test_db, org_a, "user-a@happy.test")

    response = await async_client.get(
        f"/api/parcels/{parcel_id}/brk", headers=_auth_headers_for(user_a)
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["eigenaar_naam"] == "Org-A BV"
    assert body[0]["parcel_id"] == parcel_id


# ──────────────────────────────────────────────────────────────────────────
# Test 3: signature drift guard — kwarg-only org_id can't be refactored away
# ──────────────────────────────────────────────────────────────────────────


def test_signature_drift_guard() -> None:
    """REGRESSION-CRITICAL: read_for_parcel signature MUST keep org_id kwarg-only.

    If a future refactor removes the ``organization_id`` parameter — or
    drops the ``*`` that forces keyword-only — the iron-rule multi-tenant
    filter cannot be passed in. This test fails loudly the moment that
    happens, before any cross-tenant test could even run.
    """
    sig = inspect.signature(read_for_parcel)
    params = sig.parameters

    assert "organization_id" in params, (
        "Iron-rule drift: read_for_parcel lost its organization_id parameter — "
        "multi-tenant filter cannot be enforced."
    )

    org_param = params["organization_id"]
    assert org_param.kind == inspect.Parameter.KEYWORD_ONLY, (
        f"Iron-rule drift: organization_id must be KEYWORD_ONLY (kind="
        f"{org_param.kind}). The leading * in the signature is load-bearing — "
        f"it prevents accidental positional misuse that could swap arguments."
    )

    # parcel_id + db MUST also be kwarg-only so callsites are explicit.
    for required in ("db", "parcel_id"):
        assert required in params, f"read_for_parcel missing required kwarg: {required}"
        assert params[required].kind == inspect.Parameter.KEYWORD_ONLY


# ──────────────────────────────────────────────────────────────────────────
# Test 4: query includes org filter (compile-time guard via SQL inspection)
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_query_includes_org_filter(test_db: AsyncSession) -> None:
    """The SQL emitted by read_for_parcel MUST include organization_id in WHERE.

    Captures the actual SQL statement passed to AsyncSession.execute and
    asserts ``organization_id`` is in the WHERE clause text. Defends against
    a regression where someone "simplifies" the query and accidentally drops
    the multi-tenant predicate.
    """
    from unittest.mock import AsyncMock, MagicMock

    scalars_mock = MagicMock()
    scalars_mock.all.return_value = []
    result_mock = MagicMock()
    result_mock.scalars.return_value = scalars_mock

    spy_db = MagicMock(spec=AsyncSession)
    spy_db.execute = AsyncMock(return_value=result_mock)

    org_id = uuid.uuid4()
    await read_for_parcel(
        db=spy_db, organization_id=org_id, parcel_id="NL.IMKAD.SQL.1"
    )

    assert spy_db.execute.await_count == 1
    stmt = spy_db.execute.await_args.args[0]
    compiled_sql = str(stmt.compile(compile_kwargs={"literal_binds": False}))

    # SELECT clause always references columns — the iron rule is on the WHERE
    # predicate specifically. Slice the WHERE-clause text and assert on it.
    upper = compiled_sql.upper()
    where_start = upper.index("WHERE")
    where_clause = compiled_sql[where_start:]

    assert "organization_id" in where_clause, (
        f"Iron-rule drift: WHERE clause no longer filters by organization_id. "
        f"WHERE: {where_clause}"
    )
    assert "soft_deleted_at" in where_clause, (
        f"Iron-rule drift: WHERE clause no longer filters by soft_deleted_at. "
        f"WHERE: {where_clause}"
    )
    assert "parcel_id" in where_clause


# ──────────────────────────────────────────────────────────────────────────
# Test 5: soft-deleted rows are not returned by the endpoint
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_soft_deleted_not_returned(
    async_client: AsyncClient, test_db: AsyncSession
) -> None:
    """Org A row with soft_deleted_at IS NOT NULL → endpoint returns [].

    Retention safety: after unfavorite (S01 D3 hook), the BRK row is soft-
    deleted with a 60-day grace window. The endpoint MUST treat soft-deleted
    rows as gone — they exist for hard-delete cron purposes only, never for
    user-visible reads.
    """
    org_a = Organization(name="Org A — soft-delete test")
    test_db.add(org_a)
    await test_db.commit()
    await test_db.refresh(org_a)

    parcel_id = "NL.IMKAD.SoftDel.1"
    test_db.add(
        _make_record(
            org_id=org_a.id,
            parcel_id=parcel_id,
            eigenaar_naam="BV SoftDeleted",
            soft_deleted_at=datetime.utcnow(),
        )
    )
    await test_db.commit()

    user_a = await _make_user_for_org(test_db, org_a, "user-a@softdel.test")

    response = await async_client.get(
        f"/api/parcels/{parcel_id}/brk", headers=_auth_headers_for(user_a)
    )

    assert response.status_code == 200
    assert response.json() == [], (
        "Retention safety: soft-deleted rows MUST NOT surface in reads."
    )
