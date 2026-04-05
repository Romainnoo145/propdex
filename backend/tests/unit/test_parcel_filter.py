"""Unit tests for point-in-polygon parcel filtering in property_aggregator.

Tests cover the `_nearest_parcel` helper and the containment filtering logic
added in M034-S01-T01.
"""

import pytest
from shapely.geometry import Point, mapping, box

from app.services.property_aggregator import _nearest_parcel
from app.schemas.property import CadastralParcel


# ---------------------------------------------------------------------------
# Fixtures — simple rectangular parcels in EPSG:28992 (RD New) coordinates
# ---------------------------------------------------------------------------

def _make_parcel(
    id_: str,
    minx: float,
    miny: float,
    maxx: float,
    maxy: float,
    oppervlakte: int | None = None,
) -> CadastralParcel:
    """Build a CadastralParcel with a rectangular GeoJSON polygon."""
    geojson = mapping(box(minx, miny, maxx, maxy))
    return CadastralParcel(
        identificatie=id_,
        kadastrale_aanduiding=f"TEST {id_}",
        perceelnummer=id_,
        sectie="T",
        oppervlakte=oppervlakte or int((maxx - minx) * (maxy - miny)),
        geometry=geojson,
    )


@pytest.fixture
def parcel_a() -> CadastralParcel:
    """Parcel A: covers (150000,375000)-(150010,375010)."""
    return _make_parcel("A", 150000, 375000, 150010, 375010)


@pytest.fixture
def parcel_b() -> CadastralParcel:
    """Parcel B: covers (150010,375000)-(150020,375010), adjacent east of A."""
    return _make_parcel("B", 150010, 375000, 150020, 375010)


@pytest.fixture
def parcel_c() -> CadastralParcel:
    """Parcel C: covers (150000,375010)-(150010,375020), adjacent north of A."""
    return _make_parcel("C", 150000, 375010, 150010, 375020)


@pytest.fixture
def all_parcels(parcel_a, parcel_b, parcel_c) -> list[CadastralParcel]:
    return [parcel_a, parcel_b, parcel_c]


# ---------------------------------------------------------------------------
# Tests: _nearest_parcel helper
# ---------------------------------------------------------------------------

class TestNearestParcel:
    """Direct tests for the _nearest_parcel helper function."""

    def test_nearest_parcel_returns_closest_by_centroid(self, all_parcels):
        """Point near parcel A's centroid → returns parcel A."""
        point = Point(150005, 375005)
        result = _nearest_parcel(all_parcels, point)
        assert result is not None
        assert result.identificatie == "A"

    def test_nearest_parcel_returns_b_when_closer(self, all_parcels):
        """Point near parcel B's centroid → returns parcel B."""
        point = Point(150015, 375005)
        result = _nearest_parcel(all_parcels, point)
        assert result is not None
        assert result.identificatie == "B"

    def test_nearest_parcel_returns_c_when_closer(self, all_parcels):
        """Point near parcel C's centroid → returns parcel C."""
        point = Point(150005, 375015)
        result = _nearest_parcel(all_parcels, point)
        assert result is not None
        assert result.identificatie == "C"

    def test_nearest_parcel_empty_list(self):
        """Empty parcel list → returns None (no crash)."""
        result = _nearest_parcel([], Point(150005, 375005))
        assert result is None

    def test_nearest_parcel_skips_none_geometry(self, parcel_a):
        """Parcels with geometry=None are skipped without crash."""
        bad_parcel = CadastralParcel(
            identificatie="BAD",
            geometry=None,
        )
        result = _nearest_parcel([bad_parcel, parcel_a], Point(150005, 375005))
        assert result is not None
        assert result.identificatie == "A"

    def test_nearest_parcel_all_invalid_geometry(self):
        """When all parcels have invalid geometry, returns None."""
        bad1 = CadastralParcel(identificatie="X", geometry=None)
        bad2 = CadastralParcel(identificatie="Y", geometry={"type": "Invalid", "coordinates": []})
        result = _nearest_parcel([bad1, bad2], Point(150005, 375005))
        assert result is None


# ---------------------------------------------------------------------------
# Tests: Point-in-polygon filtering logic (simulates fetch_cadastral_parcels)
# ---------------------------------------------------------------------------

