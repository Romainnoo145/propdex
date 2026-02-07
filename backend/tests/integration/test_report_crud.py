"""Integration tests for report CRUD operations against real PostgreSQL database."""

import uuid
from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.organization import Organization
from app.models.project import Project
from app.models.report import SavedReport
from app.reports import service


def _make_report_data(
    straat: str,
    huisnummer: int,
    postcode: str,
    woonplaats: str,
    completeness_score: float = 0.85,
) -> dict:
    """
    Create a valid PropertyReportResponse-compatible dict for testing.

    Includes all required fields with sensible defaults.
    """
    return {
        "address": {
            "nummeraanduiding_id": "0363200000406628",
            "straat": straat,
            "straatnaam": straat,  # Service accesses both 'straat' and 'straatnaam'
            "huisnummer": huisnummer,
            "postcode": postcode,
            "woonplaats": woonplaats,
        },
        "building": None,
        "cadastral_parcels": [],
        "completeness_score": completeness_score,
        "resolved_at": datetime.utcnow().isoformat() + "Z",
        "data_sources": [],
        "errors": [],
        "zoning": None,
        "monuments": None,
        "map_data": None,
        "section_sources": [],
        "ai_parsing": None,
    }


@pytest.fixture
async def org_id(test_db):
    """Create a test organization and return its ID."""
    org = Organization(name="Report Test Org")
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org.id


@pytest.fixture
async def project_id(test_db, org_id):
    """Create a test project and return its ID."""
    project = Project(
        name="Test Project",
        organization_id=org_id,
    )
    test_db.add(project)
    await test_db.flush()
    await test_db.commit()
    return project.id


