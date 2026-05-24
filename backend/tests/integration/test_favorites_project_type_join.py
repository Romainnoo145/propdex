"""Integration tests: list_favorites project_type bulk-join (no N+1).

Tests:
- test_favorite_with_type_returns_type: ParcelProjectType row → response has type
- test_favorite_without_type_returns_none: no ParcelProjectType row → None
- test_bulk_join_single_query_no_n_plus_1: before_cursor_execute counter == 1 for
  a 3-favorite fixture. Proves a single DB round-trip (no per-favorite SELECT).
"""
from __future__ import annotations

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from app.favorites.favorites_service import list_favorites
from app.models.parcel_favorite import ParcelFavorite
from app.models.parcel_project_type import ParcelProjectType


@pytest.mark.asyncio
async def test_favorite_with_type_returns_type(
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """A favorite with a matching ParcelProjectType row returns that type."""
    user, org = await create_test_user(email="type-hit@example.com", org_name="TypeHit Org")

    parcel_id = "NL.IMKAD.TypeHit.P001"
    fav = ParcelFavorite(
        user_id=user.id,
        parcel_id=parcel_id,
        pipeline_stage="Gesignaleerd",
    )
    proj_type = ParcelProjectType(
        organization_id=org.id,
        parcel_id=parcel_id,
        project_type="optoppen",
        set_by_user_id=user.id,
    )
    test_db.add(fav)
    test_db.add(proj_type)
    await test_db.commit()

    favs = await list_favorites(user_id=user.id, db=test_db)
    assert len(favs) == 1
    assert favs[0].project_type == "optoppen"


@pytest.mark.asyncio
async def test_favorite_without_type_returns_none(
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """A favorite with no ParcelProjectType row returns project_type=None."""
    user, _org = await create_test_user(email="type-miss@example.com", org_name="TypeMiss Org")

    parcel_id = "NL.IMKAD.TypeMiss.P001"
    fav = ParcelFavorite(
        user_id=user.id,
        parcel_id=parcel_id,
        pipeline_stage="Gesignaleerd",
    )
    test_db.add(fav)
    await test_db.commit()

    favs = await list_favorites(user_id=user.id, db=test_db)
    assert len(favs) == 1
    assert favs[0].project_type is None


@pytest.mark.asyncio
async def test_bulk_join_single_query_no_n_plus_1(
    test_db: AsyncSession,
    test_engine,
    create_test_user,
) -> None:
    """CRITICAL N+1 guard: list_favorites hits parcel_project_types exactly ONCE.

    Seeds a 3-favorite fixture (each with a matching ParcelProjectType row).
    Registers a before_cursor_execute listener on the sync engine that counts
    every SQL statement mentioning 'parcel_project_types'.
    Calls list_favorites once.
    Asserts the counter == 1.

    A structural check (join present in rendered SQL) would pass trivially — even
    an N+1 re-implementation would produce a single join. An execution-count for
    a 3-favorite fixture proves no per-favorite SELECT round-trip.

    Drift-detection: replace the subquery join with a per-favorite scalar SELECT
    on parcel_project_types → counter becomes 3 → this test fails.
    """
    user, org = await create_test_user(email="nplus1@example.com", org_name="N+1 Org")

    # Seed 3 favorites + 3 project_type rows
    parcel_ids = [
        "NL.IMKAD.NPlus1.P001",
        "NL.IMKAD.NPlus1.P002",
        "NL.IMKAD.NPlus1.P003",
    ]
    proj_types = ["nieuwbouw_wonen", "optoppen", "splitsen"]

    for pid, ptype in zip(parcel_ids, proj_types):
        fav = ParcelFavorite(
            user_id=user.id,
            parcel_id=pid,
            pipeline_stage="Gesignaleerd",
        )
        pt = ParcelProjectType(
            organization_id=org.id,
            parcel_id=pid,
            project_type=ptype,
            set_by_user_id=user.id,
        )
        test_db.add(fav)
        test_db.add(pt)
    await test_db.commit()

    # Count SQL statements mentioning parcel_project_types
    counter: dict[str, int] = {"count": 0}

    def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if "parcel_project_types" in statement:
            counter["count"] += 1

    # Attach listener to sync_engine
    sync_engine = test_engine.sync_engine
    event.listen(sync_engine, "before_cursor_execute", _before_cursor_execute)

    try:
        await list_favorites(user_id=user.id, db=test_db)
    finally:
        event.remove(sync_engine, "before_cursor_execute", _before_cursor_execute)

    assert counter["count"] == 1, (
        f"Expected exactly 1 SQL statement touching 'parcel_project_types' "
        f"for a 3-favorite fixture (bulk join), got {counter['count']}. "
        f"An N+1 implementation would produce 3 statements."
    )
