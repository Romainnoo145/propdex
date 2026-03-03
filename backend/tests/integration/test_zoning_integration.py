"""Integration tests for zoning aggregator full flow with real database."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from sqlalchemy import select

from app.models.cached_response import CachedAPIResponse
from app.models.organization import Organization
from app.schemas.zoning import ZoningData
from app.services.zoning_aggregator import fetch_zoning_data


@pytest.fixture
async def org_id(test_db):
    """Create a test organization and return its ID."""
    org = Organization(name="Zoning Test Org")
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org.id


@pytest.fixture
def mock_dso_client():
    """Create a mock DSO client for zoning aggregator tests."""
    # Create mock DSO client with all required methods
    client = MagicMock()

    # Mock find_plans_at_location
    client.find_plans_at_location = AsyncMock()

    # Mock feature fetching methods
    client.get_bestemmingsvlakken = AsyncMock()
    client.get_maatvoeringen = AsyncMock()
    client.get_bouwvlakken = AsyncMock()
    client.get_functieaanduidingen = AsyncMock(return_value=[])
    client.get_gebiedsaanduidingen = AsyncMock(return_value=[])
    client.get_teksten = AsyncMock(return_value=[])

    return client


class TestZoningFullFlow:
    """Test zoning aggregator full pipeline: API -> cache -> aggregation -> schema."""

    async def test_cache_miss_fetches_and_stores(self, test_db, org_id, mock_dso_client):
        """First fetch calls DSO API, stores in cache, returns ZoningData."""
        # Setup mock responses
        plans = [
            {
                "identificatie": "NL.IMRO.0363.BP2024-VA01",
                "naam": "Bestemmingsplan Centrum",
                "planType": "bestemmingsplan",
                "planStatus": "vastgesteld",
                "datum": "2024-01-15",
            }
        ]
        mock_dso_client.find_plans_at_location.return_value = plans

        # Polygon containing Point(121687.0, 487484.0)
        bestemmingsvlakken = [
            {
                "naam": "Wonen",
                "omschrijving": "Woondoeleinden",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [121600, 487400],
                            [121800, 487400],
                            [121800, 487600],
                            [121600, 487600],
                            [121600, 487400],
                        ]
                    ],
                },
            }
        ]
        mock_dso_client.get_bestemmingsvlakken.return_value = bestemmingsvlakken

        # Maatvoeringen with building height
        maatvoeringen = [
            {
                "naam": "bouwhoogte",
                "waarde": "12.5",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [121600, 487400],
                            [121800, 487400],
                            [121800, 487600],
                            [121600, 487600],
                            [121600, 487400],
                        ]
                    ],
                },
            }
        ]
        mock_dso_client.get_maatvoeringen.return_value = maatvoeringen

        # Bouwvlakken
        bouwvlakken = [
            {
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [121600, 487400],
                            [121800, 487400],
                            [121800, 487600],
                            [121600, 487600],
                            [121600, 487400],
                        ]
                    ],
                }
            }
        ]
        mock_dso_client.get_bouwvlakken.return_value = bouwvlakken

        # Patch get_dso_client to return our mock
        with patch("app.services.zoning_aggregator.get_dso_client", return_value=mock_dso_client):
            client = AsyncMock(spec=httpx.AsyncClient)

            result = await fetch_zoning_data(
                x=121687.0,
                y=487484.0,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

        # Assertions on result
        assert result is not None
        assert isinstance(result, ZoningData)
        assert len(result.plans) == 1
        assert result.plans[0].plan_id == "NL.IMRO.0363.BP2024-VA01"
        assert result.primary_bestemming == "Wonen"
        assert result.building_dimensions is not None
        assert result.building_dimensions.max_bouwhoogte == 12.5
        assert result.source == "DSO Ruimtelijke Plannen API v4"

        # Direct DB assertion: cache entry exists
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == org_id,
            CachedAPIResponse.source == "dso",
            CachedAPIResponse.cache_key.startswith("dso:zoning:"),
        )
        cache_entry = (await test_db.execute(stmt)).scalar_one()
        assert cache_entry is not None
        assert cache_entry.source == "dso"
        assert "plans" in cache_entry.response_data

    async def test_cache_hit_skips_api(self, test_db, org_id, mock_dso_client):
        """Second call with same params returns cached data without calling API."""
        # Setup mock responses
        plans = [
            {
                "identificatie": "NL.IMRO.0363.BP2024-CACHED",
                "naam": "Cached Plan",
                "planType": "bestemmingsplan",
                "planStatus": "vastgesteld",
                "datum": "2024-01-10",
            }
        ]
        mock_dso_client.find_plans_at_location.return_value = plans

        bestemmingsvlakken = [
            {
                "naam": "Bedrijven",
                "omschrijving": "Bedrijfsdoeleinden",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [121600, 487400],
                            [121800, 487400],
                            [121800, 487600],
                            [121600, 487600],
                            [121600, 487400],
                        ]
                    ],
                },
            }
        ]
        mock_dso_client.get_bestemmingsvlakken.return_value = bestemmingsvlakken
        mock_dso_client.get_maatvoeringen.return_value = []
        mock_dso_client.get_bouwvlakken.return_value = []

        with patch("app.services.zoning_aggregator.get_dso_client", return_value=mock_dso_client):
            client = AsyncMock(spec=httpx.AsyncClient)

            # First call
            result1 = await fetch_zoning_data(
                x=121700.0,
                y=487500.0,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

            # Reset mock call counts
            initial_call_count = mock_dso_client.find_plans_at_location.call_count

            # Second call - should hit cache
            result2 = await fetch_zoning_data(
                x=121700.0,
                y=487500.0,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

        # API should only be called once
        assert mock_dso_client.find_plans_at_location.call_count == initial_call_count

        # Results should match
        assert result1.plans[0].plan_id == result2.plans[0].plan_id
        assert result1.primary_bestemming == result2.primary_bestemming

    async def test_force_refresh_bypasses_cache(self, test_db, org_id, mock_dso_client):
        """force_refresh=True bypasses cache and fetches fresh data."""
        # Setup mock responses for two different fetches
        plans = [
            {
                "identificatie": "NL.IMRO.0363.BP2024-REFRESH",
                "naam": "Fresh Plan",
                "planType": "bestemmingsplan",
                "planStatus": "vastgesteld",
                "datum": "2024-02-01",
            }
        ]
        mock_dso_client.find_plans_at_location.return_value = plans

        bestemmingsvlakken = [
            {
                "naam": "Gemengd",
                "omschrijving": "Gemengde doeleinden",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [121600, 487400],
                            [121800, 487400],
                            [121800, 487600],
                            [121600, 487600],
                            [121600, 487400],
                        ]
                    ],
                },
            }
        ]
        mock_dso_client.get_bestemmingsvlakken.return_value = bestemmingsvlakken
        mock_dso_client.get_maatvoeringen.return_value = []
        mock_dso_client.get_bouwvlakken.return_value = []

        with patch("app.services.zoning_aggregator.get_dso_client", return_value=mock_dso_client):
            client = AsyncMock(spec=httpx.AsyncClient)

            # First call with force_refresh=False
            await fetch_zoning_data(
                x=121750.0,
                y=487550.0,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

            first_call_count = mock_dso_client.find_plans_at_location.call_count

            # Second call with force_refresh=True
            await fetch_zoning_data(
                x=121750.0,
                y=487550.0,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=True,
            )

            second_call_count = mock_dso_client.find_plans_at_location.call_count

        # API should be called twice (force_refresh bypasses cache)
        assert second_call_count == first_call_count + 1

    async def test_no_plans_returns_none(self, test_db, org_id, mock_dso_client):
        """When no plans found at location, returns None but creates cache entry."""
        # Mock empty plans response
        mock_dso_client.find_plans_at_location.return_value = []

        with patch("app.services.zoning_aggregator.get_dso_client", return_value=mock_dso_client):
            client = AsyncMock(spec=httpx.AsyncClient)

            result = await fetch_zoning_data(
                x=121800.0,
                y=487600.0,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

        # Result should be None when no plans found
        assert result is None

        # Cache entry should still be created
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == org_id,
            CachedAPIResponse.cache_key.startswith("dso:zoning:v3:121800.0:487600.0"),
        )
        cache_entry = (await test_db.execute(stmt)).scalar_one()
        assert cache_entry is not None
        assert cache_entry.response_data["plans"] == []
        assert "Geen bestemmingsplan gevonden op deze locatie" in cache_entry.response_data["data_gaps"]

    async def test_data_gaps_tracked(self, test_db, org_id, mock_dso_client):
        """When bestemmingsvlakken empty, data gap is tracked."""
        # Setup mock with plan but no bestemmingsvlakken at location
        plans = [
            {
                "identificatie": "NL.IMRO.0363.BP2024-GAPS",
                "naam": "Plan with Gaps",
                "planType": "bestemmingsplan",
                "planStatus": "vastgesteld",
                "datum": "2024-01-20",
            }
        ]
        mock_dso_client.find_plans_at_location.return_value = plans

        # Empty features - no data at this location
        mock_dso_client.get_bestemmingsvlakken.return_value = []
        mock_dso_client.get_maatvoeringen.return_value = []
        mock_dso_client.get_bouwvlakken.return_value = []

        with patch("app.services.zoning_aggregator.get_dso_client", return_value=mock_dso_client):
            client = AsyncMock(spec=httpx.AsyncClient)

            result = await fetch_zoning_data(
                x=121850.0,
                y=487650.0,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=False,
            )

        # Result should have data gaps
        assert result is not None
        assert "Geen bestemmingsvlakken op deze locatie" in result.data_gaps
        assert "Geen maatvoeringen gevonden" in result.data_gaps
        assert "Geen bouwvlakken gevonden" in result.data_gaps

    async def test_plu_fallback_fills_tar_far(self, test_db, org_id, mock_dso_client):
        """If DSO maatvoeringen miss TAR/FAR, PLU fallback should populate them."""
        plans = [
            {
                "identificatie": "NL.IMRO.0363.BP2024-PLU",
                "naam": "Plan met fallback",
                "planType": "bestemmingsplan",
                "planStatus": "vastgesteld",
                "datum": "2024-01-20",
            }
        ]
        mock_dso_client.find_plans_at_location.return_value = plans
        mock_dso_client.get_bestemmingsvlakken.return_value = [
            {
                "naam": "Wonen",
                "omschrijving": "Woondoeleinden",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [121600, 487400],
                            [121800, 487400],
                            [121800, 487600],
                            [121600, 487600],
                            [121600, 487400],
                        ]
                    ],
                },
            }
        ]
        mock_dso_client.get_maatvoeringen.return_value = []
        mock_dso_client.get_bouwvlakken.return_value = []

        with (
            patch("app.services.zoning_aggregator.get_dso_client", return_value=mock_dso_client),
            patch(
                "app.services.zoning_aggregator.plu_wms_client.get_bestemming_at_point",
                new=AsyncMock(
                    return_value=[
                        {
                            "type": "Wonen",
                            "naam": "Wonen",
                            "max_bebouwingspercentage": 70,
                            "max_floor_area_ratio": 2.1,
                        }
                    ]
                ),
            ),
        ):
            client = AsyncMock(spec=httpx.AsyncClient)
            result = await fetch_zoning_data(
                x=121700.0,
                y=487500.0,
                client=client,
                organization_id=org_id,
                session=test_db,
                force_refresh=True,
            )

        assert result is not None
        assert result.building_dimensions is not None
        assert result.building_dimensions.max_bebouwingspercentage == 70.0
        assert result.building_dimensions.max_floor_area_ratio == 2.1
        assert any("PLU" in gap for gap in result.data_gaps)
