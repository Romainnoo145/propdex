"""Integration tests for reports router HTTP endpoints."""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, patch

from geoalchemy2 import WKTElement
from httpx import AsyncClient
from sqlalchemy import func, select

from app.main import app
from app.models.parcel_cache import ParcelCache
from app.models.report import SavedReport
from app.schemas.property import PropertyReportResponse


def _make_report_data(
    straat: str = "Keizersgracht",
    huisnummer: int = 123,
    postcode: str = "1015 CJ",
    woonplaats: str = "Amsterdam",
) -> dict:
    """
    Create a valid PropertyReportResponse-compatible dict for testing.

    Includes both 'straat' and 'straatnaam' keys to match service.save_report
    requirements (it accesses both from the address dict).
    """
    return {
        "address": {
            "nummeraanduiding_id": "0363200000123456",
            "straat": straat,
            "straatnaam": straat,  # Service accesses both keys
            "huisnummer": huisnummer,
            "postcode": postcode,
            "woonplaats": woonplaats,
        },
        "completeness_score": 0.67,
        "resolved_at": datetime.utcnow().isoformat() + "Z",
        "data_sources": [{"source": "BAG API v2", "is_cached": False}],
        "section_sources": [],
        "errors": [],
        "cadastral_parcels": [],
        "building": None,
        "zoning": None,
        "monuments": None,
        "map_data": None,
        "ai_parsing": None,
    }


async def _get_auth_token(
    client: AsyncClient,
    email: str = "test@example.com",
    password: str = "TestPass123!",
) -> str:
    """
    Authenticate and return access token.

    Helper to avoid repeating auth flow in every test.
    """
    resp = await client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


