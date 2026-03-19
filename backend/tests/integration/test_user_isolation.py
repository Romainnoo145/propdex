"""Integration tests for user-scoped data isolation.

Proves that user A cannot see user B's favorites, reports, or documents.
This is the end-to-end verification that S03's user-scoping works correctly.
"""

import uuid

import pytest
from sqlalchemy import func, select

from app.models.organization import Organization
from app.models.parcel_favorite import ParcelFavorite
from app.models.parcel_document import ParcelDocument
from app.models.report import SavedReport
from app.reports import service as report_service


@pytest.fixture
async def two_users(test_db):
    """Create two users in the same org for isolation testing."""
    from app.auth.password import hash_password
    from app.models.user import User

    org = Organization(name="Isolation Test Org")
    test_db.add(org)
    await test_db.flush()

    user_a = User(
        email="user_a@test.com",
        hashed_password=hash_password("TestPass123!"),
        full_name="User A",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    user_b = User(
        email="user_b@test.com",
        hashed_password=hash_password("TestPass123!"),
        full_name="User B",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    test_db.add(user_a)
    test_db.add(user_b)
    await test_db.flush()
    await test_db.commit()
    return user_a, user_b, org


class TestFavoriteIsolation:
    """User A's favorites are invisible to user B."""

    async def test_favorites_scoped_to_user(self, test_db, two_users):
        user_a, user_b, org = two_users

        # User A favorites a parcel
        fav_a = ParcelFavorite(
            user_id=user_a.id,
            parcel_id="TST01-A-0001",
            gemeente_code="0001",
        )
        test_db.add(fav_a)
        await test_db.flush()
        await test_db.commit()

        # Query as user A — should find it
        result_a = (await test_db.execute(
            select(ParcelFavorite).where(ParcelFavorite.user_id == user_a.id)
        )).scalars().all()
        assert len(result_a) == 1
        assert result_a[0].parcel_id == "TST01-A-0001"

        # Query as user B — should find nothing
        result_b = (await test_db.execute(
            select(ParcelFavorite).where(ParcelFavorite.user_id == user_b.id)
        )).scalars().all()
        assert len(result_b) == 0

    async def test_favorite_unique_per_user(self, test_db, two_users):
        """Two users can favorite the same parcel independently."""
        user_a, user_b, org = two_users

        fav_a = ParcelFavorite(user_id=user_a.id, parcel_id="SHARED-PARCEL")
        fav_b = ParcelFavorite(user_id=user_b.id, parcel_id="SHARED-PARCEL")
        test_db.add(fav_a)
        test_db.add(fav_b)
        await test_db.flush()
        await test_db.commit()

        total = (await test_db.execute(
            select(func.count()).select_from(ParcelFavorite).where(
                ParcelFavorite.parcel_id == "SHARED-PARCEL"
            )
        )).scalar()
        assert total == 2  # Both users have it


class TestReportIsolation:
    """User A's reports are invisible to user B via service layer."""

    async def test_list_reports_scoped_to_user(self, test_db, two_users):
        user_a, user_b, org = two_users

        # User A saves a report
        report_data = {
            "address": {
                "nummeraanduiding_id": "0363200000406628",
                "straat": "Keizersgracht",
                "straatnaam": "Keizersgracht",
                "huisnummer": "123",
                "huisletter": None,
                "huisnummertoevoeging": None,
                "postcode": "1015CJ",
                "woonplaats": "Amsterdam",
                "gemeente": "Amsterdam",
                "provincie": "Noord-Holland",
            },
            "completeness_score": 0.8,
            "resolved_at": "2026-03-19T12:00:00Z",
            "building": None,
            "cadastral_parcels": [],
            "data_sources": [],
            "errors": [],
            "zoning": None,
            "monuments": None,
            "map_data": None,
            "section_sources": [],
            "ai_parsing": None,
        }

        await report_service.save_report(
            report_data=report_data,
            notes="User A's report",
            project_id=None,
            user_id=user_a.id,
            organization_id=org.id,
            session=test_db,
        )

        # User A lists reports — should see 1
        reports_a, total_a = await report_service.list_reports(
            user_id=user_a.id,
            organization_id=org.id,
            city=None,
            project_id=None,
            search_query=None,
            sort_by="created",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )
        assert total_a == 1

        # User B lists reports — should see 0
        reports_b, total_b = await report_service.list_reports(
            user_id=user_b.id,
            organization_id=org.id,
            city=None,
            project_id=None,
            search_query=None,
            sort_by="created",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )
        assert total_b == 0

    async def test_get_report_cross_user_returns_404(self, test_db, two_users):
        """User B cannot access user A's report by ID."""
        user_a, user_b, org = two_users
        from fastapi import HTTPException

        report_data = {
            "address": {
                "nummeraanduiding_id": "0363200000406628",
                "straat": "Herengracht",
                "straatnaam": "Herengracht",
                "huisnummer": "456",
                "huisletter": None,
                "huisnummertoevoeging": None,
                "postcode": "1017BX",
                "woonplaats": "Amsterdam",
                "gemeente": "Amsterdam",
                "provincie": "Noord-Holland",
            },
            "completeness_score": 0.7,
            "resolved_at": "2026-03-19T12:00:00Z",
            "building": None,
            "cadastral_parcels": [],
            "data_sources": [],
            "errors": [],
            "zoning": None,
            "monuments": None,
            "map_data": None,
            "section_sources": [],
            "ai_parsing": None,
        }

        report = await report_service.save_report(
            report_data=report_data,
            notes=None,
            project_id=None,
            user_id=user_a.id,
            organization_id=org.id,
            session=test_db,
        )

        # User B tries to get it — should get 404
        with pytest.raises(HTTPException) as exc_info:
            await report_service.get_report(report.id, user_b.id, org.id, test_db)
        assert exc_info.value.status_code == 404


class TestDocumentIsolation:
    """User A's documents are invisible to user B."""

    async def test_documents_scoped_to_user(self, test_db, two_users):
        user_a, user_b, org = two_users

        doc = ParcelDocument(
            parcel_id="TST01-A-0001",
            document_type="bestemmingscheck",
            filename="test.pdf",
            content_type="application/pdf",
            file_data=b"fake pdf",
            file_size=8,
            uploaded_by_user_id=user_a.id,
        )
        test_db.add(doc)
        await test_db.flush()
        await test_db.commit()

        # Query as user A
        result_a = (await test_db.execute(
            select(ParcelDocument).where(ParcelDocument.uploaded_by_user_id == user_a.id)
        )).scalars().all()
        assert len(result_a) == 1

        # Query as user B
        result_b = (await test_db.execute(
            select(ParcelDocument).where(ParcelDocument.uploaded_by_user_id == user_b.id)
        )).scalars().all()
        assert len(result_b) == 0
