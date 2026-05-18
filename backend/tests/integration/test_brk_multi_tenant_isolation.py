"""CRITICAL: multi-tenant isolation for brk_ownership_records (M050/S01).

Closes the CRITICAL E2E GAP from ENG-PLAN §Test coverage diagram:
- org-A cannot read org-B BRK rows
- cascade delete on Organization removal works end-to-end (full transaction,
  not just relationship mapping)

S01 ships no HTTP endpoint for BRK records yet (S02 will), so the isolation
test is at service-query level: any query filtered by organization_id must
return 0 rows for other orgs. This is the contract S02 endpoints will inherit.
"""
from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.organization import Organization


@pytest.mark.asyncio
async def test_org_a_cannot_read_org_b_records(test_db: AsyncSession) -> None:
    """Org-B filtered query on shared parcel_id returns 0 rows from Org-A."""
    org_a = Organization(name="Org A")
    org_b = Organization(name="Org B")
    test_db.add_all([org_a, org_b])
    await test_db.commit()
    await test_db.refresh(org_a)
    await test_db.refresh(org_b)

    # Both orgs reference the SAME parcel_id (deliberate overlap — proves filter is the gate)
    shared_parcel = "NL.IMKAD.Shared.1"
    record_a = BrkOwnershipRecord(
        organization_id=org_a.id,
        parcel_id=shared_parcel,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV A",
    )
    record_b = BrkOwnershipRecord(
        organization_id=org_b.id,
        parcel_id=shared_parcel,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV B",
    )
    test_db.add_all([record_a, record_b])
    await test_db.commit()

    # Org-B query MUST NOT see Org-A's row
    org_b_query = await test_db.execute(
        select(BrkOwnershipRecord).where(
            BrkOwnershipRecord.organization_id == org_b.id,
            BrkOwnershipRecord.parcel_id == shared_parcel,
        )
    )
    org_b_rows = org_b_query.scalars().all()
    assert len(org_b_rows) == 1
    assert org_b_rows[0].eigenaar_naam == "BV B"

    # Org-A's row is isolated
    assert all(r.organization_id == org_b.id for r in org_b_rows)

    # Conversely, Org-A query returns its own row
    org_a_query = await test_db.execute(
        select(BrkOwnershipRecord).where(
            BrkOwnershipRecord.organization_id == org_a.id,
            BrkOwnershipRecord.parcel_id == shared_parcel,
        )
    )
    org_a_rows = org_a_query.scalars().all()
    assert len(org_a_rows) == 1
    assert org_a_rows[0].eigenaar_naam == "BV A"


@pytest.mark.asyncio
async def test_org_a_softdelete_does_not_affect_org_b(
    test_db: AsyncSession,
) -> None:
    """soft_delete_for_org_parcel for org-A leaves org-B rows untouched."""
    from app.services.brk_persistence_service import soft_delete_for_org_parcel

    org_a = Organization(name="Org A Soft")
    org_b = Organization(name="Org B Soft")
    test_db.add_all([org_a, org_b])
    await test_db.commit()
    await test_db.refresh(org_a)
    await test_db.refresh(org_b)

    shared = "NL.IMKAD.SharedSoft.1"
    a = BrkOwnershipRecord(
        organization_id=org_a.id,
        parcel_id=shared,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV A",
    )
    b = BrkOwnershipRecord(
        organization_id=org_b.id,
        parcel_id=shared,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV B",
    )
    test_db.add_all([a, b])
    await test_db.commit()
    await test_db.refresh(a)
    await test_db.refresh(b)

    count = await soft_delete_for_org_parcel(test_db, org_a.id, shared)
    await test_db.commit()
    assert count == 1

    await test_db.refresh(a)
    await test_db.refresh(b)
    assert a.soft_deleted_at is not None
    assert b.soft_deleted_at is None  # org-B untouched


@pytest.mark.asyncio
async def test_cascade_delete_on_org_removal_e2e(test_db: AsyncSession) -> None:
    """Delete Organization → all its BRK rows purged via ON DELETE CASCADE."""
    org = Organization(name="Org Cascade")
    test_db.add(org)
    await test_db.commit()
    await test_db.refresh(org)
    org_id = org.id

    record = BrkOwnershipRecord(
        organization_id=org_id,
        parcel_id="NL.IMKAD.Cascade.1",
        eigenaar_type="overheid",
        eigenaar_naam="Gemeente Cascade",
    )
    test_db.add(record)
    await test_db.commit()
    await test_db.refresh(record)
    record_id = record.id

    await test_db.delete(org)
    await test_db.commit()

    result = await test_db.execute(
        select(BrkOwnershipRecord).where(BrkOwnershipRecord.id == record_id)
    )
    assert result.scalar_one_or_none() is None