class TestSaveReport:
    async def test_save_stores_denormalized_fields(self, test_db, org_id):
        """Test saving a report stores JSONB data with correct denormalized fields."""
        report_data = _make_report_data(
            straat="Keizersgracht",
            huisnummer=42,
            postcode="1234 AB",
            woonplaats="Amsterdam",
            completeness_score=0.92,
        )

        report = await service.save_report(
            report_data=report_data,
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        # Direct DB assertion
        stmt = select(SavedReport).where(SavedReport.id == report.id)
        row = (await test_db.execute(stmt)).scalar_one()

        assert row.report_name == "Keizersgracht 42, Amsterdam"
        assert row.postcode == "1234 AB"
        assert row.city == "Amsterdam"
        assert row.report_data["completeness_score"] == 0.92
        assert row.organization_id == org_id
        assert row.deleted_at is None

    async def test_save_with_project_id(self, test_db, org_id, project_id):
        """Test saving a report with project_id associates it correctly."""
        report_data = _make_report_data(
            straat="Prinsengracht",
            huisnummer=100,
            postcode="1015 EA",
            woonplaats="Amsterdam",
        )

        report = await service.save_report(
            report_data=report_data,
            notes="Test with project",
            project_id=project_id,
            organization_id=org_id,
            session=test_db,
        )

        assert report.project_id == project_id
        assert report.notes == "Test with project"

        # Verify via DB
        stmt = select(SavedReport).where(SavedReport.id == report.id)
        row = (await test_db.execute(stmt)).scalar_one()
        assert row.project_id == project_id

    async def test_save_invalid_data_raises_value_error(self, test_db, org_id):
        """Test saving invalid report_data raises ValueError."""
        invalid_data = {"invalid": True}

        with pytest.raises(ValueError, match="Invalid report_data"):
            await service.save_report(
                report_data=invalid_data,
                notes=None,
                project_id=None,
                organization_id=org_id,
                session=test_db,
            )


class TestListReports:
    async def test_filter_by_city(self, test_db, org_id):
        """Test city filter returns only matching reports."""
        # Save reports in different cities
        await service.save_report(
            report_data=_make_report_data("Damrak", 1, "1012 LG", "Amsterdam"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )
        await service.save_report(
            report_data=_make_report_data("Coolsingel", 40, "3011 AD", "Rotterdam"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        # List with city filter
        reports, total = await service.list_reports(
            organization_id=org_id,
            city="Amsterdam",
            project_id=None,
            search_query=None,
            sort_by="updated",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )

        assert total == 1
        assert reports[0].city == "Amsterdam"

    async def test_search_by_address(self, test_db, org_id):
        """Test ILIKE search on report_name."""
        await service.save_report(
            report_data=_make_report_data("Keizersgracht", 123, "1015 CJ", "Amsterdam"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )
        await service.save_report(
            report_data=_make_report_data("Herengracht", 456, "1017 BS", "Amsterdam"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        # Case-insensitive search
        reports, total = await service.list_reports(
            organization_id=org_id,
            city=None,
            project_id=None,
            search_query="keizer",
            sort_by="updated",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )

        assert total == 1
        assert "Keizersgracht" in reports[0].report_name

    async def test_pagination_offset_limit(self, test_db, org_id):
        """Test pagination with offset and limit."""
        # Save 3 reports
        for i in range(3):
            await service.save_report(
                report_data=_make_report_data(
                    f"Street{i}", i + 1, f"100{i} AA", "TestCity"
                ),
                notes=None,
                project_id=None,
                organization_id=org_id,
                session=test_db,
            )

        # Get second page with limit 1
        reports, total = await service.list_reports(
            organization_id=org_id,
            city=None,
            project_id=None,
            search_query=None,
            sort_by="updated",
            sort_order="desc",
            offset=1,
            limit=1,
            session=test_db,
        )

        assert total == 3
        assert len(reports) == 1

    async def test_sort_by_address_asc(self, test_db, org_id):
        """Test sorting by address (report_name) in ascending order."""
        # Save reports with different street names
        await service.save_report(
            report_data=_make_report_data("Zeeburg", 1, "1000 AA", "Amsterdam"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )
        await service.save_report(
            report_data=_make_report_data("Aalborg", 2, "1001 AA", "Amsterdam"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        # Sort by address ascending
        reports, total = await service.list_reports(
            organization_id=org_id,
            city=None,
            project_id=None,
            search_query=None,
            sort_by="address",
            sort_order="asc",
            offset=0,
            limit=50,
            session=test_db,
        )

        assert total == 2
        assert "Aalborg" in reports[0].report_name
        assert "Zeeburg" in reports[1].report_name

    async def test_filter_by_project(self, test_db, org_id, project_id):
        """Test filtering reports by project_id."""
        # Save report with project
        await service.save_report(
            report_data=_make_report_data("WithProject", 1, "1000 AA", "City"),
            notes=None,
            project_id=project_id,
            organization_id=org_id,
            session=test_db,
        )
        # Save report without project
        await service.save_report(
            report_data=_make_report_data("NoProject", 2, "1001 AA", "City"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        # Filter by project
        reports, total = await service.list_reports(
            organization_id=org_id,
            city=None,
            project_id=project_id,
            search_query=None,
            sort_by="updated",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )

        assert total == 1
        assert reports[0].project_id == project_id


class TestGetReport:
    async def test_get_returns_full_data(self, test_db, org_id):
        """Test getting a report by ID returns full report_data."""
        saved_report = await service.save_report(
            report_data=_make_report_data("TestStraat", 99, "9999 ZZ", "TestStad"),
            notes="Full data test",
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        retrieved = await service.get_report(
            report_id=saved_report.id,
            organization_id=org_id,
            session=test_db,
        )

        assert retrieved.id == saved_report.id
        assert retrieved.report_data["completeness_score"] == 0.85
        assert retrieved.notes == "Full data test"

    async def test_get_nonexistent_raises_404(self, test_db, org_id):
        """Test getting nonexistent report raises 404."""
        random_id = uuid.uuid4()

        with pytest.raises(HTTPException) as exc_info:
            await service.get_report(
                report_id=random_id,
                organization_id=org_id,
                session=test_db,
            )

        assert exc_info.value.status_code == 404


class TestSoftDelete:
    async def test_delete_sets_deleted_at(self, test_db, org_id):
        """Test soft-deleting a report sets deleted_at timestamp."""
        report = await service.save_report(
            report_data=_make_report_data("ToDelete", 1, "1000 AA", "City"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        await service.soft_delete_report(
            report_id=report.id,
            organization_id=org_id,
            session=test_db,
        )

        # Direct DB assertion
        stmt = select(SavedReport).where(SavedReport.id == report.id)
        row = (await test_db.execute(stmt)).scalar_one()
        assert row.deleted_at is not None

    async def test_deleted_excluded_from_list(self, test_db, org_id):
        """Test soft-deleted reports are excluded from list queries."""
        report = await service.save_report(
            report_data=_make_report_data("HideMe", 2, "2000 BB", "City"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        await service.soft_delete_report(
            report_id=report.id,
            organization_id=org_id,
            session=test_db,
        )

        # List should return 0 reports
        reports, total = await service.list_reports(
            organization_id=org_id,
            city=None,
            project_id=None,
            search_query=None,
            sort_by="updated",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )

        assert total == 0

    async def test_restore_clears_deleted_at(self, test_db, org_id):
        """Test restoring a soft-deleted report clears deleted_at."""
        report = await service.save_report(
            report_data=_make_report_data("Restore", 3, "3000 CC", "City"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        # Delete then restore
        await service.soft_delete_report(
            report_id=report.id,
            organization_id=org_id,
            session=test_db,
        )
        await service.restore_report(
            report_id=report.id,
            organization_id=org_id,
            session=test_db,
        )

        # Direct DB assertion
        stmt = select(SavedReport).where(SavedReport.id == report.id)
        row = (await test_db.execute(stmt)).scalar_one()
        assert row.deleted_at is None

        # Should be visible in list again
        reports, total = await service.list_reports(
            organization_id=org_id,
            city=None,
            project_id=None,
            search_query=None,
            sort_by="updated",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )

        assert total == 1


class TestUpdateNotes:
    async def test_update_notes_persists(self, test_db, org_id):
        """Test updating report notes persists the change."""
        report = await service.save_report(
            report_data=_make_report_data("NotesTest", 4, "4000 DD", "City"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        # Update notes
        await service.update_report_notes(
            report_id=report.id,
            organization_id=org_id,
            notes="Updated notes",
            session=test_db,
        )

        # Verify via get
        updated = await service.get_report(
            report_id=report.id,
            organization_id=org_id,
            session=test_db,
        )

        assert updated.notes == "Updated notes"


class TestDistinctCities:
    async def test_distinct_cities_sorted(self, test_db, org_id):
        """Test distinct cities returns sorted unique city names from active reports only."""
        # Save reports in different cities (with duplicates)
        await service.save_report(
            report_data=_make_report_data("Street1", 1, "1000 AA", "Rotterdam"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )
        await service.save_report(
            report_data=_make_report_data("Street2", 2, "2000 BB", "Amsterdam"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )
        await service.save_report(
            report_data=_make_report_data("Street3", 3, "3000 CC", "Amsterdam"),
            notes=None,
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        cities = await service.get_distinct_cities(
            organization_id=org_id,
            session=test_db,
        )

        # Should be sorted and deduplicated
        assert cities == ["Amsterdam", "Rotterdam"]
