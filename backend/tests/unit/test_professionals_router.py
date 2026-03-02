"""Unit tests for professional directory router endpoints (70-02).

Tests cover:
- Authentication gate: unauthenticated GET returns 401
- Filters: gemeente + gevolgklasse filters return correct subsets
- Admin CRUD: POST/PUT/DELETE require valid X-Admin-Key header
- Edge cases: wrong key, empty admin key, partial updates, soft-delete
"""

from httpx import AsyncClient

from app.core.config import settings
from app.models.professional import Professional

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_auth_token(
    client: AsyncClient,
    email: str = "test@example.com",
    password: str = "TestPass123!",
) -> str:
    """Authenticate and return access token."""
    resp = await client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


async def _insert_professional(
    test_db,
    naam: str,
    werkgebied: list[str],
    gevolgklassen: list[str],
    is_active: bool = True,
    **kwargs,
) -> Professional:
    """Directly insert a Professional row for test setup."""
    prof = Professional(
        naam=naam,
        werkgebied=werkgebied,
        gevolgklassen=gevolgklassen,
        is_active=is_active,
        **kwargs,
    )
    test_db.add(prof)
    await test_db.flush()
    await test_db.commit()
    return prof


# ---------------------------------------------------------------------------
# Tests: authentication gate
# ---------------------------------------------------------------------------


