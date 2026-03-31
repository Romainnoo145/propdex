"""Unit tests for the PARCEL_SEARCH handler with count-first and refinement.

Tests handle_parcel_search() with mocked DB queries.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.chat_service import _build_suggestions, handle_parcel_search
from app.agents.schemas import ParsedQuery

# ── Fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def mock_db():
    """Create a mock AsyncSession."""
    db = AsyncMock()
    return db


# ── _build_suggestions ──────────────────────────────────────────────────

class TestBuildSuggestionsForSearch:
    def test_missing_all_filters(self):
        parsed = ParsedQuery()
        suggestions = _build_suggestions(parsed)
        assert len(suggestions) <= 3
        assert any("gemeente" in s.lower() for s in suggestions)
        assert any("bouwjaar" in s.lower() for s in suggestions)

    def test_has_municipality_only(self):
        parsed = ParsedQuery(municipality="Venlo")
        suggestions = _build_suggestions(parsed)
        assert not any("gemeente" in s.lower() for s in suggestions)
        assert any("bouwjaar" in s.lower() for s in suggestions)

    def test_has_build_year(self):
        parsed = ParsedQuery(municipality="Venlo", build_year_max=1970)
        suggestions = _build_suggestions(parsed)
        assert not any("bouwjaar" in s.lower() for s in suggestions)

    def test_fully_filtered_offers_escape_hatch(self):
        parsed = ParsedQuery(
            municipality="Venlo",
            wijk="Blerick",
            build_year_max=1970,
            area_min=100,
            bestemming="wonen",
        )
        suggestions = _build_suggestions(parsed)
        assert any("toon resultaten" in s.lower() for s in suggestions)


# ── handle_parcel_search — count-first ───────────────────────────────────

@pytest.mark.asyncio
async def test_count_first_triggers_when_above_threshold(mock_db):
    """When count > COUNT_THRESHOLD, return COUNT_PREVIEW instead of results."""
    # Mock resolve_gemeente_code
    with patch("app.agents.chat_service.resolve_gemeente_code", new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = "GM0983"

        # Mock _build_count_query to return a count > threshold
        with patch("app.agents.chat_service._build_count_query", new_callable=AsyncMock) as mock_count:
            count_result = MagicMock()
            count_result.scalar_one.return_value = 5000
            mock_db.execute = AsyncMock(return_value=count_result)

            # Build a fake count query select
            from sqlalchemy import func, select
            fake_count_q = select(func.count())
            mock_count.return_value = (fake_count_q, None, 1)

            response = await handle_parcel_search(
                {"municipality": "Venlo"},
                mock_db,
                "00000000-0000-0000-0000-000000000001",
                force_results=False,
            )

    assert response.intent == "COUNT_PREVIEW"
    assert response.count == 5000
    assert response.suggestions is not None
    assert len(response.suggestions) > 0


@pytest.mark.asyncio
async def test_count_first_returns_results_when_below_threshold(mock_db):
    """When count <= COUNT_THRESHOLD, execute full query and return results."""
    with patch("app.agents.chat_service.resolve_gemeente_code", new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = "GM0983"

        with patch("app.agents.chat_service._build_count_query", new_callable=AsyncMock) as mock_count:
            count_result = MagicMock()
            count_result.scalar_one.return_value = 150
            mock_db.execute = AsyncMock(return_value=count_result)
            mock_count.return_value = (MagicMock(), None, 1)

            with patch("app.agents.chat_service.execute_bulk_query", new_callable=AsyncMock) as mock_exec:
                from app.agents.schemas import BulkResult
                mock_exec.return_value = (
                    [BulkResult(parcel_id="TEST-001", address="Teststraat 1")],
                    150,
                )

                response = await handle_parcel_search(
                    {"municipality": "Venlo"},
                    mock_db,
                    "00000000-0000-0000-0000-000000000001",
                    force_results=False,
                )

    assert response.intent == "PARCEL_SEARCH"
    assert response.count == 150
    assert response.data is not None
    assert len(response.data) == 1


@pytest.mark.asyncio
async def test_force_results_skips_threshold(mock_db):
    """When force_results=True, skip the count check and return results."""
    with patch("app.agents.chat_service.resolve_gemeente_code", new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = "GM0983"

        with patch("app.agents.chat_service._build_count_query", new_callable=AsyncMock) as mock_count:
            count_result = MagicMock()
            count_result.scalar_one.return_value = 5000  # above threshold
            mock_db.execute = AsyncMock(return_value=count_result)
            mock_count.return_value = (MagicMock(), None, 1)

            with patch("app.agents.chat_service.execute_bulk_query", new_callable=AsyncMock) as mock_exec:
                from app.agents.schemas import BulkResult
                mock_exec.return_value = (
                    [BulkResult(parcel_id="TEST-002", address="Teststraat 2")],
                    5000,
                )

                response = await handle_parcel_search(
                    {"municipality": "Venlo"},
                    mock_db,
                    "00000000-0000-0000-0000-000000000001",
                    force_results=True,
                )

    assert response.intent == "PARCEL_SEARCH"
    assert response.count == 5000


@pytest.mark.asyncio
async def test_empty_params_returns_unsupported(mock_db):
    """No filter params → UNSUPPORTED response."""
    response = await handle_parcel_search({}, mock_db, "00000000-0000-0000-0000-000000000001")
    assert response.intent == "UNSUPPORTED"
    assert "filter" in response.message.lower()


@pytest.mark.asyncio
async def test_unknown_gemeente_returns_unsupported(mock_db):
    """Gemeente not found in DB → informative UNSUPPORTED."""
    with patch("app.agents.chat_service.resolve_gemeente_code", new_callable=AsyncMock) as mock_resolve:
        mock_resolve.return_value = None

        response = await handle_parcel_search(
            {"municipality": "Nergensdorp"},
            mock_db,
            "00000000-0000-0000-0000-000000000001",
        )

    assert response.intent == "UNSUPPORTED"
    assert "Nergensdorp" in response.message


# ── Refinement param merging ─────────────────────────────────────────────

class TestRefinementParamMerging:
    """The classifier does the merging — but verify that the handler correctly
    builds a ParsedQuery from whatever params it receives."""

    @pytest.mark.asyncio
    async def test_combined_params_build_parsed_query(self, mock_db):
        """When classifier returns merged params, handler uses them all."""
        with patch("app.agents.chat_service.resolve_gemeente_code", new_callable=AsyncMock) as mock_resolve:
            mock_resolve.return_value = "GM0983"
            with patch("app.agents.chat_service._build_count_query", new_callable=AsyncMock) as mock_count:
                count_result = MagicMock()
                count_result.scalar_one.return_value = 100
                mock_db.execute = AsyncMock(return_value=count_result)
                mock_count.return_value = (MagicMock(), None, 2)

                with patch("app.agents.chat_service.execute_bulk_query", new_callable=AsyncMock) as mock_exec:
                    mock_exec.return_value = ([], 100)

                    response = await handle_parcel_search(
                        {"municipality": "Venlo", "build_year_max": 1980},
                        mock_db,
                        "00000000-0000-0000-0000-000000000001",
                    )

                    # Verify execute_bulk_query was called with a ParsedQuery
                    # that has both municipality and build_year_max
                    call_args = mock_exec.call_args[0]
                    parsed = call_args[0]
                    assert parsed.municipality == "Venlo"
                    assert parsed.build_year_max == 1980

        assert response.intent == "PARCEL_SEARCH"
