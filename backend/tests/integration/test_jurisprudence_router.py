"""Integration tests for jurisprudence router HTTP endpoints."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.ruling_cache import RulingCache

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


# ---------------------------------------------------------------------------
# RM-1 dev-type filter tests (M046/S01)
# ---------------------------------------------------------------------------
#
# These tests guard the aggregator wire-up in trigger_ruling_analysis and
# poll_ruling_analysis. The endpoints must call
# app.services.ruling_aggregator.aggregate_dev_type_rulings() so that only
# developer-relevant vergunningstypen (nieuwbouw/sloop/bestemmingswijziging/
# uitbreiding) feed the succeskans + juridisch_klimaat_score fields.
#
# Fixture mirrors the canonical unit test fixture in tests/unit/test_ruling_aggregator.py
# (test_aggregate_filters_dev_types_only): 13 rulings = 5 nieuwbouw (3T/2A) +
# 5 dakopbouw (1T/4A) + 2 milieu (0T/2A) + 1 bestemmingswijziging (1T/0A).
# - Dev-filtered: 6 dev-rulings (4T/2A) → succeskans=67, klimaat=67
# - Unfiltered:   13 rulings (5T/8A)    → succeskans=38, klimaat=38
# 29-point delta proves the dev-type filter applied.
# Plan-divergence note: S01-PLAN.md T01.3 originally specified 11 rulings with
# 4 dev-types; below MIN_DEV_RULINGS_FOR_AGGREGATION=5 that yields missing=True
# not succeskans=75. Unit test was corrected during T02 GREEN; integration test
# now mirrors that canonical fixture.


def _make_ruling(
    ecli: str,
    gemeente: str,
    uitkomst: str,
    vergunningstype: str | None,
    *,
    include_vergunningstype_in_jsonb: bool = True,
) -> RulingCache:
    """Seed helper — builds one RulingCache row with ai_analysis populated.

    When include_vergunningstype_in_jsonb=False the ai_analysis JSONB dict
    will NOT contain a 'vergunningstype' key, simulating pre-Phase-84 records
    (see Preflight section of S01-PLAN.md for rationale).
    """
    ai_analysis: dict = {"uitkomst": uitkomst}
    if include_vergunningstype_in_jsonb and vergunningstype is not None:
        ai_analysis["vergunningstype"] = vergunningstype
    return RulingCache(
        ecli=ecli,
        court_code="RBAMS",
        gemeente_query=gemeente,
        fetched_at=datetime.utcnow(),
        ai_analysis=ai_analysis,
        vergunningstype=vergunningstype,
        uitkomst=uitkomst,
        full_text="sample full text",
    )


async def _seed_canonical_mixed_rulings(db: AsyncSession, gemeente: str) -> None:
    """Seed the canonical 13-ruling mixed fixture (matches unit test fixture).

    5 nieuwbouw (3T/2A) + 5 dakopbouw (1T/4A) + 2 milieu (0T/2A) + 1 bestemmingswijziging (1T/0A)
    → dev-filtered: 4T/6 dev-rulings = 67; unfiltered: 5T/13 = 38.
    """
    rulings = [
        # 5 nieuwbouw: 3 toegewezen, 2 afgewezen
        _make_ruling("ECLI:NL:TEST:2024:N1", gemeente, "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:N2", gemeente, "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:N3", gemeente, "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:N4", gemeente, "afgewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:N5", gemeente, "afgewezen", "nieuwbouw"),
        # 5 dakopbouw: 1 toegewezen, 4 afgewezen
        _make_ruling("ECLI:NL:TEST:2024:D1", gemeente, "toegewezen", "dakopbouw"),
        _make_ruling("ECLI:NL:TEST:2024:D2", gemeente, "afgewezen", "dakopbouw"),
        _make_ruling("ECLI:NL:TEST:2024:D3", gemeente, "afgewezen", "dakopbouw"),
        _make_ruling("ECLI:NL:TEST:2024:D4", gemeente, "afgewezen", "dakopbouw"),
        _make_ruling("ECLI:NL:TEST:2024:D5", gemeente, "afgewezen", "dakopbouw"),
        # 2 milieu: 0 toegewezen, 2 afgewezen
        _make_ruling("ECLI:NL:TEST:2024:M1", gemeente, "afgewezen", "milieu"),
        _make_ruling("ECLI:NL:TEST:2024:M2", gemeente, "afgewezen", "milieu"),
        # 1 bestemmingswijziging: 1 toegewezen
        _make_ruling("ECLI:NL:TEST:2024:B1", gemeente, "toegewezen", "bestemmingswijziging"),
    ]
    for r in rulings:
        db.add(r)
    await db.commit()


@pytest.mark.asyncio
async def test_analyze_trigger_uses_dev_type_filter(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """POST /api/jurisprudence/analyze/{gemeente} must dev-filter the aggregation.

    On the canonical 13-ruling fixture, unfiltered succeskans=38 (5/13) but
    dev-filtered succeskans=67 (4/6). Test asserts the dev-filtered value —
    RED until T04 wires aggregate_dev_type_rulings().
    """
    await create_test_user(email="jur_rm1_trig@example.com")
    token = await _get_auth_token(async_client, "jur_rm1_trig@example.com")
    await _seed_canonical_mixed_rulings(test_db, "TestDorp")

    response = await async_client.post(
        "/api/jurisprudence/analyze/TestDorp",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["vergunnings_succeskans"] == 67, (
        f"Expected dev-filtered succeskans=67, got {data['vergunnings_succeskans']}. "
        "If this is 38, the unfiltered aggregation is still in place."
    )
    assert data["juridisch_klimaat_score"] == 67, (
        f"Expected dev-filtered klimaat=67, got {data['juridisch_klimaat_score']}."
    )
    # analyzed_count counts ALL analyzed rulings; aggregation uses only dev-subset
    assert data["analyzed_count"] == 13
    assert data["dev_type_ruling_count"] == 6
    assert data["total_ruling_count"] == 13
    assert data["succeskans_missing"] is False


@pytest.mark.asyncio
async def test_analyze_status_poll_uses_dev_type_filter(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """GET /api/jurisprudence/analyze/status/{gemeente} must dev-filter too.

    Poll endpoint mirrors trigger's aggregation — both sites call the same
    aggregator helper. Same fixture as trigger test, same expected outputs.
    """
    await create_test_user(email="jur_rm1_poll@example.com")
    token = await _get_auth_token(async_client, "jur_rm1_poll@example.com")
    await _seed_canonical_mixed_rulings(test_db, "TestDorp")

    response = await async_client.get(
        "/api/jurisprudence/analyze/status/TestDorp",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["vergunnings_succeskans"] == 67
    assert data["juridisch_klimaat_score"] == 67
    assert data["dev_type_ruling_count"] == 6
    assert data["total_ruling_count"] == 13
    assert data["succeskans_missing"] is False


@pytest.mark.asyncio
async def test_analyze_trigger_returns_missing_when_too_few_dev_types(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """Below-threshold dev-type count → missing=True, succeskans=None.

    Fixture: 2 nieuwbouw + 8 dakopbouw. Dev count = 2, below threshold of 5.
    Aggregator must return missing=True; the response schema carries None
    scores plus the succeskans_missing/succeskans_reason signal fields.
    """
    await create_test_user(email="jur_rm1_missing@example.com")
    token = await _get_auth_token(async_client, "jur_rm1_missing@example.com")

    rulings = [
        _make_ruling("ECLI:NL:TEST:2024:S1", "SparseDorp", "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:S2", "SparseDorp", "toegewezen", "nieuwbouw"),
    ] + [
        _make_ruling(f"ECLI:NL:TEST:2024:SD{i}", "SparseDorp", "afgewezen", "dakopbouw")
        for i in range(1, 9)
    ]
    for r in rulings:
        test_db.add(r)
    await test_db.commit()

    response = await async_client.post(
        "/api/jurisprudence/analyze/SparseDorp",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["succeskans_missing"] is True
    assert data["succeskans_reason"] == "insufficient_dev_type_rulings"
    assert data["vergunnings_succeskans"] is None
    assert data["juridisch_klimaat_score"] is None
    assert data["dev_type_ruling_count"] == 2
    assert data["total_ruling_count"] == 10


@pytest.mark.asyncio
async def test_analyze_trigger_backward_compat_for_empty_vergunningstype(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    """Pre-Phase-84 rulings without 'vergunningstype' key must not crash.

    Fixture: 3 rulings with classified nieuwbouw + 3 legacy rulings whose
    ai_analysis JSONB lacks the 'vergunningstype' key (simulates pre-migration
    records from before 2026-03-08). Aggregator must silently skip legacy
    rows (NULL/missing key = niet geclassificeerd, not 'overig'). With only
    3 dev-rulings surviving the filter, result is missing=True (below threshold).
    """
    await create_test_user(email="jur_rm1_legacy@example.com")
    token = await _get_auth_token(async_client, "jur_rm1_legacy@example.com")

    rulings = [
        _make_ruling("ECLI:NL:TEST:2024:L1", "LegacyDorp", "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:L2", "LegacyDorp", "toegewezen", "nieuwbouw"),
        _make_ruling("ECLI:NL:TEST:2024:L3", "LegacyDorp", "toegewezen", "nieuwbouw"),
        # 3 legacy rulings — ai_analysis JSONB WITHOUT 'vergunningstype' key
        _make_ruling(
            "ECLI:NL:TEST:2024:L4", "LegacyDorp", "toegewezen", None,
            include_vergunningstype_in_jsonb=False,
        ),
        _make_ruling(
            "ECLI:NL:TEST:2024:L5", "LegacyDorp", "afgewezen", None,
            include_vergunningstype_in_jsonb=False,
        ),
        _make_ruling(
            "ECLI:NL:TEST:2024:L6", "LegacyDorp", "afgewezen", None,
            include_vergunningstype_in_jsonb=False,
        ),
    ]
    for r in rulings:
        test_db.add(r)
    await test_db.commit()

    response = await async_client.post(
        "/api/jurisprudence/analyze/LegacyDorp",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["succeskans_missing"] is True
    assert data["dev_type_ruling_count"] == 3
    assert data["total_ruling_count"] == 6
    assert data["vergunnings_succeskans"] is None
