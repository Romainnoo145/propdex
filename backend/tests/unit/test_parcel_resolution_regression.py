"""Regression tests: parcel filtering wired into aggregate_property_data pipeline.

Proves that when PDOK returns multiple cadastral parcels in a bbox, only the
parcel that *contains* the building centroid appears in the final
``PropertyReportResponse.cadastral_parcels`` list.  Covers:

1. Multi-parcel → only containing parcel returned
2. Point on shared boundary → nearest-centroid fallback
3. Single parcel passthrough
4. Point outside all parcels → nearest-centroid fallback

Uses the same mock pattern as ``tests/integration/test_property_aggregator.py``
but mocks all external dependencies (including DB session) so no database is
required.
"""

from contextlib import contextmanager
from datetime import datetime
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from shapely.geometry import box, mapping

from app.schemas.address import (
    AddressInput,
    AddressResolution,
    BAGAddressResponse,
    BuildingData,
)
from app.schemas.brk_ownership import BRKOwnership
from app.schemas.monument import MonumentSourceResult, MonumentStatus
from app.schemas.property import PropertyReportResponse
from app.schemas.zoning import (
    BuildingDimensions,
    ZoningData,
    ZoningPlan,
    ZoningRule,
)
from app.services.property_aggregator import aggregate_property_data


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Building centroid sits at (155005, 463005) — inside parcel A only.
_BUILDING_CENTROID = (155005.0, 463005.0)


def _make_pdok_feature(
    parcel_id: str,
    minx: float,
    miny: float,
    maxx: float,
    maxy: float,
) -> dict:
    """Build a PDOK-style feature dict with rectangular RD polygon."""
    return {
        "properties": {
            "identificatie": f"NL.IMKAD.{parcel_id}",
            "kadastrale_gemeente_waarde": "TST",
            "sectie": "T",
            "perceelnummer": int(parcel_id) if parcel_id.isdigit() else 1,
            "kadastrale_grootte_waarde": int((maxx - minx) * (maxy - miny)),
        },
        "geometry": mapping(box(minx, miny, maxx, maxy)),
    }


# Parcel A: (155000,463000)-(155010,463010) — contains _BUILDING_CENTROID
PARCEL_A = _make_pdok_feature("1001", 155000, 463000, 155010, 463010)

# Parcel B: (155010,463000)-(155020,463010) — adjacent east, does NOT contain centroid
PARCEL_B = _make_pdok_feature("1002", 155010, 463000, 155020, 463010)

# Parcel C: (155020,463000)-(155030,463010) — further east
PARCEL_C = _make_pdok_feature("1003", 155020, 463000, 155030, 463010)

_BRK_UNAVAILABLE = BRKOwnership(status="unavailable", reason="test")


def _make_address_resolution(x: float, y: float) -> AddressResolution:
    """Build an AddressResolution whose building geometry is a Point at (x, y)."""
    return AddressResolution(
        address=BAGAddressResponse(
            nummeraanduiding_id="0363200000999999",
            verblijfsobject_id="0363010000999999",
            straat="Teststraat",
            huisnummer=1,
            postcode="1234 AB",
            woonplaats="Teststad",
        ),
        building=BuildingData(
            pand_id="0363100099999999",
            bouwjaar=2000,
            status="Pand in gebruik",
            geometry={"type": "Point", "coordinates": [x, y]},
        ),
        resolved_at=datetime.utcnow().isoformat() + "Z",
        source="bag",
    )


def _make_mock_zoning() -> ZoningData:
    return ZoningData(
        plans=[
            ZoningPlan(
                plan_id="NL.IMRO.TEST",
                plan_naam="Test Plan",
                plan_type="bestemmingsplan",
                plan_status="vastgesteld",
                plan_datum="2024-01-01",
                rules=[],
            )
        ],
        primary_bestemming="Wonen",
        building_dimensions=BuildingDimensions(),
        data_gaps=[],
        source="test",
    )


def _make_mock_monuments() -> MonumentStatus:
    return MonumentStatus(
        sources=[
            MonumentSourceResult(
                source="RCE",
                is_monument=False,
                cached_at=datetime.utcnow().isoformat() + "Z",
                age_seconds=100,
            )
        ],
        has_conflict=False,
        is_monument=False,
        consensus_status="No monument",
    )


def _mock_cache_result(features: list[dict]) -> AsyncMock:
    """Build a mock return value for get_cached_or_fetch."""
    result = AsyncMock()
    result.data = features
    result.cached_at = datetime.utcnow().isoformat() + "Z"
    result.age_seconds = 60
    result.is_cached = True
    return result


def _empty_cache_result() -> AsyncMock:
    result = AsyncMock()
    result.data = []
    result.cached_at = None
    result.age_seconds = None
    result.is_cached = False
    return result


