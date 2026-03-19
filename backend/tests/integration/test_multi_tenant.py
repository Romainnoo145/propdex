"""Integration tests for multi-tenant isolation across reports, cache, and auth tokens."""

from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.auth.jwt import create_access_token
from app.auth.password import hash_password
from app.models.organization import Organization
from app.models.user import User
from app.reports import service
from app.services.cache_manager import get_cached_or_fetch


def _make_report_data(
    straatnaam: str,
    huisnummer: str,
    postcode: str,
    woonplaats: str,
) -> dict:
    """
    Create a valid PropertyReportResponse-compatible dict for testing.

    Returns minimal valid report data with all required BAGAddressResponse fields.
    """
    return {
        "address": {
            "nummeraanduiding_id": "0363200000406628",
            "straat": straatnaam,
            "straatnaam": straatnaam,
            "huisnummer": huisnummer,
            "huisletter": None,
            "huisnummertoevoeging": None,
            "postcode": postcode,
            "woonplaats": woonplaats,
            "gemeente": woonplaats,
            "provincie": "Noord-Holland",
        },
        "completeness_score": 0.8,
        "resolved_at": "2026-02-07T12:00:00Z",
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


@pytest.fixture
async def two_orgs_with_users(test_db):
    """Create two organizations with users for isolation tests."""
    org_a = Organization(name="Org A")
    org_b = Organization(name="Org B")
    test_db.add(org_a)
    test_db.add(org_b)
    await test_db.flush()

    user_a = User(
        email="a@test.com",
        hashed_password=hash_password("TestPass123!"),
        full_name="User A",
        organization_id=org_a.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    user_b = User(
        email="b@test.com",
        hashed_password=hash_password("TestPass123!"),
        full_name="User B",
        organization_id=org_b.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
    )
    test_db.add(user_a)
    test_db.add(user_b)
    await test_db.commit()

    return (user_a, org_a), (user_b, org_b)


class TestReportIsolation:
    """Test cross-user report access returns 404 (not 403) preventing enumeration."""

    async def test_get_cross_user_returns_404(self, test_db, two_orgs_with_users):
        """Test user B cannot read user A's report via service layer (returns 404)."""
        (user_a, org_a), (user_b, org_b) = two_orgs_with_users

        # User A saves a report
        report_data = _make_report_data(
            straatnaam="Keizersgracht",
            huisnummer="123",
            postcode="1015 CJ",
            woonplaats="Amsterdam",
        )
        report_a = await service.save_report(
            report_data=report_data,
            notes="User A's report",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        # User B tries to get it
        with pytest.raises(HTTPException) as exc_info:
            await service.get_report(
                report_id=report_a.id,
                user_id=user_b.id,
                organization_id=org_b.id,
                session=test_db,
            )

        # Should be 404 (not 403) to prevent resource enumeration
        assert exc_info.value.status_code == 404
        assert "not found" in exc_info.value.detail.lower()

    async def test_list_cross_user_returns_empty(self, test_db, two_orgs_with_users):
        """Test user B cannot list user A's reports (returns empty list)."""
        (user_a, org_a), (user_b, org_b) = two_orgs_with_users

        # User A saves 2 reports
        report_data_1 = _make_report_data(
            straatnaam="Herengracht",
            huisnummer="456",
            postcode="1017 BX",
            woonplaats="Amsterdam",
        )
        await service.save_report(
            report_data=report_data_1,
            notes="Report 1",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        report_data_2 = _make_report_data(
            straatnaam="Prinsengracht",
            huisnummer="789",
            postcode="1016 HN",
            woonplaats="Amsterdam",
        )
        await service.save_report(
            report_data=report_data_2,
            notes="Report 2",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        # User B lists reports
        reports, total = await service.list_reports(
            user_id=user_b.id,
            organization_id=org_b.id,
            city=None,
            project_id=None,
            search_query=None,
            sort_by="created",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )

        # Should return empty (not user A's reports)
        assert total == 0
        assert len(reports) == 0

    async def test_delete_cross_user_returns_404(self, test_db, two_orgs_with_users):
        """Test user B cannot soft-delete user A's report (returns 404)."""
        (user_a, org_a), (user_b, org_b) = two_orgs_with_users

        # User A saves a report
        report_data = _make_report_data(
            straatnaam="Damrak",
            huisnummer="1",
            postcode="1012 LG",
            woonplaats="Amsterdam",
        )
        report_a = await service.save_report(
            report_data=report_data,
            notes="Cannot delete me",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        # User B tries to delete it
        with pytest.raises(HTTPException) as exc_info:
            await service.soft_delete_report(
                report_id=report_a.id,
                user_id=user_b.id,
                organization_id=org_b.id,
                session=test_db,
            )

        # Should be 404
        assert exc_info.value.status_code == 404

        # Verify user A's report still exists (not deleted)
        report_check = await service.get_report(
            report_id=report_a.id,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )
        assert report_check.deleted_at is None

    async def test_distinct_cities_cross_user_isolated(self, test_db, two_orgs_with_users):
        """Test distinct cities endpoint returns only requesting user's cities."""
        (user_a, org_a), (user_b, org_b) = two_orgs_with_users

        # User A saves reports in Amsterdam and Rotterdam
        amsterdam_data = _make_report_data(
            straatnaam="Kalverstraat",
            huisnummer="1",
            postcode="1012 NX",
            woonplaats="Amsterdam",
        )
        await service.save_report(
            report_data=amsterdam_data,
            notes="Amsterdam report",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        rotterdam_data = _make_report_data(
            straatnaam="Coolsingel",
            huisnummer="40",
            postcode="3011 AD",
            woonplaats="Rotterdam",
        )
        await service.save_report(
            report_data=rotterdam_data,
            notes="Rotterdam report",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        # User B saves report in Utrecht
        utrecht_data = _make_report_data(
            straatnaam="Oudegracht",
            huisnummer="99",
            postcode="3511 AD",
            woonplaats="Utrecht",
        )
        await service.save_report(
            report_data=utrecht_data,
            notes="Utrecht report",
            project_id=None,
            user_id=user_b.id,
            organization_id=org_b.id,
            session=test_db,
        )

        # Get distinct cities for user A
        cities_a = await service.get_distinct_cities(
            user_id=user_a.id,
            session=test_db,
        )
        assert set(cities_a) == {"Amsterdam", "Rotterdam"}

        # Get distinct cities for user B
        cities_b = await service.get_distinct_cities(
            user_id=user_b.id,
            session=test_db,
        )
        assert cities_b == ["Utrecht"]


class TestSoftDeleteIsolation:
    """Test soft-deleted reports are invisible to all users."""

    async def test_deleted_report_invisible_to_own_user_list(self, test_db, two_orgs_with_users):
        """Test soft-deleted report is invisible in own user's list."""
        (user_a, org_a), (user_b, org_b) = two_orgs_with_users

        # User A saves and soft-deletes a report
        report_data = _make_report_data(
            straatnaam="Vijzelstraat",
            huisnummer="50",
            postcode="1017 HL",
            woonplaats="Amsterdam",
        )
        report_a = await service.save_report(
            report_data=report_data,
            notes="Will be deleted",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )
        await service.soft_delete_report(
            report_id=report_a.id,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        # List reports for user A
        reports, total = await service.list_reports(
            user_id=user_a.id,
            organization_id=org_a.id,
            city=None,
            project_id=None,
            search_query=None,
            sort_by="created",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )

        # Should be empty (deleted report not returned)
        assert total == 0
        assert len(reports) == 0

    async def test_deleted_report_invisible_to_other_user_get(self, test_db, two_orgs_with_users):
        """Test soft-deleted report from user A is invisible to user B get (404)."""
        (user_a, org_a), (user_b, org_b) = two_orgs_with_users

        # User A saves and soft-deletes a report
        report_data = _make_report_data(
            straatnaam="Nieuwezijds Voorburgwal",
            huisnummer="147",
            postcode="1012 RJ",
            woonplaats="Amsterdam",
        )
        report_a = await service.save_report(
            report_data=report_data,
            notes="Deleted report",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )
        await service.soft_delete_report(
            report_id=report_a.id,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        # User B tries to get it (even with valid UUID)
        with pytest.raises(HTTPException) as exc_info:
            await service.get_report(
                report_id=report_a.id,
                user_id=user_b.id,
                organization_id=org_b.id,
                session=test_db,
            )

        # Should be 404 (not leaked via cross-user access even when deleted)
        assert exc_info.value.status_code == 404


class TestSharedCacheAccess:
    """Cache is shared across all users — same key returns same data regardless of caller."""

    async def test_same_cache_key_is_shared(self, test_db, two_orgs_with_users):
        """Test same cache key returns shared data (no org isolation)."""
        cache_key = "bag:test:shared"

        fetch_first = AsyncMock(return_value={"data": "shared_value"})
        fetch_second = AsyncMock(return_value={"data": "should_not_be_called"})

        result_first = await get_cached_or_fetch(
            cache_key=cache_key,
            source="bag",
            fetch_fn=fetch_first,
            session=test_db,
        )
        result_second = await get_cached_or_fetch(
            cache_key=cache_key,
            source="bag",
            fetch_fn=fetch_second,
            session=test_db,
        )

        # Only first fetch called — second gets cached data
        fetch_first.assert_called_once()
        fetch_second.assert_not_called()

        # Both see same shared data
        assert result_first.data == {"data": "shared_value"}
        assert result_second.data == {"data": "shared_value"}
        assert result_second.is_cached is True


class TestAPIEndpointIsolation:
    """Test API endpoints with JWT tokens enforce user isolation."""

    async def test_api_get_report_cross_org_returns_404(
        self, async_client, test_db, two_orgs_with_users
    ):
        """Test org B's JWT cannot access org A's report via API (returns 404)."""
        (user_a, org_a), (user_b, org_b) = two_orgs_with_users

        # User A saves a report via service layer
        report_data = _make_report_data(
            straatnaam="Rokin",
            huisnummer="75",
            postcode="1012 KL",
            woonplaats="Amsterdam",
        )
        report_a = await service.save_report(
            report_data=report_data,
            notes="User A's API report",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        # Create JWT for user B
        token_b = create_access_token(str(user_b.id), str(org_b.id))

        # Send GET request with user B's token
        response = await async_client.get(
            f"/api/reports/{report_a.id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )

        # Should return 404 (user isolation at API level)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    async def test_api_list_reports_cross_org_empty(
        self, async_client, test_db, two_orgs_with_users
    ):
        """Test org B's JWT lists only own reports (not org A's) via API."""
        (user_a, org_a), (user_b, org_b) = two_orgs_with_users

        # User A saves 2 reports via service layer
        report_data_1 = _make_report_data(
            straatnaam="Spui",
            huisnummer="10",
            postcode="1012 WZ",
            woonplaats="Amsterdam",
        )
        await service.save_report(
            report_data=report_data_1,
            notes="User A Report 1",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        report_data_2 = _make_report_data(
            straatnaam="Reguliersdwarsstraat",
            huisnummer="20",
            postcode="1017 BM",
            woonplaats="Amsterdam",
        )
        await service.save_report(
            report_data=report_data_2,
            notes="User A Report 2",
            project_id=None,
            user_id=user_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        # Create JWT for user B
        token_b = create_access_token(str(user_b.id), str(org_b.id))

        # Send GET request to list reports with user B's token
        response = await async_client.get(
            "/api/reports",
            headers={"Authorization": f"Bearer {token_b}"},
        )

        # Should return 200 but empty list
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert len(data["reports"]) == 0
