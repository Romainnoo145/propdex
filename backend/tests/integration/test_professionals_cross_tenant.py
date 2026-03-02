"""Cross-tenant integration tests for professional directory visibility (DIR-03).

The Professional model uses no TenantMixin — NULL organization_id means
professionals are a platform-wide resource visible to ALL tenants.
These tests verify that the RLS policy (FOR SELECT USING TRUE) and model
structure correctly enforce this architectural invariant.
"""

import uuid

import pytest
from sqlalchemy import text

from app.models.professional import Professional


@pytest.fixture
async def sample_professional(test_db):
    """Insert a single professional row directly for test setup."""
    prof = Professional(
        naam="Test KB",
        werkgebied=["Amsterdam", "Rotterdam"],
        gevolgklassen=["GK1", "GK2"],
        bedrijfsnaam="Test Kwaliteitsborging BV",
        email="test@kb.nl",
        is_active=True,
    )
    test_db.add(prof)
    await test_db.flush()
    await test_db.commit()
    return prof


@pytest.fixture
async def two_orgs(test_db):
    """Create two organizations for cross-tenant isolation tests."""
    from app.models.organization import Organization

    org_a = Organization(name="Org A")
    org_b = Organization(name="Org B")
    test_db.add(org_a)
    test_db.add(org_b)
    await test_db.flush()
    await test_db.commit()
    return org_a.id, org_b.id