class TestSaveReport:
    """Test POST /api/reports endpoint."""

    async def test_save_report_returns_201_with_detail(
        self, async_client: AsyncClient, create_test_user
    ):
        """Test saving a report returns 201 with ReportDetailResponse."""
        # Create user and authenticate
        user, org = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        # Save report
        report_data = _make_report_data()
        response = await async_client.post(
            "/api/reports",
            json={"report_data": report_data, "notes": None, "project_id": None},
            headers={"Authorization": f"Bearer {token}"},
        )

        # Verify response
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["report_name"] == "Keizersgracht 123, Amsterdam"
        assert data["postcode"] == "1015 CJ"
        assert data["city"] == "Amsterdam"
        # Check key fields from report_data (may have been normalized by Pydantic)
        assert data["report_data"]["completeness_score"] == 0.67
        assert data["report_data"]["address"]["straat"] == "Keizersgracht"
        assert "created_at" in data
        assert "updated_at" in data

    async def test_save_report_without_auth_returns_401(self, async_client: AsyncClient):
        """Test saving a report without auth token returns 401."""
        report_data = _make_report_data()
        response = await async_client.post(
            "/api/reports",
            json={"report_data": report_data, "notes": None, "project_id": None},
        )

        assert response.status_code == 401

    async def test_save_report_with_notes(
        self, async_client: AsyncClient, create_test_user
    ):
        """Test saving a report with notes persists the notes field."""
        # Create user and authenticate
        user, org = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        # Save report with notes
        report_data = _make_report_data()
        response = await async_client.post(
            "/api/reports",
            json={
                "report_data": report_data,
                "notes": "Important property for client X",
                "project_id": None,
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        # Verify notes persisted
        assert response.status_code == 201
        data = response.json()
        assert data["notes"] == "Important property for client X"


class TestGenerateFromParcel:
    """Test POST /api/reports/from-parcel endpoint."""

    async def test_from_parcel_is_idempotent(
        self,
        async_client: AsyncClient,
        create_test_user,
        test_db,
    ):
        """Second generate call re-aggregates and updates existing report (no duplicate row)."""
        user, org = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        parcel = ParcelCache(
            parcel_id="TEST-PARCEL-001",
            geometry=WKTElement(
                "MULTIPOLYGON(((155000 463000,155010 463000,155010 463010,155000 463010,155000 463000)))",
                srid=28992,
            ),
            address="Keizersgracht 123, 1015 CJ Amsterdam",
            gemeente_code="GM0363",
            area_m2=100.0,
            has_pand=True,
        )
        test_db.add(parcel)
        await test_db.commit()
        await test_db.refresh(parcel)

        first_report_data = _make_report_data()
        second_report_data = _make_report_data()
        second_report_data["completeness_score"] = 0.85
        second_report_data["address"]["huisnummer"] = 123  # same address, different score

        first_mock = PropertyReportResponse.model_validate(first_report_data)
        second_mock = PropertyReportResponse.model_validate(second_report_data)

        app.state.http_client = AsyncMock()
        app.state.arq_pool = None
        with patch(
            "app.reports.service.aggregate_property_data",
            new=AsyncMock(side_effect=[first_mock, second_mock]),
        ) as mocked_aggregate:
            first = await async_client.post(
                "/api/reports/from-parcel",
                json={"parcel_id": str(parcel.id)},
                headers={"Authorization": f"Bearer {token}"},
            )
            first_data = first.json()
            first_updated_at = first_data["report"]["updated_at"]

            second = await async_client.post(
                "/api/reports/from-parcel",
                json={"parcel_id": str(parcel.id)},
                headers={"Authorization": f"Bearer {token}"},
            )

        assert first.status_code == 201
        assert second.status_code == 200
        first_data = first.json()
        second_data = second.json()
        assert first_data["created"] is True
        assert second_data["created"] is False
        assert first_data["report"]["id"] == second_data["report"]["id"]
        # Aggregate called twice (once per request, no early-return skip)
        assert mocked_aggregate.await_count == 2
        # Second response reflects updated data
        assert second_data["report"]["report_data"]["completeness_score"] == 0.85
        # updated_at changed on re-generation
        assert second_data["report"]["updated_at"] != first_updated_at

        count_query = select(func.count()).select_from(SavedReport).where(
            SavedReport.user_id == user.id,
            SavedReport.deleted_at.is_(None),
            SavedReport.source_parcel_id == parcel.id,
        )
        count = (await test_db.execute(count_query)).scalar_one()
        assert count == 1


class TestGetReport:
    """Test GET /api/reports/:id endpoint."""

    async def test_get_report_returns_detail(
        self, async_client: AsyncClient, create_test_user
    ):
        """Test getting a report by ID returns full ReportDetailResponse."""
        # Create user and authenticate
        user, org = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        # Save a report first
        report_data = _make_report_data()
        save_response = await async_client.post(
            "/api/reports",
            json={"report_data": report_data, "notes": "Get test", "project_id": None},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert save_response.status_code == 201
        report_id = save_response.json()["id"]

        # Get the report
        get_response = await async_client.get(
            f"/api/reports/{report_id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        # Verify full data returned
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["id"] == report_id
        assert data["report_name"] == "Keizersgracht 123, Amsterdam"
        # Check key fields from report_data (may have been normalized by Pydantic)
        assert data["report_data"]["completeness_score"] == 0.67
        assert data["report_data"]["address"]["straat"] == "Keizersgracht"
        assert data["report_data"]["address"]["huisnummer"] == 123
        assert data["notes"] == "Get test"
        assert "created_at" in data
        assert "updated_at" in data

    async def test_get_nonexistent_report_returns_404(
        self, async_client: AsyncClient, create_test_user
    ):
        """Test getting a nonexistent report returns 404."""
        # Create user and authenticate
        user, org = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        # Try to get nonexistent report
        random_uuid = str(uuid.uuid4())
        response = await async_client.get(
            f"/api/reports/{random_uuid}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404


class TestDeleteReport:
    """Test DELETE /api/reports/:id endpoint."""

    async def test_delete_report_soft_deletes(
        self, async_client: AsyncClient, create_test_user
    ):
        """Test deleting a report soft-deletes it (subsequent GET returns 404)."""
        # Create user and authenticate
        user, org = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        # Save a report
        report_data = _make_report_data()
        save_response = await async_client.post(
            "/api/reports",
            json={"report_data": report_data, "notes": None, "project_id": None},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert save_response.status_code == 201
        report_id = save_response.json()["id"]

        # Delete the report
        delete_response = await async_client.delete(
            f"/api/reports/{report_id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        # Verify delete succeeded
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert "deleted" in data["message"].lower()
        assert data["report_id"] == report_id

        # Verify report is now invisible (soft-deleted)
        get_response = await async_client.get(
            f"/api/reports/{report_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_response.status_code == 404

    async def test_delete_nonexistent_report_returns_404(
        self, async_client: AsyncClient, create_test_user
    ):
        """Test deleting a nonexistent report returns 404."""
        # Create user and authenticate
        user, org = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        # Try to delete nonexistent report
        random_uuid = str(uuid.uuid4())
        response = await async_client.delete(
            f"/api/reports/{random_uuid}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404


class TestPDFExport:
    """Test GET /api/reports/:id/export/pdf endpoint."""

    async def test_export_pdf_returns_pdf_content(
        self, async_client: AsyncClient, create_test_user
    ):
        """Test PDF export returns application/pdf with correct headers."""
        # Create user and authenticate
        user, org = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        # Save a report
        report_data = _make_report_data(postcode="1015 CJ")
        save_response = await async_client.post(
            "/api/reports",
            json={"report_data": report_data, "notes": None, "project_id": None},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert save_response.status_code == 201
        report_id = save_response.json()["id"]

        # Mock PDF generation at the router import point to avoid WeasyPrint dependency
        with patch("app.reports.router.generate_report_pdf") as mock_pdf:
            mock_pdf.return_value = b"%PDF-1.4 test content"

            # Export PDF
            response = await async_client.get(
                f"/api/reports/{report_id}/export/pdf",
                headers={"Authorization": f"Bearer {token}"},
            )

        # Verify PDF response
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "content-disposition" in response.headers
        assert "rapport-1015CJ.pdf" in response.headers["content-disposition"]
        assert response.content == b"%PDF-1.4 test content"

    async def test_export_pdf_without_auth_returns_401(self, async_client: AsyncClient):
        """Test PDF export without auth token returns 401."""
        random_uuid = str(uuid.uuid4())
        response = await async_client.get(
            f"/api/reports/{random_uuid}/export/pdf",
        )

        assert response.status_code == 401


class TestFreshnessCheck:
    """Test GET /api/reports/:id/freshness endpoint."""

    async def test_freshness_check_returns_result(
        self, async_client: AsyncClient, create_test_user
    ):
        """Test freshness check returns ReportFreshnessResponse."""
        # Create user and authenticate
        user, org = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        # Save a report with section_sources (must be valid SectionSourceInfo schema)
        report_data = _make_report_data()
        report_data["section_sources"] = [
            {
                "section": "zoning",
                "sources": [
                    {"source": "DSO Ruimtelijke Plannen API v4", "is_cached": True}
                ],
                "cached_at": datetime.utcnow().isoformat() + "Z",
            }
        ]
        save_response = await async_client.post(
            "/api/reports",
            json={"report_data": report_data, "notes": None, "project_id": None},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert save_response.status_code == 201
        report_id = save_response.json()["id"]

        # Check freshness
        response = await async_client.get(
            f"/api/reports/{report_id}/freshness",
            headers={"Authorization": f"Bearer {token}"},
        )

        # Verify freshness response structure
        assert response.status_code == 200
        data = response.json()
        assert data["report_id"] == report_id
        assert "has_updates" in data
        assert "updated_sections" in data
        assert isinstance(data["has_updates"], bool)
        assert isinstance(data["updated_sections"], list)

    async def test_freshness_without_auth_returns_401(self, async_client: AsyncClient):
        """Test freshness check without auth token returns 401."""
        random_uuid = str(uuid.uuid4())
        response = await async_client.get(
            f"/api/reports/{random_uuid}/freshness",
        )

        assert response.status_code == 401


class TestMultiTenantIsolation:
    """Test cross-organization access returns 404 at HTTP level."""

    async def test_cross_org_report_access_returns_404(
        self, async_client: AsyncClient, create_test_user
    ):
        """Test org B cannot access org A's report via HTTP (returns 404, not 403)."""
        # Create two organizations with users
        user_a, org_a = await create_test_user(email="a@test.com", org_name="Org A")
        user_b, org_b = await create_test_user(email="b@test.com", org_name="Org B")

        # Org A authenticates and saves a report
        token_a = await _get_auth_token(async_client, "a@test.com")
        report_data = _make_report_data()
        save_response = await async_client.post(
            "/api/reports",
            json={"report_data": report_data, "notes": "Org A report", "project_id": None},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert save_response.status_code == 201
        report_a_id = save_response.json()["id"]

        # Org B authenticates and tries to access org A's report
        token_b = await _get_auth_token(async_client, "b@test.com")
        response = await async_client.get(
            f"/api/reports/{report_a_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )

        # Should return 404 (not 403) to prevent resource enumeration
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
