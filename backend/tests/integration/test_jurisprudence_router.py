"""Integration tests for jurisprudence router HTTP endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.main import app

# Set mock app state before tests
app.state.http_client = AsyncMock()
app.state.arq_pool = AsyncMock()

_SVC = "app.api.endpoints.jurisprudence"


async def _get_auth_token(client: AsyncClient, email: str, password: str = "TestPass123!") -> str:
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# GET /api/jurisprudence/search
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/jurisprudence/search?q=omgevingsvergunning")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_search_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="jur_search@example.com")
    token = await _get_auth_token(async_client, "jur_search@example.com")

    mock_results = [{"ecli": "ECLI:NL:RVS:2024:1234", "title": "Test ruling"}]

    with patch(f"{_SVC}.rechtspraak_client.search_jurisprudence", new_callable=AsyncMock, return_value=mock_results):
        response = await async_client.get(
            "/api/jurisprudence/search?q=omgevingsvergunning",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["results"]) == 1


@pytest.mark.asyncio
async def test_search_upstream_error(async_client: AsyncClient, create_test_user):
    from app.government_apis.base import GovernmentAPIError

    user, org = await create_test_user(email="jur_search_err@example.com")
    token = await _get_auth_token(async_client, "jur_search_err@example.com")

    with patch(
        f"{_SVC}.rechtspraak_client.search_jurisprudence",
        new_callable=AsyncMock,
        side_effect=GovernmentAPIError("Rechtspraak", "Service unavailable"),
    ):
        response = await async_client.get(
            "/api/jurisprudence/search?q=test",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 502


# ---------------------------------------------------------------------------
# GET /api/jurisprudence/rulings/{gemeente_naam}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rulings_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/jurisprudence/rulings/Amsterdam")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_rulings_unknown_gemeente(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="jur_rul_404@example.com")
    token = await _get_auth_token(async_client, "jur_rul_404@example.com")

    with patch(f"{_SVC}.get_court_codes_for_gemeente", return_value=[]):
        response = await async_client.get(
            "/api/jurisprudence/rulings/Nonexistent",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_rulings_success_empty(async_client: AsyncClient, create_test_user):
    """Known gemeente but no cached rulings — returns pending status."""
    user, org = await create_test_user(email="jur_rul_ok@example.com")
    token = await _get_auth_token(async_client, "jur_rul_ok@example.com")

    mock_arq = AsyncMock()
    app.state.arq_pool = mock_arq

    with (
        patch(f"{_SVC}.get_court_codes_for_gemeente", return_value=["RBAMS"]),
        patch(f"{_SVC}.get_doorlooptijd_stats", new_callable=AsyncMock, return_value={"stats": []}),
    ):
        response = await async_client.get(
            "/api/jurisprudence/rulings/Amsterdam",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["ingestion_status"] == "pending"
    assert data["count"] == 0


# ---------------------------------------------------------------------------
# GET /api/jurisprudence/doc/{ecli}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_doc_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/jurisprudence/doc/ECLI:NL:RVS:2024:1234")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_doc_invalid_ecli(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="jur_doc_bad@example.com")
    token = await _get_auth_token(async_client, "jur_doc_bad@example.com")

    with patch(f"{_SVC}.validate_ecli", return_value=False):
        response = await async_client.get(
            "/api/jurisprudence/doc/INVALID",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_doc_not_found(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="jur_doc_nf@example.com")
    token = await _get_auth_token(async_client, "jur_doc_nf@example.com")

    with (
        patch(f"{_SVC}.validate_ecli", return_value=True),
        patch(f"{_SVC}.rechtspraak_client.get_jurisprudence_document", new_callable=AsyncMock, return_value=None),
    ):
        response = await async_client.get(
            "/api/jurisprudence/doc/ECLI:NL:RVS:2024:9999",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_doc_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="jur_doc_ok@example.com")
    token = await _get_auth_token(async_client, "jur_doc_ok@example.com")

    mock_doc = {"ecli": "ECLI:NL:RVS:2024:1234", "title": "Test ruling", "content": "Full text..."}

    with (
        patch(f"{_SVC}.validate_ecli", return_value=True),
        patch(f"{_SVC}.rechtspraak_client.get_jurisprudence_document", new_callable=AsyncMock, return_value=mock_doc),
    ):
        response = await async_client.get(
            "/api/jurisprudence/doc/ECLI:NL:RVS:2024:1234",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["document"]["ecli"] == "ECLI:NL:RVS:2024:1234"


# ---------------------------------------------------------------------------
# POST /api/jurisprudence/analyze/{gemeente_naam}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_analyze_unauthenticated(async_client: AsyncClient):
    response = await async_client.post("/api/jurisprudence/analyze/Amsterdam")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_analyze_no_rulings(async_client: AsyncClient, create_test_user):
    """Empty DB returns 404 (no rulings found)."""
    user, org = await create_test_user(email="jur_ana_404@example.com")
    token = await _get_auth_token(async_client, "jur_ana_404@example.com")

    response = await async_client.post(
        "/api/jurisprudence/analyze/Nonexistent",
        headers={"Authorization": f"Bearer {token}"},
    )

    # The endpoint queries DB directly — with empty test DB it returns 404
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/jurisprudence/analyze/status/{gemeente_naam}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_analyze_status_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/jurisprudence/analyze/status/Amsterdam")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_analyze_status_not_found(async_client: AsyncClient, create_test_user):
    """Empty DB returns not_found status (not HTTP 404)."""
    user, org = await create_test_user(email="jur_stat_nf@example.com")
    token = await _get_auth_token(async_client, "jur_stat_nf@example.com")

    response = await async_client.get(
        "/api/jurisprudence/analyze/status/Nonexistent",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "not_found"


# ---------------------------------------------------------------------------
# GET /api/jurisprudence/doorlooptijd/{gemeente_naam}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_doorlooptijd_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/jurisprudence/doorlooptijd/Amsterdam")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_doorlooptijd_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="jur_dl@example.com")
    token = await _get_auth_token(async_client, "jur_dl@example.com")

    mock_stats = {"gemeente_naam": "Amsterdam", "stats": [], "total_count": 0, "overall_avg_dagen": None}

    with patch(f"{_SVC}.get_doorlooptijd_stats", new_callable=AsyncMock, return_value=mock_stats):
        response = await async_client.get(
            "/api/jurisprudence/doorlooptijd/Amsterdam",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"


# ---------------------------------------------------------------------------
# GET /api/jurisprudence/explorer
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_explorer_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/jurisprudence/explorer")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_explorer_success(async_client: AsyncClient, create_test_user):
    """Explorer on empty DB returns empty results with facets."""
    user, org = await create_test_user(email="jur_exp@example.com")
    token = await _get_auth_token(async_client, "jur_exp@example.com")

    response = await async_client.get(
        "/api/jurisprudence/explorer",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert "total_count" in data
    assert "facets" in data
    assert data["total_count"] == 0


# ---------------------------------------------------------------------------
# GET /api/jurisprudence/trend/{gemeente_naam}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trend_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/jurisprudence/trend/Amsterdam")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_trend_success_empty(async_client: AsyncClient, create_test_user):
    """Trend on empty DB returns empty months and zero summary."""
    user, org = await create_test_user(email="jur_trend@example.com")
    token = await _get_auth_token(async_client, "jur_trend@example.com")

    response = await async_client.get(
        "/api/jurisprudence/trend/Amsterdam",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["gemeente_naam"] == "Amsterdam"
    assert "months" in data
    assert "summary" in data
    assert data["summary"]["total_rulings"] == 0
