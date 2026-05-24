"""REGRESSION-CRITICAL — M052/S01 multi-tenant isolation guard (project_type in list_favorites).

Pins the ``organization_id`` filter in
``favorites_service.list_favorites``'s project_type_sq subquery. Failure of
this test ⇒ silent cross-tenant projecttype leak ⇒ user in Org B sees the
projecttype assignment made by Org A on the same parcel.

Iron-rule pattern (per MEMORY.md ``feedback_iron_rule_regression_pattern``):
encode 'X must not change' as a regression test, never as a comment.

Drift-detection (documented):
    Remove ``ParcelProjectType.organization_id == org_id`` from the
    project_type_sq subquery in ``app/favorites/favorites_service.py`` →
    this test fails because Org B's user would see 'nieuwbouw_wonen' instead
    of None. Restore the filter → test passes.

Mirrors the S03 boundary test
``backend/tests/regression/test_m050_s03_multitenant.py`` but at the
FAVORITES-LIST layer (project_type join), not the BRK scoring layer.
"""
from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.favorites.favorites_service import list_favorites
from app.models.parcel_favorite import ParcelFavorite
from app.models.parcel_project_type import ParcelProjectType


SHARED_PARCEL_ID = "NL.IMKAD.IsolationTest.P001"


@pytest.mark.asyncio
async def test_org_b_never_sees_org_a_project_type(
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """CRITICAL: cross-tenant project_type isolation in list_favorites.

    Org A assigns 'nieuwbouw_wonen' to parcel P001.
    User in Org B favorites the SAME parcel but sets NO project_type.
    Org B's list_favorites MUST return project_type=None for that parcel.
    Org A's own user MUST see 'nieuwbouw_wonen'.

    Drift-detection: removing ParcelProjectType.organization_id == org_id
    from the project_type_sq subquery causes this test to fail with a
    cross-tenant leak (Org B sees 'nieuwbouw_wonen' instead of None).
    """
    # --- seed two isolated orgs ---
    user_a, org_a = await create_test_user(
        email="orga@example.com", org_name="Org A"
    )
    user_b, _org_b = await create_test_user(
        email="orgb@example.com", org_name="Org B"
    )

    # Org A sets project_type on SHARED_PARCEL_ID
    proj_type_a = ParcelProjectType(
        organization_id=org_a.id,
        parcel_id=SHARED_PARCEL_ID,
        project_type="nieuwbouw_wonen",
        set_by_user_id=user_a.id,
    )
    test_db.add(proj_type_a)

    # Org A user favorites the parcel
    fav_a = ParcelFavorite(
        user_id=user_a.id,
        parcel_id=SHARED_PARCEL_ID,
        pipeline_stage="Gesignaleerd",
    )
    test_db.add(fav_a)

    # Org B user favorites the SAME parcel but sets no project_type
    fav_b = ParcelFavorite(
        user_id=user_b.id,
        parcel_id=SHARED_PARCEL_ID,
        pipeline_stage="Gesignaleerd",
    )
    test_db.add(fav_b)

    await test_db.commit()

    # --- Org A sees its own type ---
    favs_a = await list_favorites(user_id=user_a.id, db=test_db)
    assert len(favs_a) == 1
    assert favs_a[0].project_type == "nieuwbouw_wonen", (
        f"Org A should see 'nieuwbouw_wonen', got {favs_a[0].project_type!r}"
    )

    # --- CRITICAL: Org B must NOT see Org A's type ---
    favs_b = await list_favorites(user_id=user_b.id, db=test_db)
    assert len(favs_b) == 1
    assert favs_b[0].project_type is None, (
        f"CROSS-TENANT LEAK: Org B sees {favs_b[0].project_type!r} "
        f"which was set by Org A. The organization_id filter in "
        f"project_type_sq may be missing or wrong."
    )


@pytest.mark.asyncio
async def test_join_uses_kadaster_string_not_cache_uuid(
    test_db: AsyncSession,
    create_test_user,
) -> None:
    """Guard: project_type join keys on parcel_id (Kadaster-string), NOT parcel_cache_id (UUID).

    Creates a ParcelFavorite with parcel_cache_id=None — if the join incorrectly
    used parcel_cache_id (UUID FK), the outerjoin on NULL would return None for the type.
    The ParcelProjectType row is keyed by the Kadaster parcel_id string.
    list_favorites MUST resolve the type via parcel_id, not parcel_cache_id.

    A ParcelProjectType keyed by a DIFFERENT Kadaster string returns None.
    """

    user, org = await create_test_user(email="kadaster-guard@example.com", org_name="Guard Org")

    kadaster_id = "NL.IMKAD.KadasterGuard.K001"
    other_kadaster_id = "NL.IMKAD.KadasterGuard.DIFFERENT"

    # Project type row uses Kadaster string as key
    proj_type = ParcelProjectType(
        organization_id=org.id,
        parcel_id=kadaster_id,
        project_type="optoppen",
        set_by_user_id=user.id,
    )
    test_db.add(proj_type)

    # Favorite with parcel_cache_id=None — proves the project_type join
    # operates on parcel_id (Kadaster-string), not parcel_cache_id (UUID FK).
    # If the join mistakenly used parcel_cache_id (NULL here), type would be None.
    fav = ParcelFavorite(
        user_id=user.id,
        parcel_id=kadaster_id,
        parcel_cache_id=None,  # NULL — would break a parcel_cache_id-based join
        pipeline_stage="Gesignaleerd",
    )
    test_db.add(fav)

    # A second favorite with a different parcel_id → must return None
    fav_other = ParcelFavorite(
        user_id=user.id,
        parcel_id=other_kadaster_id,
        pipeline_stage="Gesignaleerd",
    )
    test_db.add(fav_other)

    await test_db.commit()

    favs = await list_favorites(user_id=user.id, db=test_db)
    favs_by_parcel = {f.parcel_id: f for f in favs}

    # The join on parcel_id (Kadaster) resolves correctly despite UUID mismatch
    assert favs_by_parcel[kadaster_id].project_type == "optoppen", (
        f"Expected 'optoppen' via Kadaster parcel_id join, "
        f"got {favs_by_parcel[kadaster_id].project_type!r}. "
        f"The join may be incorrectly using parcel_cache_id (UUID) instead."
    )

    # Different parcel_id → no matching project_type row → None
    assert favs_by_parcel[other_kadaster_id].project_type is None, (
        f"Expected None for unmatched parcel_id, "
        f"got {favs_by_parcel[other_kadaster_id].project_type!r}"
    )
