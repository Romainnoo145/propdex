"""Unit tests for PDOK helper map-click parcel resolution.

Tests cover the `_resolve_pdok_cadastral_parcel_at_rd()` function in
`app.scans.helpers`, verifying point-in-polygon containment and the
nearest-centroid fallback introduced in M034-S02-T01.

Also covers `get_parcel_at_point()` live reverse geocode integration
(M035-S01): live geocode overriding cached address, fallback to centroid
resolution, and coordinate correctness.

All tests use synthetic GeoJSON features with RD coordinates so that
`_geometry_looks_wgs84()` returns False and the function uses the
RD click point for containment / centroid comparisons.
"""

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import httpx
import pytest
from shapely.geometry import box, mapping

# ---------------------------------------------------------------------------
# Helpers — synthetic PDOK feature dicts
# ---------------------------------------------------------------------------

def _make_feature(
    parcel_id: str,
    minx: float,
    miny: float,
    maxx: float,
    maxy: float,
) -> dict:
    """Build a minimal PDOK feature dict with a rectangular RD polygon.

    Uses property keys that _resolve_pdok_cadastral_parcel_at_rd actually
    reads: kadastrale_gemeente_waarde, sectie, perceelnummer → parcel_code.
    """
    geojson = mapping(box(minx, miny, maxx, maxy))
    return {
        "geometry": geojson,
        "properties": {
            "kadastrale_gemeente_waarde": "Venlo",
            "sectie": "T",
            "perceelnummer": parcel_id,
        },
    }


# Three non-overlapping square parcels (10×10 m) in typical RD coords
PARCEL_A = _make_feature("A", 155000, 463000, 155010, 463010)  # centroid (155005, 463005)
PARCEL_B = _make_feature("B", 155020, 463000, 155030, 463010)  # centroid (155025, 463005)
PARCEL_C = _make_feature("C", 155040, 463000, 155050, 463010)  # centroid (155045, 463005)


# ---------------------------------------------------------------------------
# Shared mock helpers
# ---------------------------------------------------------------------------