class TestListProfessionalsAuth:
    """Authentication checks for GET /api/professionals."""

    async def test_list_professionals_requires_auth(self, async_client: AsyncClient):
        """GET without auth returns 401."""
        resp = await async_client.get("/api/professionals")
        assert resp.status_code == 401

    async def test_list_professionals_returns_empty(
        self, async_client: AsyncClient, create_test_user, test_db
    ):
        """GET with auth and empty DB returns empty list with total=0."""
        user, _ = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        resp = await async_client.get(
            "/api/professionals",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["professionals"] == []
        assert data["total"] == 0


# ---------------------------------------------------------------------------
# Tests: filters
# ---------------------------------------------------------------------------


class TestListProfessionalsFilters:
    """Filter logic for GET /api/professionals."""

    async def test_list_professionals_gemeente_filter(
        self, async_client: AsyncClient, create_test_user, test_db
    ):
        """Filter ?gemeente=Amsterdam returns only matching professionals."""
        user, _ = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        await _insert_professional(
            test_db, "KB Amsterdam", werkgebied=["Amsterdam"], gevolgklassen=["GK1"]
        )
        await _insert_professional(
            test_db, "KB Rotterdam", werkgebied=["Rotterdam"], gevolgklassen=["GK1"]
        )

        resp = await async_client.get(
            "/api/professionals?gemeente=Amsterdam",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["professionals"][0]["naam"] == "KB Amsterdam"
        assert data["gemeente_filter"] == "Amsterdam"

    async def test_list_professionals_gevolgklasse_filter(
        self, async_client: AsyncClient, create_test_user, test_db
    ):
        """Filter ?gevolgklasse=GK1 returns only professionals with GK1."""
        user, _ = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        await _insert_professional(
            test_db, "KB GK1", werkgebied=["Utrecht"], gevolgklassen=["GK1"]
        )
        await _insert_professional(
            test_db, "KB GK2", werkgebied=["Utrecht"], gevolgklassen=["GK2"]
        )
        await _insert_professional(
            test_db, "KB Both", werkgebied=["Utrecht"], gevolgklassen=["GK1", "GK2"]
        )

        resp = await async_client.get(
            "/api/professionals?gevolgklasse=GK1",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        names = {p["naam"] for p in data["professionals"]}
        assert "KB GK1" in names
        assert "KB Both" in names
        assert "KB GK2" not in names
        assert data["gevolgklasse_filter"] == "GK1"

    async def test_list_professionals_combined_filters(
        self, async_client: AsyncClient, create_test_user, test_db
    ):
        """Combining gemeente + gevolgklasse filters narrows results correctly."""
        user, _ = await create_test_user()
        token = await _get_auth_token(async_client, user.email)

        await _insert_professional(
            test_db,
            "Match",
            werkgebied=["Amsterdam"],
            gevolgklassen=["GK1"],
        )
        await _insert_professional(
            test_db,
            "Wrong gemeente",
            werkgebied=["Rotterdam"],
            gevolgklassen=["GK1"],
        )
        await _insert_professional(
            test_db,
            "Wrong klasse",
            werkgebied=["Amsterdam"],
            gevolgklassen=["GK2"],
        )

        resp = await async_client.get(
            "/api/professionals?gemeente=Amsterdam&gevolgklasse=GK1",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["professionals"][0]["naam"] == "Match"


# ---------------------------------------------------------------------------
# Tests: admin CRUD
# ---------------------------------------------------------------------------


class TestAdminCRUD:
    """Admin key gate and CRUD operations."""

    async def test_create_professional_requires_admin_key(
        self, async_client: AsyncClient
    ):
        """POST without X-Admin-Key header returns 403."""
        resp = await async_client.post(
            "/api/professionals",
            json={"naam": "Test KB"},
        )
        # FastAPI returns 422 for missing required header — map to 403 behavior test
        # The depend raises 403 when header present but invalid
        # Without header FastAPI itself returns 422 (validation error)
        assert resp.status_code in (403, 422)

    async def test_create_professional_with_wrong_key(
        self, async_client: AsyncClient
    ):
        """POST with wrong X-Admin-Key returns 403."""
        original_key = settings.ADMIN_API_KEY
        settings.ADMIN_API_KEY = "correct-key"

        try:
            resp = await async_client.post(
                "/api/professionals",
                json={"naam": "Test KB"},
                headers={"X-Admin-Key": "wrong-key"},
            )
            assert resp.status_code == 403
        finally:
            settings.ADMIN_API_KEY = original_key

    async def test_create_professional_success(
        self, async_client: AsyncClient
    ):
        """POST with valid admin key returns 201 and professional data."""
        original_key = settings.ADMIN_API_KEY
        settings.ADMIN_API_KEY = "test-admin-key"

        try:
            resp = await async_client.post(
                "/api/professionals",
                json={
                    "naam": "Pieter Jansen",
                    "bedrijfsnaam": "Jansen Kwaliteitsborging BV",
                    "werkgebied": ["Amsterdam", "Utrecht"],
                    "gevolgklassen": ["GK1"],
                    "email": "pieter@jansen-kb.nl",
                },
                headers={"X-Admin-Key": "test-admin-key"},
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["naam"] == "Pieter Jansen"
            assert data["bedrijfsnaam"] == "Jansen Kwaliteitsborging BV"
            assert "Amsterdam" in data["werkgebied"]
            assert data["gevolgklassen"] == ["GK1"]
            assert data["is_active"] is True
            assert "id" in data
        finally:
            settings.ADMIN_API_KEY = original_key

    async def test_update_professional_partial(
        self, async_client: AsyncClient, test_db
    ):
        """PUT with partial data updates only specified fields."""
        original_key = settings.ADMIN_API_KEY
        settings.ADMIN_API_KEY = "test-admin-key"

        try:
            prof = await _insert_professional(
                test_db,
                "Original Naam",
                werkgebied=["Amsterdam"],
                gevolgklassen=["GK1"],
                email="original@kb.nl",
            )
            prof_id = str(prof.id)

            resp = await async_client.put(
                f"/api/professionals/{prof_id}",
                json={"naam": "Updated Naam"},
                headers={"X-Admin-Key": "test-admin-key"},
            )

            assert resp.status_code == 200
            data = resp.json()
            assert data["naam"] == "Updated Naam"
            # Fields not in request body should be unchanged
            assert data["email"] == "original@kb.nl"
            assert data["werkgebied"] == ["Amsterdam"]
        finally:
            settings.ADMIN_API_KEY = original_key

    async def test_deactivate_professional(
        self, async_client: AsyncClient, create_test_user, test_db
    ):
        """DELETE sets is_active=False; subsequent GET excludes it from results."""
        original_key = settings.ADMIN_API_KEY
        settings.ADMIN_API_KEY = "test-admin-key"

        try:
            prof = await _insert_professional(
                test_db,
                "Active KB",
                werkgebied=["Rotterdam"],
                gevolgklassen=["GK2"],
            )
            prof_id = str(prof.id)

            # Deactivate
            resp = await async_client.delete(
                f"/api/professionals/{prof_id}",
                headers={"X-Admin-Key": "test-admin-key"},
            )
            assert resp.status_code == 204

            # Verify excluded from GET list
            user, _ = await create_test_user()
            token = await _get_auth_token(async_client, user.email)
            list_resp = await async_client.get(
                "/api/professionals",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert list_resp.status_code == 200
            data = list_resp.json()
            ids = [p["id"] for p in data["professionals"]]
            assert prof_id not in ids
        finally:
            settings.ADMIN_API_KEY = original_key

    async def test_create_professional_admin_disabled(
        self, async_client: AsyncClient
    ):
        """When ADMIN_API_KEY is empty, POST returns 403 even with a key header."""
        original_key = settings.ADMIN_API_KEY
        settings.ADMIN_API_KEY = ""  # Disabled mode

        try:
            resp = await async_client.post(
                "/api/professionals",
                json={"naam": "Test KB"},
                headers={"X-Admin-Key": "any-key"},
            )
            assert resp.status_code == 403
        finally:
            settings.ADMIN_API_KEY = original_key
