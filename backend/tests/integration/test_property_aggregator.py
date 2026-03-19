"""Integration tests for property aggregator orchestration flow."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException

from app.ai.schemas import AIParsingSection
from app.government_apis.base import APINotFoundError, GovernmentAPIError
from app.models.organization import Organization
from app.schemas.address import AddressInput, AddressResolution, BAGAddressResponse, BuildingData
from app.schemas.monument import MonumentSourceResult, MonumentStatus
from app.schemas.property import PropertyReportResponse
from app.schemas.zoning import BuildingDimensions, ZoningData, ZoningPlan, ZoningRule
from app.services.property_aggregator import aggregate_property_data


@pytest.fixture
async def org_id(test_db):
    """Create a test organization and return its ID."""
    org = Organization(name="Property Aggregator Test Org")
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org.id


def make_mock_address_resolution(with_geometry: bool = True, geometry_type: str = "Point") -> AddressResolution:
    """Create mock AddressResolution for testing."""
    geometry = None
    if with_geometry:
        if geometry_type == "Point":
            geometry = {"type": "Point", "coordinates": [121687.0, 487484.0]}
        elif geometry_type == "Polygon":
            geometry = {
                "type": "Polygon",
                "coordinates": [
                    [
                        [121600.0, 487400.0],
                        [121800.0, 487400.0],
                        [121800.0, 487600.0],
                        [121600.0, 487600.0],
                        [121600.0, 487400.0],
                    ]
                ],
            }

    return AddressResolution(
        address=BAGAddressResponse(
            nummeraanduiding_id="0363200000123456",
            verblijfsobject_id="0363010000123456",
            straat="Keizersgracht",
            huisnummer=123,
            postcode="1015 CJ",
            woonplaats="Amsterdam",
        ),
        building=BuildingData(
            pand_id="0363100012345678",
            bouwjaar=1890,
            status="Pand in gebruik",
            geometry=geometry,
        ) if with_geometry or geometry_type == "Polygon" else None,
        resolved_at=datetime.utcnow().isoformat() + "Z",
        source="bag",
    )


def make_mock_zoning_data() -> ZoningData:
    """Create mock ZoningData for testing."""
    return ZoningData(
        plans=[
            ZoningPlan(
                plan_id="NL.IMRO.0363.BP2024-TEST",
                plan_naam="Test Bestemmingsplan",
                plan_type="bestemmingsplan",
                plan_status="vastgesteld",
                plan_datum="2024-01-15",
                rules=[
                    ZoningRule(
                        bestemming="Wonen",
                        omschrijving="Woondoeleinden",
                        building_dimensions=BuildingDimensions(
                            max_bouwhoogte=12.5,
                        ),
                        geometry={
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
                    )
                ],
            )
        ],
        primary_bestemming="Wonen",
        building_dimensions=BuildingDimensions(max_bouwhoogte=12.5),
        data_gaps=[],
        source="DSO Ruimtelijke Plannen API v4",
    )


def make_mock_monument_status() -> MonumentStatus:
    """Create mock MonumentStatus for testing."""
    return MonumentStatus(
        sources=[
            MonumentSourceResult(
                source="RCE",
                is_monument=True,
                monument_type="rijksmonument",
                monument_nummer="12345",
                monument_naam="Historisch Pand",
                cached_at=datetime.utcnow().isoformat() + "Z",
                age_seconds=300,
            ),
            MonumentSourceResult(
                source="BAG",
                is_monument=True,
                cached_at=datetime.utcnow().isoformat() + "Z",
                age_seconds=150,
            ),
        ],
        has_conflict=False,
        is_monument=True,
        consensus_status="Monument confirmed by RCE and BAG",
    )


class TestPropertyAggregatorOrchestration:
    """Test property aggregator full orchestration flow with internal function mocking."""

    async def test_full_orchestration_all_sections_available(self, test_db, org_id):
        """Full orchestration with all data sources returning valid data."""
        mock_resolution = make_mock_address_resolution()
        mock_zoning = make_mock_zoning_data()
        mock_monuments = make_mock_monument_status()

        # Mock internal orchestration functions
        with (
            patch("app.services.property_aggregator.resolve_address", return_value=mock_resolution) as mock_resolve,
            patch("app.services.property_aggregator.fetch_zoning_data", return_value=mock_zoning) as mock_fetch_zoning,
            patch("app.services.property_aggregator.fetch_monument_status", return_value=mock_monuments) as mock_fetch_monuments,
            patch("app.services.property_aggregator.get_cached_or_fetch") as mock_get_cached,
        ):
            # Mock cadastral parcels via get_cached_or_fetch
            mock_cache_result = AsyncMock()
            mock_cache_result.data = [
                {
                    "properties": {
                        "identificatie": "KAD001",
                        "kadastrale_gemeente_waarde": "ASD04",
                        "sectie": "S",
                        "perceelnummer": 12345,
                        "kadastrale_grootte_waarde": 150,
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[121600, 487400], [121700, 487400], [121700, 487500], [121600, 487500], [121600, 487400]]],
                    },
                }
            ]
            mock_cache_result.cached_at = datetime.utcnow().isoformat() + "Z"
            mock_cache_result.age_seconds = 200
            mock_cache_result.is_cached = True
            mock_get_cached.return_value = mock_cache_result

            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="1015 CJ", huisnummer=123)

            result = await aggregate_property_data(
                input_data=input_data,
                client=client,
                session=test_db,
                force_refresh=False,
                arq_pool=None,
            )

        # Assertions
        assert isinstance(result, PropertyReportResponse)

        # Address section
        assert result.address.straat == "Keizersgracht"
        assert result.address.huisnummer == 123

        # Building section
        assert result.building is not None
        assert result.building.pand_id == "0363100012345678"
        assert result.building.bouwjaar == 1890

        # Cadastral section
        assert len(result.cadastral_parcels) == 1
        assert result.cadastral_parcels[0].kadastrale_aanduiding == "ASD04 S 12345"
        assert result.cadastral_parcels[0].oppervlakte == 150

        # Zoning section
        assert result.zoning is not None
        assert result.zoning.primary_bestemming == "Wonen"

        # Monuments section
        assert result.monuments is not None
        assert result.monuments.is_monument is True

        # Map data
        assert result.map_data is not None
        assert result.map_data.center_rd == [121687.0, 487484.0]

        # Completeness score (5 sections available out of 11: address, building, cadastral, zoning, monuments)
        # AI parsing is not_available (arq_pool=None), energy_label/woz fail mock mismatch, brk unconfigured
        assert result.completeness_score == pytest.approx(5 / 11, rel=0.01)

        # Data sources
        assert any("BAG API v2" in src.source for src in result.data_sources)
        assert any("PDOK Cadastral OGC API" in src.source for src in result.data_sources)

        # Section sources
        section_names = [s.section for s in result.section_sources]
        assert "zoning" in section_names
        assert "monuments" in section_names

        # AI parsing section should be not_available
        assert result.ai_parsing is not None
        assert result.ai_parsing.status == "not_available"
        assert "AI parsing niet beschikbaar" in result.ai_parsing.error_message

        # Verify internal functions were called
        mock_resolve.assert_called_once()
        mock_fetch_zoning.assert_called_once()
        mock_fetch_monuments.assert_called_once()

    async def test_address_not_found_raises_404(self, test_db, org_id):
        """BAG address resolution failure raises HTTPException 404."""
        with patch("app.services.property_aggregator.resolve_address") as mock_resolve:
            mock_resolve.side_effect = APINotFoundError(source="bag", message="Address not found")

            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="9999 ZZ", huisnummer=999)

            with pytest.raises(HTTPException) as exc_info:
                await aggregate_property_data(
                    input_data=input_data,
                    client=client,
                    session=test_db,
                    force_refresh=False,
                    arq_pool=None,
                )

        assert exc_info.value.status_code == 404
        assert "Address not found in BAG registry" in exc_info.value.detail

    async def test_address_upstream_error_raises_502(self, test_db, org_id):
        """BAG upstream API error raises HTTPException 502."""
        with patch("app.services.property_aggregator.resolve_address") as mock_resolve:
            mock_resolve.side_effect = GovernmentAPIError(
                source="bag",
                message="Service unavailable",
                status_code=503,
            )

            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="1015 CJ", huisnummer=123)

            with pytest.raises(HTTPException) as exc_info:
                await aggregate_property_data(
                    input_data=input_data,
                    client=client,
                    session=test_db,
                    force_refresh=False,
                    arq_pool=None,
                )

        assert exc_info.value.status_code == 502
        assert "Failed to resolve address" in exc_info.value.detail

    async def test_partial_failure_zoning_unavailable(self, test_db, org_id):
        """Zoning fetch failure is gracefully handled, other sections still populated."""
        mock_resolution = make_mock_address_resolution()
        mock_monuments = make_mock_monument_status()

        with (
            patch("app.services.property_aggregator.resolve_address", return_value=mock_resolution),
            patch("app.services.property_aggregator.fetch_zoning_data") as mock_fetch_zoning,
            patch("app.services.property_aggregator.fetch_monument_status", return_value=mock_monuments),
            patch("app.services.property_aggregator.get_cached_or_fetch") as mock_get_cached,
        ):
            # Zoning raises exception
            mock_fetch_zoning.side_effect = Exception("DSO API timeout")

            # Mock cadastral data
            mock_cache_result = AsyncMock()
            mock_cache_result.data = []
            mock_cache_result.cached_at = None
            mock_cache_result.age_seconds = None
            mock_cache_result.is_cached = False
            mock_get_cached.return_value = mock_cache_result

            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="1015 CJ", huisnummer=123)

            result = await aggregate_property_data(
                input_data=input_data,
                client=client,
                session=test_db,
                force_refresh=False,
                arq_pool=None,
            )

        # Address and building should still be present
        assert result.address.straat == "Keizersgracht"
        assert result.building is not None

        # Zoning should be None
        assert result.zoning is None

        # Monuments should still be populated
        assert result.monuments is not None

        # Errors list should contain zoning error
        assert any("Bestemmingsplan data niet beschikbaar" in err for err in result.errors)

        # Completeness score: address=1, building=1, monuments=1, rest=0 → 3/11
        assert result.completeness_score == pytest.approx(3 / 11, rel=0.01)

    async def test_partial_failure_monuments_unavailable(self, test_db, org_id):
        """Monument fetch failure is gracefully handled, other sections still populated."""
        mock_resolution = make_mock_address_resolution()
        mock_zoning = make_mock_zoning_data()

        with (
            patch("app.services.property_aggregator.resolve_address", return_value=mock_resolution),
            patch("app.services.property_aggregator.fetch_zoning_data", return_value=mock_zoning),
            patch("app.services.property_aggregator.fetch_monument_status") as mock_fetch_monuments,
            patch("app.services.property_aggregator.get_cached_or_fetch") as mock_get_cached,
        ):
            # Monuments raises exception
            mock_fetch_monuments.side_effect = Exception("RCE API error")

            # Mock cadastral data
            mock_cache_result = AsyncMock()
            mock_cache_result.data = []
            mock_cache_result.cached_at = None
            mock_cache_result.age_seconds = None
            mock_cache_result.is_cached = False
            mock_get_cached.return_value = mock_cache_result

            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="1015 CJ", huisnummer=123)

            result = await aggregate_property_data(
                input_data=input_data,
                client=client,
                session=test_db,
                force_refresh=False,
                arq_pool=None,
            )

        # Address and building should be present
        assert result.address is not None
        assert result.building is not None

        # Zoning should be populated
        assert result.zoning is not None
        assert result.zoning.primary_bestemming == "Wonen"

        # Monuments should be None
        assert result.monuments is None

        # Errors list should contain monument error
        assert any("Monument data niet beschikbaar" in err for err in result.errors)

        # Completeness score: address=1, building=1, zoning=1, rest=0 → 3/11
        assert result.completeness_score == pytest.approx(3 / 11, rel=0.01)

    async def test_partial_failure_cadastral_unavailable(self, test_db, org_id):
        """Cadastral fetch failure is gracefully handled, other sections still populated."""
        mock_resolution = make_mock_address_resolution()
        mock_zoning = make_mock_zoning_data()
        mock_monuments = make_mock_monument_status()

        with (
            patch("app.services.property_aggregator.resolve_address", return_value=mock_resolution),
            patch("app.services.property_aggregator.fetch_zoning_data", return_value=mock_zoning),
            patch("app.services.property_aggregator.fetch_monument_status", return_value=mock_monuments),
            patch("app.services.property_aggregator.get_cached_or_fetch") as mock_get_cached,
        ):
            # Cadastral raises exception
            mock_get_cached.side_effect = Exception("PDOK OGC API timeout")

            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="1015 CJ", huisnummer=123)

            result = await aggregate_property_data(
                input_data=input_data,
                client=client,
                session=test_db,
                force_refresh=False,
                arq_pool=None,
            )

        # Address, building, zoning, monuments should all be present
        assert result.address is not None
        assert result.building is not None
        assert result.zoning is not None
        assert result.monuments is not None

        # Cadastral parcels should be empty
        assert result.cadastral_parcels == []

        # Errors list should contain cadastral error
        assert any("Cadastral data unavailable" in err for err in result.errors)

        # Completeness score: address=1, building=1, zoning=1, monuments=1, rest=0 → 4/11
        assert result.completeness_score == pytest.approx(4 / 11, rel=0.01)

    async def test_no_coordinates_skips_parallel_fetches(self, test_db, org_id):
        """When building has no geometry, parallel fetches are skipped."""
        mock_resolution = make_mock_address_resolution(with_geometry=False)

        with (
            patch("app.services.property_aggregator.resolve_address", return_value=mock_resolution),
            patch("app.services.property_aggregator.fetch_zoning_data") as mock_fetch_zoning,
            patch("app.services.property_aggregator.fetch_monument_status") as mock_fetch_monuments,
            patch("app.services.property_aggregator.get_cached_or_fetch") as mock_get_cached,
        ):
            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="1015 CJ", huisnummer=123)

            result = await aggregate_property_data(
                input_data=input_data,
                client=client,
                session=test_db,
                force_refresh=False,
                arq_pool=None,
            )

        # Address should be present
        assert result.address is not None

        # Building should be None (no geometry)
        assert result.building is None

        # Parallel fetches should return None/empty
        assert result.zoning is None
        assert result.monuments is None
        assert result.cadastral_parcels == []

        # Map data should be None (no coordinates)
        assert result.map_data is None

        # Completeness score: only address available → 1/11
        assert result.completeness_score == pytest.approx(1 / 11, rel=0.01)

        # Coordinate-dependent fetches should not be called
        mock_fetch_zoning.assert_not_called()
        mock_fetch_monuments.assert_not_called()
        # get_cached_or_fetch IS called for ep_online and woz (coordinate-independent)

    async def test_polygon_geometry_extracts_centroid(self, test_db, org_id):
        """Polygon geometry is converted to centroid for parallel fetches."""
        mock_resolution = make_mock_address_resolution(geometry_type="Polygon")
        mock_zoning = make_mock_zoning_data()
        mock_monuments = make_mock_monument_status()

        with (
            patch("app.services.property_aggregator.resolve_address", return_value=mock_resolution),
            patch("app.services.property_aggregator.fetch_zoning_data", return_value=mock_zoning) as mock_fetch_zoning,
            patch("app.services.property_aggregator.fetch_monument_status", return_value=mock_monuments) as mock_fetch_monuments,
            patch("app.services.property_aggregator.get_cached_or_fetch") as mock_get_cached,
        ):
            # Mock cadastral data
            mock_cache_result = AsyncMock()
            mock_cache_result.data = []
            mock_cache_result.cached_at = None
            mock_cache_result.age_seconds = None
            mock_cache_result.is_cached = False
            mock_get_cached.return_value = mock_cache_result

            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="1015 CJ", huisnummer=123)

            result = await aggregate_property_data(
                input_data=input_data,
                client=client,
                session=test_db,
                force_refresh=False,
                arq_pool=None,
            )

        # Parallel fetches should have been called (coordinates extracted from polygon)
        mock_fetch_zoning.assert_called_once()
        mock_fetch_monuments.assert_called_once()
        # get_cached_or_fetch called for cadastral, ep_online, and woz
        assert mock_get_cached.call_count >= 1

        # Verify coordinates were extracted (centroid of polygon: [121700.0, 487500.0])
        zoning_call_kwargs = mock_fetch_zoning.call_args.kwargs
        assert zoning_call_kwargs["x"] == 121700.0
        assert zoning_call_kwargs["y"] == 487500.0

        # Map data should have center coordinates from polygon centroid
        assert result.map_data is not None
        assert result.map_data.center_rd == [121700.0, 487500.0]

    async def test_completeness_score_calculation(self, test_db, org_id):
        """Completeness score correctly reflects available sections."""
        # Test 1: All sections available (except AI parsing with arq_pool=None)
        mock_resolution = make_mock_address_resolution()
        mock_zoning = make_mock_zoning_data()
        mock_monuments = make_mock_monument_status()

        with (
            patch("app.services.property_aggregator.resolve_address", return_value=mock_resolution),
            patch("app.services.property_aggregator.fetch_zoning_data", return_value=mock_zoning),
            patch("app.services.property_aggregator.fetch_monument_status", return_value=mock_monuments),
            patch("app.services.property_aggregator.get_cached_or_fetch") as mock_get_cached,
        ):
            # Mock cadastral with data
            mock_cache_result = AsyncMock()
            mock_cache_result.data = [
                {
                    "properties": {
                        "kadastrale_gemeente_waarde": "TEST",
                        "sectie": "A",
                        "perceelnummer": 1,
                    },
                    "geometry": None,
                }
            ]
            mock_cache_result.cached_at = None
            mock_cache_result.age_seconds = None
            mock_cache_result.is_cached = False
            mock_get_cached.return_value = mock_cache_result

            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="1015 CJ", huisnummer=123)

            result = await aggregate_property_data(
                input_data=input_data,
                client=client,
                session=test_db,
                force_refresh=False,
                arq_pool=None,
            )

        # Sections: address=1, building=1, cadastral=1, zoning=1, monuments=1, rest=0 → 5/11
        assert result.completeness_score == pytest.approx(5 / 11, rel=0.01)

        # Test 2: Only address and building
        mock_resolution_minimal = make_mock_address_resolution(with_geometry=False)

        with patch("app.services.property_aggregator.resolve_address", return_value=mock_resolution_minimal):
            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="1015 CJ", huisnummer=123)

            result_minimal = await aggregate_property_data(
                input_data=input_data,
                client=client,
                session=test_db,
                force_refresh=False,
                arq_pool=None,
            )

        # Sections: address=1, rest=0 → 1/11
        assert result_minimal.completeness_score == pytest.approx(1 / 11, rel=0.01)

    async def test_ai_parsing_section_without_arq_pool(self, test_db, org_id):
        """When arq_pool=None, AI parsing section has status 'not_available'."""
        mock_resolution = make_mock_address_resolution()

        with (
            patch("app.services.property_aggregator.resolve_address", return_value=mock_resolution),
            patch("app.services.property_aggregator.fetch_zoning_data", return_value=None),
            patch("app.services.property_aggregator.fetch_monument_status", return_value=None),
            patch("app.services.property_aggregator.get_cached_or_fetch") as mock_get_cached,
        ):
            # Mock empty cadastral
            mock_cache_result = AsyncMock()
            mock_cache_result.data = []
            mock_cache_result.cached_at = None
            mock_cache_result.age_seconds = None
            mock_cache_result.is_cached = False
            mock_get_cached.return_value = mock_cache_result

            client = AsyncMock(spec=httpx.AsyncClient)
            input_data = AddressInput(postcode="1015 CJ", huisnummer=123)

            # Call with arq_pool=None
            result = await aggregate_property_data(
                input_data=input_data,
                client=client,
                session=test_db,
                force_refresh=False,
                arq_pool=None,
            )

        # AI parsing section should exist with not_available status
        assert result.ai_parsing is not None
        assert isinstance(result.ai_parsing, AIParsingSection)
        assert result.ai_parsing.status == "not_available"
        assert result.ai_parsing.error_message == "AI parsing niet beschikbaar"

        # AI parsing should NOT contribute to completeness score
        # Sections: address=1, building=1, rest=0 → 2/11
        assert result.completeness_score == pytest.approx(2 / 11, rel=0.01)