class TestProfessionalsVisible:
    """Test that professionals are visible regardless of tenant context (DIR-03)."""

    async def test_professionals_visible_to_any_tenant(
        self, test_db, sample_professional, two_orgs
    ):
        """
        Professionals with NULL org_id are visible to any tenant context.

        Simulates the get_db() pattern which calls:
            SET LOCAL app.current_tenant_id = '{org_id}'
        Since RLS policy is FOR SELECT USING (TRUE), both orgs see the same professional.
        """
        org_a_id, org_b_id = two_orgs

        # Query as Org A — set tenant context (f-string pattern from STATE.md)
        await test_db.execute(
            text(f"SET LOCAL app.current_tenant_id = '{org_a_id}'")
        )
        result_a = await test_db.execute(
            text("SELECT id, naam FROM professionals")
        )
        rows_a = result_a.fetchall()

        assert len(rows_a) == 1, "Org A should see 1 professional"
        assert rows_a[0].naam == "Test KB"

        # Query as Org B — switch tenant context
        await test_db.execute(
            text(f"SET LOCAL app.current_tenant_id = '{org_b_id}'")
        )
        result_b = await test_db.execute(
            text("SELECT id, naam FROM professionals")
        )
        rows_b = result_b.fetchall()

        assert len(rows_b) == 1, "Org B should also see 1 professional (cross-tenant visibility)"
        assert rows_b[0].naam == "Test KB"
        assert rows_a[0].id == rows_b[0].id, "Both orgs see the same professional row"

    async def test_professional_null_org_id_not_filtered(
        self, test_db, sample_professional
    ):
        """
        Professional model has no organization_id column.

        The absence of TenantMixin means there is no organization_id to filter on,
        confirming the platform-wide resource pattern.
        """
        column_names = [col.name for col in Professional.__table__.columns]
        assert "organization_id" not in column_names, (
            "Professional must NOT have organization_id — it is a platform-wide resource"
        )

    async def test_professional_gin_indexes_exist(self, test_db, sample_professional):
        """
        GIN indexes on werkgebied and gevolgklassen exist in the database.

        These indexes enable efficient ARRAY containment queries for lead matching
        (e.g., WHERE werkgebied @> ARRAY['Amsterdam']).
        """
        result = await test_db.execute(
            text("""
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'professionals'
                AND indexname IN (
                    'ix_professionals_werkgebied_gin',
                    'ix_professionals_gevolgklassen_gin'
                )
                ORDER BY indexname
            """)
        )
        index_names = {row.indexname for row in result.fetchall()}

        assert "ix_professionals_werkgebied_gin" in index_names, (
            "GIN index on werkgebied must exist for efficient array queries"
        )
        assert "ix_professionals_gevolgklassen_gin" in index_names, (
            "GIN index on gevolgklassen must exist for efficient array queries"
        )

    async def test_multiple_professionals_all_visible_across_tenants(
        self, test_db, two_orgs
    ):
        """All professionals are visible regardless of which tenant queries."""
        org_a_id, org_b_id = two_orgs

        # Insert 3 professionals
        for i in range(3):
            prof = Professional(
                naam=f"Professional {i + 1}",
                werkgebied=[f"Gemeente {i + 1}"],
                gevolgklassen=["GK1"],
                is_active=True,
            )
            test_db.add(prof)
        await test_db.flush()
        await test_db.commit()

        # Org A query
        await test_db.execute(
            text(f"SET LOCAL app.current_tenant_id = '{org_a_id}'")
        )
        result_a = await test_db.execute(text("SELECT COUNT(*) FROM professionals"))
        count_a = result_a.scalar()

        # Org B query
        await test_db.execute(
            text(f"SET LOCAL app.current_tenant_id = '{org_b_id}'")
        )
        result_b = await test_db.execute(text("SELECT COUNT(*) FROM professionals"))
        count_b = result_b.scalar()

        assert count_a == 3
        assert count_b == 3
        assert count_a == count_b, "Both tenants must see all 3 professionals"

    async def test_professional_werkgebied_array_query(
        self, test_db, sample_professional
    ):
        """
        GIN index supports ARRAY containment queries for werkgebied filtering.

        This is the core query pattern used in Phase 71 lead matching.
        """
        # Explicit cast required: ARRAY['Amsterdam']::varchar[] matches character varying[]
        result = await test_db.execute(
            text("SELECT naam FROM professionals WHERE werkgebied @> ARRAY['Amsterdam']::varchar[]")
        )
        rows = result.fetchall()

        assert len(rows) == 1
        assert rows[0].naam == "Test KB"

    async def test_inactive_professional_still_queryable(
        self, test_db, two_orgs
    ):
        """
        is_active=False professionals are still in DB (filtered at application layer).

        The RLS policy does not filter by is_active — that is the responsibility
        of the router/service layer in Phase 71.
        """
        org_a_id, _ = two_orgs

        inactive_prof = Professional(
            naam="Inactive Professional",
            werkgebied=["Utrecht"],
            gevolgklassen=["GK2"],
            is_active=False,
        )
        test_db.add(inactive_prof)
        await test_db.flush()
        await test_db.commit()

        await test_db.execute(
            text(f"SET LOCAL app.current_tenant_id = '{org_a_id}'")
        )
        result = await test_db.execute(
            text("SELECT naam, is_active FROM professionals WHERE is_active = FALSE")
        )
        rows = result.fetchall()

        assert len(rows) == 1
        assert rows[0].naam == "Inactive Professional"
        assert rows[0].is_active is False


class TestProfessionalModel:
    """Unit-level tests for the Professional model structure."""

    async def test_professional_tablename(self, test_db):
        """Professionals table is named 'professionals'."""
        assert Professional.__tablename__ == "professionals"

    async def test_professional_required_columns_present(self, test_db):
        """All required columns from the data spec are present."""
        columns = {col.name for col in Professional.__table__.columns}
        required = {
            "id", "naam", "bedrijfsnaam", "werkgebied", "gevolgklassen",
            "email", "telefoon", "website", "tlokb_url", "is_active",
            "created_at", "updated_at",
        }
        assert required.issubset(columns), (
            f"Missing columns: {required - columns}"
        )

    async def test_professional_created_with_defaults(self, test_db):
        """Professional can be created with only naam (all other fields have defaults)."""
        prof = Professional(
            naam="Minimal Professional",
            werkgebied=[],
            gevolgklassen=[],
        )
        test_db.add(prof)
        await test_db.flush()
        await test_db.commit()

        assert prof.id is not None
        assert isinstance(prof.id, uuid.UUID)
        assert prof.naam == "Minimal Professional"
        assert prof.is_active is True
        assert prof.werkgebied == []
        assert prof.gevolgklassen == []
        assert prof.bedrijfsnaam is None
