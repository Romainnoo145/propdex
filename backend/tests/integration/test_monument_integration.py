"""Integration tests for monument aggregator full flow with real database."""

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy import select

from app.models.cached_response import CachedAPIResponse
from app.models.organization import Organization
from app.services.monument_aggregator import fetch_monument_status


@pytest.fixture
async def org_id(test_db):
    """Create a test organization and return its ID."""
    org = Organization(name="Monument Test Org")
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org.id


class TestMonumentFullFlow:
    """Test monument aggregator full pipeline with real database for cache."""

    async def test_rce_monument_found_full_flow(self, test_db, org_id):
        """Monument found in RCE - full flow with cache storage and schema validation."""
        # Mock RCE client response
        rce_response = [
            {
                "rce_objrijksnr": "12345",
                "rce_objnaam": "Historisch Pand",
            }
        ]

        with patch("app.government_apis.rce_monuments._rce_client.query_by_location", new_callable=AsyncMock) as mock_query:
            mock_query.return_value = rce_response

            client = AsyncMock(spec=httpx.AsyncClient)

            result = await fetch_monument_status(
                x=121687.0,
                y=487484.0,
                pand_id=None,
                verblijfsobject_id=None,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

        # Assertions on result
        assert result is not None
        assert result.is_monument is True
        assert result.consensus_status == "rijksmonument"
        assert result.has_conflict is False
        assert len(result.restrictions_summary) == 4  # Standard rijksmonument restrictions
        assert "omgevingsvergunning" in result.restrictions_summary[0]

        # Find RCE source
        rce_source = next((s for s in result.sources if s.source == "RCE"), None)
        assert rce_source is not None
        assert rce_source.is_monument is True
        assert rce_source.monument_nummer == "12345"
        assert rce_source.monument_naam == "Historisch Pand"

        # Direct DB assertion: cache entry exists
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == org_id,
            CachedAPIResponse.source == "rce",
            CachedAPIResponse.cache_key.startswith("rce:monument:"),
        )
        cache_entry = (await test_db.execute(stmt)).scalar_one()
        assert cache_entry is not None
        assert cache_entry.source == "rce"

    async def test_rce_no_monument_full_flow(self, test_db, org_id):
        """No monument found in RCE - consensus is geen_monument."""
        # Mock empty RCE response
        rce_response = []

        with patch("app.government_apis.rce_monuments._rce_client.query_by_location", new_callable=AsyncMock) as mock_query:
            mock_query.return_value = rce_response

            client = AsyncMock(spec=httpx.AsyncClient)

            result = await fetch_monument_status(
                x=121700.0,
                y=487500.0,
                pand_id=None,
                verblijfsobject_id=None,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

        # Assertions
        assert result is not None
        assert result.is_monument is False
        assert result.consensus_status == "geen_monument"
        assert result.has_conflict is False
        assert len(result.restrictions_summary) == 0

        # RCE source should indicate no monument
        rce_source = next((s for s in result.sources if s.source == "RCE"), None)
        assert rce_source is not None
        assert rce_source.is_monument is False
        assert rce_source.error is None

    async def test_rce_cache_hit(self, test_db, org_id):
        """Second call with same coordinates hits cache and skips API."""
        rce_response = [
            {
                "rce_objrijksnr": "67890",
                "rce_objnaam": "Cached Monument",
            }
        ]

        with patch("app.government_apis.rce_monuments._rce_client.query_by_location", new_callable=AsyncMock) as mock_query:
            mock_query.return_value = rce_response

            client = AsyncMock(spec=httpx.AsyncClient)

            # First call
            await fetch_monument_status(
                x=121750.0,
                y=487550.0,
                pand_id=None,
                verblijfsobject_id=None,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

            initial_call_count = mock_query.call_count

            # Second call - should hit cache
            result = await fetch_monument_status(
                x=121750.0,
                y=487550.0,
                pand_id=None,
                verblijfsobject_id=None,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

            final_call_count = mock_query.call_count

        # API should only be called once (cache hit on second call)
        assert final_call_count == initial_call_count

        # Result should still be correct
        assert result.is_monument is True
        rce_source = next((s for s in result.sources if s.source == "RCE"), None)
        assert rce_source.monument_nummer == "67890"

    async def test_rce_api_error_handled(self, test_db, org_id):
        """RCE API error is handled gracefully with error in source result."""
        with patch("app.government_apis.rce_monuments._rce_client.query_by_location", new_callable=AsyncMock) as mock_query:
            mock_query.side_effect = httpx.HTTPError("Connection timeout")

            client = AsyncMock(spec=httpx.AsyncClient)

            result = await fetch_monument_status(
                x=121800.0,
                y=487600.0,
                pand_id=None,
                verblijfsobject_id=None,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

        # Result should not be None (graceful degradation)
        assert result is not None

        # RCE source should have error
        rce_source = next((s for s in result.sources if s.source == "RCE"), None)
        assert rce_source is not None
        assert rce_source.error is not None
        assert "RCE API error" in rce_source.error

        # Consensus status should be None (no definitive sources)
        assert result.consensus_status is None
        assert result.has_conflict is False