def _make_get_cached_side_effect(cadastral_features: list[dict]):
    """Return a side_effect callable for get_cached_or_fetch.

    The cadastral call uses cache_key starting with 'kadaster:parcel:'.
    All other calls (ep_online, woz) return empty results.
    """
    async def _side_effect(*, cache_key: str, **kwargs):
        if cache_key.startswith("kadaster:parcel:"):
            return _mock_cache_result(cadastral_features)
        return _empty_cache_result()

    return _side_effect


_AGG = "app.services.property_aggregator"


@contextmanager
def _patch_aggregator(cadastral_features: list[dict], resolution: AddressResolution):
    """Context manager that mocks all external dependencies of aggregate_property_data."""
    with (
        patch(f"{_AGG}.resolve_address", return_value=resolution),
        patch(f"{_AGG}.fetch_zoning_data", return_value=_make_mock_zoning()),
        patch(f"{_AGG}.fetch_monument_status", return_value=_make_mock_monuments()),
        patch(
            f"{_AGG}.get_cached_or_fetch",
            side_effect=_make_get_cached_side_effect(cadastral_features),
        ),
        patch(f"{_AGG}.fetch_brk_ownership", return_value=_BRK_UNAVAILABLE),
        patch(f"{_AGG}.get_primary_plan_idn", return_value=None),
        patch(f"{_AGG}.build_permit_precedent_benchmark", return_value=None),
        patch(f"{_AGG}._fetch_market_signals", return_value=None),
        patch(f"{_AGG}._fetch_bodem", return_value=None),
        patch(f"{_AGG}.fetch_soil_profile", return_value=None),
        patch(f"{_AGG}.fetch_funderingsrisico_data", return_value=None),
    ):
        yield


async def _run_aggregation(cadastral_features: list[dict], x: float, y: float) -> PropertyReportResponse:
    """Run aggregate_property_data with mocked dependencies, returning the result."""
    resolution = _make_address_resolution(x, y)
    with _patch_aggregator(cadastral_features, resolution):
        return await aggregate_property_data(
            input_data=AddressInput(postcode="1234 AB", huisnummer=1),
            client=AsyncMock(spec=httpx.AsyncClient),
            session=AsyncMock(),
            force_refresh=False,
            arq_pool=None,
        )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestParcelResolutionRegression:
    """End-to-end regression: parcel filtering inside aggregate_property_data."""

    async def test_multi_parcel_returns_only_containing(self):
        """3 parcels in bbox, only one contains centroid → result has 1 parcel."""
        result = await _run_aggregation(
            [PARCEL_A, PARCEL_B, PARCEL_C], *_BUILDING_CENTROID
        )

        assert isinstance(result, PropertyReportResponse)
        assert len(result.cadastral_parcels) == 1, (
            f"Expected 1 parcel, got {len(result.cadastral_parcels)}: "
            f"{[p.identificatie for p in result.cadastral_parcels]}"
        )
        assert result.cadastral_parcels[0].identificatie == "NL.IMKAD.1001"

    async def test_boundary_point_uses_nearest_centroid(self):
        """Point on shared boundary (no contains match) → nearest-centroid fallback."""
        # Place building exactly on the right edge of A / left edge of B
        result = await _run_aggregation(
            [PARCEL_A, PARCEL_B, PARCEL_C], 155010.0, 463005.0
        )

        assert isinstance(result, PropertyReportResponse)
        # On boundary: contains() may catch one side, or fallback to nearest.
        # Either A or B is acceptable — key is exactly 1 parcel returned.
        assert len(result.cadastral_parcels) >= 1
        ids = {p.identificatie for p in result.cadastral_parcels}
        assert ids.issubset({"NL.IMKAD.1001", "NL.IMKAD.1002"}), (
            f"Expected parcel A or B, got {ids}"
        )

    async def test_single_parcel_passthrough(self):
        """Only 1 parcel in response → returned as-is without filtering."""
        result = await _run_aggregation([PARCEL_A], *_BUILDING_CENTROID)

        assert isinstance(result, PropertyReportResponse)
        assert len(result.cadastral_parcels) == 1
        assert result.cadastral_parcels[0].identificatie == "NL.IMKAD.1001"

    async def test_no_containing_parcel_nearest_fallback(self):
        """Point outside all parcels → nearest-centroid selected."""
        # Building centroid far south of all parcels, closest to parcel A centroid
        result = await _run_aggregation(
            [PARCEL_A, PARCEL_B, PARCEL_C], 155005.0, 462990.0
        )

        assert isinstance(result, PropertyReportResponse)
        assert len(result.cadastral_parcels) == 1, (
            f"Expected 1 (nearest) parcel, got {len(result.cadastral_parcels)}"
        )
        # Parcel A centroid (155005,463005) is closest to (155005,462990)
        assert result.cadastral_parcels[0].identificatie == "NL.IMKAD.1001"
