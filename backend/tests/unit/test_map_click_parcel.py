"""Unit tests for PDOK helper map-click parcel resolution.

Tests cover the `_resolve_pdok_cadastral_parcel_at_rd()` function in
`app.scans.helpers`, verifying point-in-polygon containment and the
nearest-centroid fallback introduced in M034-S02-T01.

All tests use synthetic GeoJSON features with RD coordinates so that
`_geometry_looks_wgs84()` returns False and the function uses the
RD click point for containment / centroid comparisons.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

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
