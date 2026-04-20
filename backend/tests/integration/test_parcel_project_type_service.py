"""Service-laag tests voor parcel_project_type (M047/S01)."""

import asyncio

import pytest
from sqlalchemy import func, select

from app.models.parcel_project_type import ParcelProjectType
from app.services.parcel_project_type_service import (
    get_project_type,
    upsert_project_type,
)


@pytest.mark.asyncio
async def test_get_returns_default_when_no_row_exists(test_db, create_test_user):
    """Afwezige record → 'onbepaald' default, geen 404-analogue."""
    _user, org = await create_test_user()
    result = await get_project_type(
        test_db,
        parcel_id="NL.IMBAG.Pand.0983100000000001",
        organization_id=org.id,
    )
    assert result.project_type == "onbepaald"
    assert result.set_at is None
    assert result.set_by_user_id is None


@pytest.mark.asyncio
async def test_upsert_creates_then_updates_same_row(test_db, create_test_user):
    """Twee upserts → 1 rij in DB (unique constraint werkt)."""
    user, org = await create_test_user()
    parcel = "NL.IMBAG.Pand.0983100000000002"

    first = await upsert_project_type(
        test_db,
        parcel_id=parcel,
        organization_id=org.id,
        project_type="nieuwbouw_wonen",
        user_id=user.id,
    )
    assert first.project_type == "nieuwbouw_wonen"
    assert first.set_by_user_id == user.id
    first_set_at = first.set_at

    # Sleep to guarantee timestamp delta
    await asyncio.sleep(0.01)

    second = await upsert_project_type(
        test_db,
        parcel_id=parcel,
        organization_id=org.id,
        project_type="optoppen",
        user_id=user.id,
    )
    assert second.project_type == "optoppen"
    assert second.set_at is not None
    assert first_set_at is not None
    assert second.set_at > first_set_at

    # Verify single row in DB
    count_stmt = (
        select(func.count())
        .select_from(ParcelProjectType)
        .where(
            ParcelProjectType.organization_id == org.id,
            ParcelProjectType.parcel_id == parcel,
        )
    )
    count = (await test_db.execute(count_stmt)).scalar()
    assert count == 1


@pytest.mark.asyncio
async def test_upsert_multi_tenant_isolation(test_db, create_test_user):
    """Org A + Org B op zelfde parcel_id → 2 aparte rijen, geen cross-read."""
    user_a, org_a = await create_test_user(email="a@test.com", org_name="Org A")
    user_b, org_b = await create_test_user(email="b@test.com", org_name="Org B")
    parcel = "NL.IMBAG.Pand.0983100000000003"

    await upsert_project_type(
        test_db,
        parcel_id=parcel,
        organization_id=org_a.id,
        project_type="nieuwbouw_wonen",
        user_id=user_a.id,
    )
    await upsert_project_type(
        test_db,
        parcel_id=parcel,
        organization_id=org_b.id,
        project_type="optoppen",
        user_id=user_b.id,
    )

    a_read = await get_project_type(
        test_db, parcel_id=parcel, organization_id=org_a.id
    )
    b_read = await get_project_type(
        test_db, parcel_id=parcel, organization_id=org_b.id
    )

    assert a_read.project_type == "nieuwbouw_wonen"
    assert a_read.set_by_user_id == user_a.id
    assert b_read.project_type == "optoppen"
    assert b_read.set_by_user_id == user_b.id


@pytest.mark.asyncio
async def test_get_returns_set_by_user_id_from_db(test_db, create_test_user):
    """set_by_user_id wordt correct gepersisteerd + teruggelezen."""
    user, org = await create_test_user()
    parcel = "NL.IMBAG.Pand.0983100000000004"

    await upsert_project_type(
        test_db,
        parcel_id=parcel,
        organization_id=org.id,
        project_type="transformatie_wonen",
        user_id=user.id,
    )
    result = await get_project_type(
        test_db, parcel_id=parcel, organization_id=org.id
    )
    assert result.set_by_user_id == user.id
    assert result.set_at is not None