def _mock_db_session() -> AsyncMock:
    """Return an AsyncMock db session that returns passthrough geometry rows."""
    db = AsyncMock()
    row = {
        "geometry_rd": json.dumps({"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}),
        "geometry_wgs84": json.dumps({"type": "Polygon", "coordinates": [[[5.0, 51.0], [5.1, 51.0], [5.1, 51.1], [5.0, 51.1], [5.0, 51.0]]]}),
    }
    result_mock = MagicMock()
    result_mock.mappings.return_value.one_or_none.return_value = row
    db.execute = AsyncMock(return_value=result_mock)
    return db


def _assert_parcel_id(result: dict | None, expected_id: str) -> None:
    """Assert the result dict's parcel_code ends with the expected perceelnummer."""
    assert result is not None, "Expected a result dict, got None"
    code = result.get("parcel_code")
    assert code is not None, f"parcel_code is None; full result: {result}"
    assert code.endswith(expected_id), f"Expected parcel_code ending with '{expected_id}', got '{code}'"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
class TestMapClickParcelResolution:
    """Tests for _resolve_pdok_cadastral_parcel_at_rd."""

    @patch("app.scans.helpers.transform_point_to_wgs84", return_value=(5.5, 51.5))
    @patch("app.scans.helpers.pdok_cadastral_client")
    async def test_contains_hit_returns_correct_parcel(self, mock_pdok, mock_transform):
        """Click point inside parcel A → returns parcel A."""
        from app.scans.helpers import _resolve_pdok_cadastral_parcel_at_rd

        mock_pdok.get_parcels_by_point = AsyncMock(
            return_value=[PARCEL_A, PARCEL_B, PARCEL_C],
        )
        db = _mock_db_session()

        result = await _resolve_pdok_cadastral_parcel_at_rd(
            x_rd=155005, y_rd=463005, db=db,
        )

        _assert_parcel_id(result, "A")

    @patch("app.scans.helpers.transform_point_to_wgs84", return_value=(5.5, 51.5))
    @patch("app.scans.helpers.pdok_cadastral_client")
    async def test_nearest_centroid_fallback_when_no_contains(self, mock_pdok, mock_transform):
        """Click point outside all parcels but closest to parcel A → returns A."""
        from app.scans.helpers import _resolve_pdok_cadastral_parcel_at_rd

        # Point at (155008, 462990) — 10m south of parcel A, further from B and C
        mock_pdok.get_parcels_by_point = AsyncMock(
            return_value=[PARCEL_A, PARCEL_B, PARCEL_C],
        )
        db = _mock_db_session()

        result = await _resolve_pdok_cadastral_parcel_at_rd(
            x_rd=155008, y_rd=462990, db=db,
        )

        _assert_parcel_id(result, "A")

    @patch("app.scans.helpers.transform_point_to_wgs84", return_value=(5.5, 51.5))
    @patch("app.scans.helpers.pdok_cadastral_client")
    async def test_nearest_fallback_picks_closest_not_first(self, mock_pdok, mock_transform):
        """Nearest parcel is last in list → proves order-independence."""
        from app.scans.helpers import _resolve_pdok_cadastral_parcel_at_rd

        # Point at (155048, 462990) — closest to parcel C (last in list)
        mock_pdok.get_parcels_by_point = AsyncMock(
            return_value=[PARCEL_A, PARCEL_B, PARCEL_C],
        )
        db = _mock_db_session()

        result = await _resolve_pdok_cadastral_parcel_at_rd(
            x_rd=155048, y_rd=462990, db=db,
        )

        _assert_parcel_id(result, "C")

    @patch("app.scans.helpers.transform_point_to_wgs84", return_value=(5.5, 51.5))
    @patch("app.scans.helpers.pdok_cadastral_client")
    async def test_single_feature_returned_as_fallback(self, mock_pdok, mock_transform):
        """Only 1 feature, point outside → returns it as nearest."""
        from app.scans.helpers import _resolve_pdok_cadastral_parcel_at_rd

        mock_pdok.get_parcels_by_point = AsyncMock(return_value=[PARCEL_B])
        db = _mock_db_session()

        result = await _resolve_pdok_cadastral_parcel_at_rd(
            x_rd=100000, y_rd=400000, db=db,
        )

        _assert_parcel_id(result, "B")

    @patch("app.scans.helpers.transform_point_to_wgs84", return_value=(5.5, 51.5))
    @patch("app.scans.helpers.pdok_cadastral_client")
    async def test_empty_features_returns_none(self, mock_pdok, mock_transform):
        """PDOK returns empty list → returns None."""
        from app.scans.helpers import _resolve_pdok_cadastral_parcel_at_rd

        mock_pdok.get_parcels_by_point = AsyncMock(return_value=[])
        db = _mock_db_session()

        result = await _resolve_pdok_cadastral_parcel_at_rd(
            x_rd=155005, y_rd=463005, db=db,
        )

        assert result is None

    @patch("app.scans.helpers.transform_point_to_wgs84", return_value=(5.5, 51.5))
    @patch("app.scans.helpers.pdok_cadastral_client")
    async def test_invalid_geometry_skipped(self, mock_pdok, mock_transform):
        """Features with bad/empty geometry skipped, valid one selected."""
        from app.scans.helpers import _resolve_pdok_cadastral_parcel_at_rd

        bad_feature_1 = {"geometry": {"type": "Polygon", "coordinates": "not-a-list"}, "properties": {}}
        bad_feature_2 = {"geometry": None, "properties": {}}
        bad_feature_3 = {"properties": {}}  # missing geometry key entirely
        mock_pdok.get_parcels_by_point = AsyncMock(
            return_value=[bad_feature_1, bad_feature_2, bad_feature_3, PARCEL_A],
        )
        db = _mock_db_session()

        result = await _resolve_pdok_cadastral_parcel_at_rd(
            x_rd=155005, y_rd=463005, db=db,
        )

        _assert_parcel_id(result, "A")

    @patch("app.scans.helpers.transform_point_to_wgs84", return_value=(5.5, 51.5))
    @patch("app.scans.helpers.pdok_cadastral_client")
    async def test_pdok_exception_returns_none(self, mock_pdok, mock_transform):
        """PDOK client raises exception → returns None."""
        from app.scans.helpers import _resolve_pdok_cadastral_parcel_at_rd

        mock_pdok.get_parcels_by_point = AsyncMock(side_effect=Exception("Connection timeout"))
        db = _mock_db_session()

        result = await _resolve_pdok_cadastral_parcel_at_rd(
            x_rd=155005, y_rd=463005, db=db,
        )

        assert result is None

    @patch("app.scans.helpers.transform_point_to_wgs84", return_value=(5.5, 51.5))
    @patch("app.scans.helpers.pdok_cadastral_client")
    async def test_all_invalid_geometries_returns_none(self, mock_pdok, mock_transform):
        """All features have broken geometry → returns None."""
        from app.scans.helpers import _resolve_pdok_cadastral_parcel_at_rd

        bad_features = [
            {"geometry": None, "properties": {}},
            {"geometry": {"type": "Invalid", "coordinates": []}, "properties": {}},
            {"geometry": {"type": "Polygon", "coordinates": "bad"}, "properties": {}},
            {"properties": {}},  # missing geometry
            "not-a-dict",  # not even a dict
        ]
        mock_pdok.get_parcels_by_point = AsyncMock(return_value=bad_features)
        db = _mock_db_session()

        result = await _resolve_pdok_cadastral_parcel_at_rd(
            x_rd=155005, y_rd=463005, db=db,
        )

        assert result is None

    @patch("app.scans.helpers.transform_point_to_wgs84", return_value=(5.5, 51.5))
    @patch("app.scans.helpers.pdok_cadastral_client")
    async def test_boundary_point_resolved(self, mock_pdok, mock_transform):
        """Point exactly on polygon edge → resolved via contains/touches or fallback."""
        from app.scans.helpers import _resolve_pdok_cadastral_parcel_at_rd

        # Point on the right edge of parcel A (155010, 463005)
        mock_pdok.get_parcels_by_point = AsyncMock(
            return_value=[PARCEL_A, PARCEL_B, PARCEL_C],
        )
        db = _mock_db_session()

        result = await _resolve_pdok_cadastral_parcel_at_rd(
            x_rd=155010, y_rd=463005, db=db,
        )

        # Should resolve to something (either via touches or nearest-centroid fallback)
        assert result is not None
        code = result.get("parcel_code", "")
        assert code.endswith("A") or code.endswith("B"), f"Expected A or B, got '{code}'"


# ---------------------------------------------------------------------------
# Tests for live reverse geocode in get_parcel_at_point (M035-S01)
# ---------------------------------------------------------------------------

_FAKE_PARCEL_ID = uuid.uuid4()


def _mock_at_point_db_session(
    x_rd: float = 155005.0,
    y_rd: float = 463005.0,
    address: str = "Houtstraat 15A",
) -> AsyncMock:
    """Build an AsyncSession mock that satisfies get_parcel_at_point's DB queries.

    Returns three sequential execute results:
      1. ST_X / ST_Y → RD coordinates
      2. _build_lookup_query → parcel row
      3. Organization score_weights → None
    """
    db = AsyncMock()

    # --- 1st call: ST_X / ST_Y ---
    rd_result = MagicMock()
    rd_result.mappings.return_value.one_or_none.return_value = {
        "x_rd": x_rd,
        "y_rd": y_rd,
    }

    # --- 2nd call: _build_lookup_query result (parcel row) ---
    parcel_row = {
        "parcel_id": _FAKE_PARCEL_ID,
        "centroid_wkt": "POINT(5.5 51.5)",
        "centroid_rd_wkt": f"POINT({x_rd} {y_rd})",
        "address": address,
        "parcel_code": "VNL00T-A-1234",
        "gemeente_code": "0983",
        "area_m2": 250.0,
        "has_pand": True,
        "bouwjaar": 1920,
        "pand_status": "Pand in gebruik",
        "bestemmingen": None,
        "has_report": False,
        "geometry_raw": None,
        "scan_score": None,
        "scan_flags": None,
    }
    lookup_result = MagicMock()
    lookup_result.mappings.return_value.one_or_none.return_value = parcel_row

    # --- 3rd call: Organization.score_weights ---
    org_result = MagicMock()
    org_result.scalar_one_or_none.return_value = None

    db.execute = AsyncMock(side_effect=[rd_result, lookup_result, org_result])
    return db


def _mock_request_with_http_client() -> MagicMock:
    """Build a mock request object with app.state.http_client as httpx.AsyncClient."""
    mock_client = MagicMock(spec=httpx.AsyncClient)
    mock_request = MagicMock()
    mock_request.app.state.http_client = mock_client
    return mock_request


@pytest.mark.asyncio
class TestGetParcelAtPointLiveGeocode:
    """Tests for live reverse geocode integration in get_parcel_at_point (M035-S01)."""

    @patch("app.scans.parcels_service._resolve_parcel_address_from_centroid", new_callable=AsyncMock)
    @patch("app.scans.parcels_service.reverse_geocode_rd_point", new_callable=AsyncMock)
    @patch("app.scans.parcels_service._resolve_pdok_cadastral_parcel_at_rd", new_callable=AsyncMock)
    async def test_at_point_uses_live_reverse_geocode_address(
        self, mock_pdok_resolve, mock_geocode, mock_centroid_resolve,
    ):
        """Live geocode result overrides cached ParcelCache address."""
        from app.scans.parcels_service import get_parcel_at_point

        mock_pdok_resolve.return_value = None  # skip PDOK parcel geometry path
        mock_geocode.return_value = "Houtstraat 13"
        mock_centroid_resolve.return_value = "Houtstraat 15A"

        db = _mock_at_point_db_session(address="Houtstraat 15A")
        request = _mock_request_with_http_client()

        result = await get_parcel_at_point(
            db=db, lng=5.5, lat=51.5,
            organization_id=uuid.uuid4(), request=request,
        )

        assert result.address == "Houtstraat 13"
        mock_geocode.assert_called_once()
        # Centroid fallback should NOT have been called
        mock_centroid_resolve.assert_not_called()

    @patch("app.scans.parcels_service._resolve_parcel_address_from_centroid", new_callable=AsyncMock)
    @patch("app.scans.parcels_service.reverse_geocode_rd_point", new_callable=AsyncMock)
    @patch("app.scans.parcels_service._resolve_pdok_cadastral_parcel_at_rd", new_callable=AsyncMock)
    async def test_at_point_falls_back_to_centroid_when_geocode_returns_none(
        self, mock_pdok_resolve, mock_geocode, mock_centroid_resolve,
    ):
        """When live geocode returns None, falls back to centroid address resolution."""
        from app.scans.parcels_service import get_parcel_at_point

        mock_pdok_resolve.return_value = None
        mock_geocode.return_value = None
        mock_centroid_resolve.return_value = "Houtstraat 15A"

        db = _mock_at_point_db_session(address="Houtstraat 15A")
        request = _mock_request_with_http_client()

        result = await get_parcel_at_point(
            db=db, lng=5.5, lat=51.5,
            organization_id=uuid.uuid4(), request=request,
        )

        assert result.address == "Houtstraat 15A"
        mock_geocode.assert_called_once()
        mock_centroid_resolve.assert_called_once()

    @patch("app.scans.parcels_service._resolve_parcel_address_from_centroid", new_callable=AsyncMock)
    @patch("app.scans.parcels_service.reverse_geocode_rd_point", new_callable=AsyncMock)
    @patch("app.scans.parcels_service._resolve_pdok_cadastral_parcel_at_rd", new_callable=AsyncMock)
    async def test_at_point_calls_geocode_with_click_rd_coords(
        self, mock_pdok_resolve, mock_geocode, mock_centroid_resolve,
    ):
        """Live geocode receives the click RD coordinates, not centroid."""
        from app.scans.parcels_service import get_parcel_at_point

        mock_pdok_resolve.return_value = None
        mock_geocode.return_value = "Kerkstraat 1"

        db = _mock_at_point_db_session(x_rd=160000.0, y_rd=470000.0)
        request = _mock_request_with_http_client()

        await get_parcel_at_point(
            db=db, lng=5.5, lat=51.5,
            organization_id=uuid.uuid4(), request=request,
        )

        # Assert called with the click RD coords as a tuple, and the http_client
        mock_geocode.assert_called_once()
        call_args = mock_geocode.call_args
        rd_point_arg = call_args[0][0] if call_args[0] else call_args[1].get("point_rd") or call_args[1].get(0)
        assert rd_point_arg == (160000.0, 470000.0), (
            f"Expected geocode called with (160000.0, 470000.0), got {rd_point_arg}"
        )

    @patch("app.scans.parcels_service._resolve_parcel_address_from_centroid", new_callable=AsyncMock)
    @patch("app.scans.parcels_service.reverse_geocode_rd_point", new_callable=AsyncMock)
    @patch("app.scans.parcels_service._resolve_pdok_cadastral_parcel_at_rd", new_callable=AsyncMock)
    async def test_at_point_no_request_falls_back_to_centroid(
        self, mock_pdok_resolve, mock_geocode, mock_centroid_resolve,
    ):
        """When request is None, live geocode is skipped; falls back to centroid."""
        from app.scans.parcels_service import get_parcel_at_point

        mock_pdok_resolve.return_value = None
        mock_centroid_resolve.return_value = "Fallback Addr"

        db = _mock_at_point_db_session()

        result = await get_parcel_at_point(
            db=db, lng=5.5, lat=51.5,
            organization_id=uuid.uuid4(), request=None,
        )

        assert result.address == "Fallback Addr"
        mock_geocode.assert_not_called()
        mock_centroid_resolve.assert_called_once()