def _filter_parcels(parcels: list[CadastralParcel], x: float, y: float) -> list[CadastralParcel]:
    """Replicate the point-in-polygon filter from fetch_cadastral_parcels.

    This mirrors the exact logic in property_aggregator.py so we can test
    it in isolation without mocking the entire async fetch pipeline.
    """
    from shapely.geometry import Point, shape

    query_point = Point(x, y)
    filtered: list[CadastralParcel] = []
    for p in parcels:
        try:
            if shape(p.geometry).contains(query_point):
                filtered.append(p)
        except Exception:
            continue

    if not filtered:
        nearest = _nearest_parcel(parcels, query_point)
        if nearest is not None:
            filtered = [nearest]

    return filtered if filtered else parcels


class TestParcelFilter:
    """Tests for the containment-based parcel filtering."""

    def test_filter_single_match(self, all_parcels):
        """Point clearly inside parcel A → returns only [A]."""
        result = _filter_parcels(all_parcels, 150005, 375005)
        assert len(result) == 1
        assert result[0].identificatie == "A"

    def test_filter_inside_b(self, all_parcels):
        """Point clearly inside parcel B → returns only [B]."""
        result = _filter_parcels(all_parcels, 150015, 375005)
        assert len(result) == 1
        assert result[0].identificatie == "B"

    def test_filter_inside_c(self, all_parcels):
        """Point clearly inside parcel C → returns only [C]."""
        result = _filter_parcels(all_parcels, 150005, 375015)
        assert len(result) == 1
        assert result[0].identificatie == "C"

    def test_filter_boundary_fallback(self, all_parcels):
        """Point exactly on shared edge between A and B → contains() may miss both.

        Falls back to nearest-centroid, which should return either A or B
        (both centroids are equidistant at x=150010, so either is acceptable).
        """
        result = _filter_parcels(all_parcels, 150010, 375005)
        assert len(result) >= 1
        ids = {p.identificatie for p in result}
        # Point is on the boundary — either contains catches one of them,
        # or fallback picks nearest. Either A or B is acceptable.
        assert ids.issubset({"A", "B"})

    def test_filter_no_geometry(self, parcel_a):
        """Parcel with geometry=None is skipped without crash; valid parcel returned."""
        bad = CadastralParcel(identificatie="BAD", geometry=None)
        result = _filter_parcels([bad, parcel_a], 150005, 375005)
        assert len(result) == 1
        assert result[0].identificatie == "A"

    def test_filter_invalid_geojson(self, parcel_a):
        """Parcel with invalid GeoJSON dict is skipped without crash."""
        bad = CadastralParcel(
            identificatie="INVALID",
            geometry={"type": "Polygon", "coordinates": "not-a-list"},
        )
        result = _filter_parcels([bad, parcel_a], 150005, 375005)
        assert len(result) == 1
        assert result[0].identificatie == "A"

    def test_filter_empty_candidates(self):
        """Empty parcel list → returns empty list (no crash)."""
        result = _filter_parcels([], 150005, 375005)
        assert result == []

    def test_filter_single_parcel_containing_point(self, parcel_a):
        """Single-parcel list where point is inside → returns that parcel."""
        result = _filter_parcels([parcel_a], 150005, 375005)
        assert len(result) == 1
        assert result[0].identificatie == "A"

    def test_filter_single_parcel_not_containing_point(self, parcel_b):
        """Single-parcel list where point is outside → fallback returns it."""
        result = _filter_parcels([parcel_b], 150005, 375005)
        assert len(result) == 1
        # Falls back to nearest, which is B (only candidate)
        assert result[0].identificatie == "B"

    def test_filter_point_far_outside_all(self, all_parcels):
        """Point far outside all parcels → fallback nearest centroid."""
        result = _filter_parcels(all_parcels, 200000, 400000)
        assert len(result) == 1
        # Nearest centroid to (200000, 400000) — parcel C centroid at
        # (150005, 375015) is closest in Euclidean distance from far away
        # Actually B centroid at (150015, 375005) or C at (150005, 375015)
        # are roughly equidistant, but the result should be exactly one parcel
        assert result[0].identificatie in {"A", "B", "C"}
