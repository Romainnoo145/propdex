"""Tests for monument aggregator helper functions and multi-source consensus."""

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.schemas.monument import MonumentSourceResult, MonumentStatus
from app.services.monument_aggregator import (
    _fetch_bag_monument,
    _fetch_kadaster_monument,
    fetch_monument_status,
)


class TestFetchBagMonument:
    """Test BAG monument stub implementation."""

    async def test_none_verblijfsobject_id_returns_error(self):
        """None verblijfsobject_id should return error message."""
        session = AsyncMock()

        result = await _fetch_bag_monument(None, session, False)

        assert result.source == "BAG"
        assert result.error == "Geen verblijfsobject ID beschikbaar"
        assert result.is_monument is None

    async def test_any_verblijfsobject_id_returns_unavailable_error(self):
        """Any verblijfsobject_id returns MVP stub unavailable error."""
        session = AsyncMock()

        result = await _fetch_bag_monument("0363010000123456", session, False)

        assert result.source == "BAG"
        assert result.error == "Monument status niet beschikbaar via BAG API"
        assert result.is_monument is None

    async def test_source_is_always_bag(self):
        """Source field should always be 'BAG'."""
        session = AsyncMock()

        result = await _fetch_bag_monument("0363010000123456", session, False)

        assert result.source == "BAG"


class TestFetchKadasterMonument:
    """Test Kadaster monument stub implementation."""

    async def test_always_returns_unavailable_error(self):
        """Should always return MVP stub unavailable error."""
        session = AsyncMock()

        result = await _fetch_kadaster_monument(session, False)

        assert result.source == "Kadaster"
        assert result.error == "Monument status niet beschikbaar via Kadaster API"
        assert result.is_monument is None

    async def test_source_is_always_kadaster(self):
        """Source field should always be 'Kadaster'."""
        session = AsyncMock()

        result = await _fetch_kadaster_monument(session, False)

        assert result.source == "Kadaster"


