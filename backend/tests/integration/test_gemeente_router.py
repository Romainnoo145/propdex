"""Integration tests for gemeente router HTTP endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.main import app

# Set mock app state before tests
app.state.http_client = AsyncMock()
app.state.arq_pool = None

_SVC_PREFIX = "app.api.endpoints.gemeente"


async def _get_auth_token(client: AsyncClient, email: str, password: str = "TestPass123!") -> str:
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# GET /api/gemeente/subsidies/development
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_subsidies_development_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/gemeente/subsidies/development")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_subsidies_development_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="gem_sub@example.com")
    token = await _get_auth_token(async_client, "gem_sub@example.com")

    mock_subsidie = AsyncMock()
    mock_subsidie.id = "SUB001"
    mock_subsidie.title = "Verduurzaming woningen"
    mock_subsidie.intro = "Subsidie voor verduurzaming"
    mock_subsidie.url = "https://rvo.nl/sub001"
    mock_subsidie.sectors = ["Bouw"]
    mock_subsidie.targets = ["Woningeigenaren"]

    with patch(f"{_SVC_PREFIX}.fetch_development_subsidies", new_callable=AsyncMock, return_value=[mock_subsidie]):
        response = await async_client.get(
            "/api/gemeente/subsidies/development",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["source"] == "RVO"
    assert data["subsidies"][0]["title"] == "Verduurzaming woningen"


# ---------------------------------------------------------------------------
# GET /api/gemeente/checklists/{use_case}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_checklist_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/gemeente/checklists/optoppen")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_checklist_known_use_case(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="gem_ckl@example.com")
    token = await _get_auth_token(async_client, "gem_ckl@example.com")

    response = await async_client.get(
        "/api/gemeente/checklists/optoppen",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["use_case"] == "optoppen"
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_checklist_unknown_use_case(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="gem_ckl_unk@example.com")
    token = await _get_auth_token(async_client, "gem_ckl_unk@example.com")

    response = await async_client.get(
        "/api/gemeente/checklists/nonexistent",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["use_case"] == "nonexistent"
    assert data["items"] == []
    assert "error" in data


# ---------------------------------------------------------------------------
# GET /api/gemeente/{naam}/profile
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_profile_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/gemeente/Amsterdam/profile")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_profile_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="gem_prof@example.com")
    token = await _get_auth_token(async_client, "gem_prof@example.com")

    mock_profile = {
        "gemeente_naam": "Amsterdam",
        "severity_label": "Gemiddeld",
        "approval_rate_pct": 75.0,
        "rejection_rate_pct": 10.0,
        "avg_doorlooptijd_days": None,
        "bekendmakingen_30d": 0,
        "bekendmakingen_90d": 0,
        "permit_decisions": [],
        "bekendmakingen_trend": [],
    }

    with patch(f"{_SVC_PREFIX}.build_gemeente_profile", new_callable=AsyncMock, return_value=mock_profile):
        response = await async_client.get(
            "/api/gemeente/Amsterdam/profile",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["gemeente_naam"] == "Amsterdam"


# ---------------------------------------------------------------------------
# GET /api/gemeente/{naam}/raadsinformatie
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_raadsinformatie_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/gemeente/Amsterdam/raadsinformatie")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_raadsinformatie_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="gem_raad@example.com")
    token = await _get_auth_token(async_client, "gem_raad@example.com")

    mock_result = {"gemeente_naam": "Amsterdam", "dekking": True, "stukken": [], "total_found": 0}

    with patch(f"{_SVC_PREFIX}.get_raadsinformatie", new_callable=AsyncMock, return_value=mock_result):
        response = await async_client.get(
            "/api/gemeente/Amsterdam/raadsinformatie",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["gemeente_naam"] == "Amsterdam"


# ---------------------------------------------------------------------------
# GET /api/gemeente/{naam}/huisvestingsverordening
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_huisvestingsverordening_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/gemeente/Amsterdam/huisvestingsverordening")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_huisvestingsverordening_found(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="gem_huisv@example.com")
    token = await _get_auth_token(async_client, "gem_huisv@example.com")

    mock_result = AsyncMock()
    mock_result.title = "Huisvestingsverordening Amsterdam 2024"
    mock_result.identifier = "gmb-2024-12345"
    mock_result.modified = "2024-01-15"
    mock_result.subject = "Huisvesting"
    mock_result.url = "https://zoek.officielebekendmakingen.nl/gmb-2024-12345"

    with patch(f"{_SVC_PREFIX}.search_huisvestingsverordening", new_callable=AsyncMock, return_value=mock_result):
        response = await async_client.get(
            "/api/gemeente/Amsterdam/huisvestingsverordening",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["heeft_verordening"] is True
    assert data["gemeente_naam"] == "Amsterdam"


@pytest.mark.asyncio
async def test_huisvestingsverordening_not_found(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="gem_huisv_nf@example.com")
    token = await _get_auth_token(async_client, "gem_huisv_nf@example.com")

    with patch(f"{_SVC_PREFIX}.search_huisvestingsverordening", new_callable=AsyncMock, return_value=None):
        response = await async_client.get(
            "/api/gemeente/Schiermonnikoog/huisvestingsverordening",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["heeft_verordening"] is False


# ---------------------------------------------------------------------------
# GET /api/gemeente/{naam}/erfgoed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_erfgoed_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/gemeente/Amsterdam/erfgoed")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_erfgoed_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="gem_erfg@example.com")
    token = await _get_auth_token(async_client, "gem_erfg@example.com")

    mock_gezicht = AsyncMock()
    mock_gezicht.naam = "Grachtengordel"
    mock_gezicht.type = "Beschermd stadsgezicht"
    mock_gezicht.aangewezen = "1999-06-01"
    mock_gezicht.oppervlakte_ha = 220.5

    with patch(f"{_SVC_PREFIX}.get_beschermde_gezichten", new_callable=AsyncMock, return_value=[mock_gezicht]):
        response = await async_client.get(
            "/api/gemeente/Amsterdam/erfgoed",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["gemeente_naam"] == "Amsterdam"
    assert data["total"] == 1
    assert data["beschermde_gezichten"][0]["naam"] == "Grachtengordel"


@pytest.mark.asyncio
async def test_erfgoed_empty(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="gem_erfg_emp@example.com")
    token = await _get_auth_token(async_client, "gem_erfg_emp@example.com")

    with patch(f"{_SVC_PREFIX}.get_beschermde_gezichten", new_callable=AsyncMock, return_value=[]):
        response = await async_client.get(
            "/api/gemeente/Almere/erfgoed",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["beschermde_gezichten"] == []