class TestFetchMonumentStatus:
    """Test multi-source monument aggregation with conflict detection."""

    @pytest.fixture
    def test_session(self):
        """Test async session."""
        return AsyncMock()

    @pytest.fixture
    def test_client(self):
        """Test httpx client."""
        return AsyncMock(spec=httpx.AsyncClient)

    async def test_rce_rijksmonument_bag_kadaster_unavailable(
        self, test_session, test_client
    ):
        """RCE says rijksmonument, BAG/Kadaster unavailable: consensus rijksmonument."""
        rce_result = MonumentSourceResult(
            source="RCE",
            is_monument=True,
            monument_type="rijksmonument",
            monument_nummer="123456",
            monument_naam="Historisch Pand",
        )
        bag_result = MonumentSourceResult(
            source="BAG", error="Monument status niet beschikbaar via BAG API"
        )
        kadaster_result = MonumentSourceResult(
            source="Kadaster", error="Monument status niet beschikbaar via Kadaster API"
        )

        with patch("app.services.monument_aggregator._fetch_rce") as mock_rce, patch(
            "app.services.monument_aggregator._fetch_bag_monument"
        ) as mock_bag, patch(
            "app.services.monument_aggregator._fetch_kadaster_monument"
        ) as mock_kadaster:
            mock_rce.return_value = rce_result
            mock_bag.return_value = bag_result
            mock_kadaster.return_value = kadaster_result

            result = await fetch_monument_status(
                121687.0, 487484.0, None, None, test_client, test_session, False
            )

        assert result.consensus_status == "rijksmonument"
        assert result.is_monument is True
        assert result.has_conflict is False
        assert len(result.restrictions_summary) == 4  # Rijksmonument has 4 items
        assert "omgevingsvergunning" in result.restrictions_summary[0].lower()

    async def test_rce_not_monument_bag_kadaster_unavailable(
        self, test_session, test_client
    ):
        """RCE says not monument, BAG/Kadaster unavailable: consensus geen_monument."""
        rce_result = MonumentSourceResult(source="RCE", is_monument=False)
        bag_result = MonumentSourceResult(
            source="BAG", error="Monument status niet beschikbaar via BAG API"
        )
        kadaster_result = MonumentSourceResult(
            source="Kadaster", error="Monument status niet beschikbaar via Kadaster API"
        )

        with patch("app.services.monument_aggregator._fetch_rce") as mock_rce, patch(
            "app.services.monument_aggregator._fetch_bag_monument"
        ) as mock_bag, patch(
            "app.services.monument_aggregator._fetch_kadaster_monument"
        ) as mock_kadaster:
            mock_rce.return_value = rce_result
            mock_bag.return_value = bag_result
            mock_kadaster.return_value = kadaster_result

            result = await fetch_monument_status(
                121687.0, 487484.0, None, None, test_client, test_session, False
            )

        assert result.consensus_status == "geen_monument"
        assert result.is_monument is False
        assert result.has_conflict is False
        assert len(result.restrictions_summary) == 0  # No restrictions

    async def test_rce_monument_bag_not_monument_conflict(
        self, test_session, test_client
    ):
        """RCE says monument, BAG says not monument: has_conflict=True."""
        rce_result = MonumentSourceResult(
            source="RCE",
            is_monument=True,
            monument_type="rijksmonument",
            monument_nummer="123456",
        )
        bag_result = MonumentSourceResult(source="BAG", is_monument=False)
        kadaster_result = MonumentSourceResult(
            source="Kadaster", error="Monument status niet beschikbaar via Kadaster API"
        )

        with patch("app.services.monument_aggregator._fetch_rce") as mock_rce, patch(
            "app.services.monument_aggregator._fetch_bag_monument"
        ) as mock_bag, patch(
            "app.services.monument_aggregator._fetch_kadaster_monument"
        ) as mock_kadaster:
            mock_rce.return_value = rce_result
            mock_bag.return_value = bag_result
            mock_kadaster.return_value = kadaster_result

            result = await fetch_monument_status(
                121687.0, 487484.0, None, None, test_client, test_session, False
            )

        assert result.has_conflict is True
        assert "niet eens" in result.conflict_note
        assert "1 bronnen zeggen monument" in result.conflict_note
        assert "1 bronnen zeggen geen monument" in result.conflict_note
        assert result.consensus_status is None  # No consensus when conflict
        assert result.is_monument is True  # ANY source says monument

    async def test_all_sources_return_errors(self, test_session, test_client):
        """All sources return errors: has_conflict=False, consensus_status=None."""
        rce_result = MonumentSourceResult(source="RCE", error="RCE API error: timeout")
        bag_result = MonumentSourceResult(
            source="BAG", error="Monument status niet beschikbaar via BAG API"
        )
        kadaster_result = MonumentSourceResult(
            source="Kadaster", error="Monument status niet beschikbaar via Kadaster API"
        )

        with patch("app.services.monument_aggregator._fetch_rce") as mock_rce, patch(
            "app.services.monument_aggregator._fetch_bag_monument"
        ) as mock_bag, patch(
            "app.services.monument_aggregator._fetch_kadaster_monument"
        ) as mock_kadaster:
            mock_rce.return_value = rce_result
            mock_bag.return_value = bag_result
            mock_kadaster.return_value = kadaster_result

            result = await fetch_monument_status(
                121687.0, 487484.0, None, None, test_client, test_session, False
            )

        assert result.has_conflict is False
        assert result.consensus_status is None
        assert result.is_monument is False
        assert len(result.restrictions_summary) == 0

    async def test_rce_raises_exception_converted_to_error(
        self, test_session, test_client
    ):
        """RCE raises exception: return_exceptions=True converts to error MonumentSourceResult."""
        bag_result = MonumentSourceResult(
            source="BAG", error="Monument status niet beschikbaar via BAG API"
        )
        kadaster_result = MonumentSourceResult(
            source="Kadaster", error="Monument status niet beschikbaar via Kadaster API"
        )

        with patch("app.services.monument_aggregator._fetch_rce") as mock_rce, patch(
            "app.services.monument_aggregator._fetch_bag_monument"
        ) as mock_bag, patch(
            "app.services.monument_aggregator._fetch_kadaster_monument"
        ) as mock_kadaster:
            mock_rce.side_effect = ValueError("Unexpected error in RCE fetch")
            mock_bag.return_value = bag_result
            mock_kadaster.return_value = kadaster_result

            result = await fetch_monument_status(
                121687.0, 487484.0, None, None, test_client, test_session, False
            )

        # Exception should be converted to error result
        rce_source = next(s for s in result.sources if s.source == "RCE")
        assert rce_source.error is not None
        assert "Fetch error" in rce_source.error
        assert "Unexpected error in RCE fetch" in rce_source.error

    async def test_gemeentelijk_monument_type(self, test_session, test_client):
        """gemeentelijk_monument type: consensus_status and 3 restriction items."""
        rce_result = MonumentSourceResult(
            source="RCE",
            is_monument=True,
            monument_type="gemeentelijk_monument",
            monument_nummer="G-123",
        )
        bag_result = MonumentSourceResult(
            source="BAG", error="Monument status niet beschikbaar via BAG API"
        )
        kadaster_result = MonumentSourceResult(
            source="Kadaster", error="Monument status niet beschikbaar via Kadaster API"
        )

        with patch("app.services.monument_aggregator._fetch_rce") as mock_rce, patch(
            "app.services.monument_aggregator._fetch_bag_monument"
        ) as mock_bag, patch(
            "app.services.monument_aggregator._fetch_kadaster_monument"
        ) as mock_kadaster:
            mock_rce.return_value = rce_result
            mock_bag.return_value = bag_result
            mock_kadaster.return_value = kadaster_result

            result = await fetch_monument_status(
                121687.0, 487484.0, None, None, test_client, test_session, False
            )

        assert result.consensus_status == "gemeentelijk_monument"
        assert result.is_monument is True
        assert result.has_conflict is False
        assert len(result.restrictions_summary) == 3  # Gemeentelijk has 3 items
        assert "omgevingsvergunning" in result.restrictions_summary[0].lower()

    async def test_multiple_sources_agree_monument(self, test_session, test_client):
        """Multiple sources agreeing on monument status: no conflict."""
        rce_result = MonumentSourceResult(
            source="RCE",
            is_monument=True,
            monument_type="rijksmonument",
            monument_nummer="123456",
        )
        bag_result = MonumentSourceResult(source="BAG", is_monument=True)
        kadaster_result = MonumentSourceResult(source="Kadaster", is_monument=True)

        with patch("app.services.monument_aggregator._fetch_rce") as mock_rce, patch(
            "app.services.monument_aggregator._fetch_bag_monument"
        ) as mock_bag, patch(
            "app.services.monument_aggregator._fetch_kadaster_monument"
        ) as mock_kadaster:
            mock_rce.return_value = rce_result
            mock_bag.return_value = bag_result
            mock_kadaster.return_value = kadaster_result

            result = await fetch_monument_status(
                121687.0, 487484.0, None, None, test_client, test_session, False
            )

        assert result.has_conflict is False
        assert result.consensus_status == "rijksmonument"
        assert result.is_monument is True

    async def test_multiple_sources_agree_not_monument(
        self, test_session, test_client
    ):
        """Multiple sources agreeing on not monument: no conflict."""
        rce_result = MonumentSourceResult(source="RCE", is_monument=False)
        bag_result = MonumentSourceResult(source="BAG", is_monument=False)
        kadaster_result = MonumentSourceResult(source="Kadaster", is_monument=False)

        with patch("app.services.monument_aggregator._fetch_rce") as mock_rce, patch(
            "app.services.monument_aggregator._fetch_bag_monument"
        ) as mock_bag, patch(
            "app.services.monument_aggregator._fetch_kadaster_monument"
        ) as mock_kadaster:
            mock_rce.return_value = rce_result
            mock_bag.return_value = bag_result
            mock_kadaster.return_value = kadaster_result

            result = await fetch_monument_status(
                121687.0, 487484.0, None, None, test_client, test_session, False
            )

        assert result.has_conflict is False
        assert result.consensus_status == "geen_monument"
        assert result.is_monument is False

    async def test_two_sources_disagree_third_has_error(
        self, test_session, test_client
    ):
        """Two sources disagree, third has error: conflict detected."""
        rce_result = MonumentSourceResult(
            source="RCE",
            is_monument=True,
            monument_type="rijksmonument",
        )
        bag_result = MonumentSourceResult(source="BAG", is_monument=False)
        kadaster_result = MonumentSourceResult(
            source="Kadaster", error="Monument status niet beschikbaar via Kadaster API"
        )

        with patch("app.services.monument_aggregator._fetch_rce") as mock_rce, patch(
            "app.services.monument_aggregator._fetch_bag_monument"
        ) as mock_bag, patch(
            "app.services.monument_aggregator._fetch_kadaster_monument"
        ) as mock_kadaster:
            mock_rce.return_value = rce_result
            mock_bag.return_value = bag_result
            mock_kadaster.return_value = kadaster_result

            result = await fetch_monument_status(
                121687.0, 487484.0, None, None, test_client, test_session, False
            )

        assert result.has_conflict is True
        assert result.consensus_status is None
        assert result.is_monument is True  # ANY source says monument
