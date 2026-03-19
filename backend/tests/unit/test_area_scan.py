import pytest
from shapely.geometry import Polygon

from app.jobs.area_scan import (
    SCAN_RESULT_INSERT_BATCH_SIZE,
    BagSpatialIndex,
    _build_bag_spatial_index,
    _chunk_rows,
    _derive_bag_attributes_for_parcel,
)


class TestChunkRows:
    def test_splits_large_insert_payload_into_safe_batches(self):
        rows = list(range(SCAN_RESULT_INSERT_BATCH_SIZE + 123))

        batches = _chunk_rows(rows, SCAN_RESULT_INSERT_BATCH_SIZE)

        assert len(batches) == 2
        assert len(batches[0]) == SCAN_RESULT_INSERT_BATCH_SIZE
        assert len(batches[1]) == 123

    def test_rejects_non_positive_batch_size(self):
        try:
            _chunk_rows([1, 2, 3], 0)
        except ValueError as exc:
            assert "positive" in str(exc)
        else:
            raise AssertionError("Expected ValueError for invalid chunk size")


class TestDeriveBagAttributesForParcel:
    def test_returns_bag_representative_point_for_intersecting_building(self):
        parcel = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        building_inside = Polygon([(1, 1), (4, 1), (4, 4), (1, 4)])
        building_touching = Polygon([(10, 10), (12, 10), (12, 12), (10, 12)])
        bag_index = BagSpatialIndex(
            tree=None,  # unused by this test helper setup
            geometries=[building_inside, building_touching],
            bouwjaren=[1999, 2005],
            statuses=["Pand in gebruik", "Pand in gebruik"],
            representative_points=[
                (float(building_inside.representative_point().x), float(building_inside.representative_point().y)),
                (float(building_touching.representative_point().x), float(building_touching.representative_point().y)),
            ],
            identificaties=["0363100000000001", "0363100000000002"],
        )
        bag_index.tree = type(
            "FakeTree",
            (),
            {"query": staticmethod(lambda _geom: [0, 1])},
        )()

        has_pand, bouwjaar, pand_status, address_point, pand_oppervlakte_m2, bag_ids = _derive_bag_attributes_for_parcel(
            parcel,
            bag_index,
        )

        assert has_pand is True
        assert bouwjaar == 1999
        assert pand_status == "Pand in gebruik"
        assert address_point == bag_index.representative_points[0]
        assert pand_oppervlakte_m2 is not None
        assert pand_oppervlakte_m2 > 0

    def test_returns_none_when_no_building_intersects(self):
        parcel = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        building_outside = Polygon([(20, 20), (24, 20), (24, 24), (20, 24)])
        bag_index = BagSpatialIndex(
            tree=None,
            geometries=[building_outside],
            bouwjaren=[2001],
            statuses=["Pand in gebruik"],
            representative_points=[
                (float(building_outside.representative_point().x), float(building_outside.representative_point().y)),
            ],
            identificaties=["0363100000000001"],
        )
        bag_index.tree = type(
            "FakeTree",
            (),
            {"query": staticmethod(lambda _geom: [0])},
        )()

        has_pand, bouwjaar, pand_status, address_point, pand_oppervlakte_m2, bag_ids = _derive_bag_attributes_for_parcel(
            parcel,
            bag_index,
        )

        assert has_pand is False
        assert bouwjaar is None
        assert pand_status is None
        assert address_point is None
        assert pand_oppervlakte_m2 is None
        assert bag_ids == []

    def test_ignores_building_that_only_touches_boundary(self):
        parcel = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        building_touching = Polygon([(10, 10), (12, 10), (12, 12), (10, 12)])
        bag_index = BagSpatialIndex(
            tree=None,
            geometries=[building_touching],
            bouwjaren=[2001],
            statuses=["Pand in gebruik"],
            representative_points=[
                (float(building_touching.representative_point().x), float(building_touching.representative_point().y)),
            ],
            identificaties=["0363100000000001"],
        )
        bag_index.tree = type(
            "FakeTree",
            (),
            {"query": staticmethod(lambda _geom: [0])},
        )()

        has_pand, bouwjaar, pand_status, address_point, pand_oppervlakte_m2, bag_ids = _derive_bag_attributes_for_parcel(
            parcel,
            bag_index,
        )

        assert has_pand is False
        assert bouwjaar is None
        assert pand_status is None
        assert address_point is None
        assert pand_oppervlakte_m2 is None
        assert bag_ids == []

    def test_accumulates_total_footprint_from_multiple_buildings(self):
        parcel = Polygon([(0, 0), (20, 0), (20, 20), (0, 20)])
        # building_a: 6x6 = 36 m2 inside parcel (36/400 = 9% > 5% threshold)
        building_a = Polygon([(1, 1), (7, 1), (7, 7), (1, 7)])
        # building_b: 6x5 = 30 m2 inside parcel (30/400 = 7.5% > 5% threshold)
        building_b = Polygon([(10, 10), (16, 10), (16, 15), (10, 15)])
        bag_index = BagSpatialIndex(
            tree=None,
            geometries=[building_a, building_b],
            bouwjaren=[1985, 1990],
            statuses=["Pand in gebruik", "Pand in gebruik"],
            representative_points=[
                (float(building_a.representative_point().x), float(building_a.representative_point().y)),
                (float(building_b.representative_point().x), float(building_b.representative_point().y)),
            ],
            identificaties=["0363100000000001", "0363100000000002"],
        )
        bag_index.tree = type(
            "FakeTree",
            (),
            {"query": staticmethod(lambda _geom: [0, 1])},
        )()

        has_pand, bouwjaar, pand_status, address_point, pand_oppervlakte_m2, bag_ids = _derive_bag_attributes_for_parcel(
            parcel,
            bag_index,
        )

        assert has_pand is True
        assert pand_oppervlakte_m2 == pytest.approx(36 + 30, abs=1.0)


class TestDeriveBagAttributesIdentificaties:
    def test_returns_identificaties_for_intersecting_buildings(self):
        """Intersecting buildings' identificaties are collected in 6th return element."""
        parcel = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        building_a = Polygon([(1, 1), (4, 1), (4, 4), (1, 4)])
        building_b = Polygon([(5, 5), (8, 5), (8, 8), (5, 8)])
        bag_index = BagSpatialIndex(
            tree=None,
            geometries=[building_a, building_b],
            bouwjaren=[2000, 2010],
            statuses=["Pand in gebruik", "Pand in gebruik"],
            representative_points=[
                (float(building_a.representative_point().x), float(building_a.representative_point().y)),
                (float(building_b.representative_point().x), float(building_b.representative_point().y)),
            ],
            identificaties=["0363100000000001", "0363100000000002"],
        )
        bag_index.tree = type(
            "FakeTree",
            (),
            {"query": staticmethod(lambda _geom: [0, 1])},
        )()

        _, _, _, _, _, bag_ids = _derive_bag_attributes_for_parcel(parcel, bag_index)

        assert "0363100000000001" in bag_ids
        assert "0363100000000002" in bag_ids
        assert len(bag_ids) == 2

    def test_excludes_none_identificaties_from_result(self):
        """Features with None identificatie are not included in bag_identificaties."""
        parcel = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)])
        building = Polygon([(1, 1), (4, 1), (4, 4), (1, 4)])
        bag_index = BagSpatialIndex(
            tree=None,
            geometries=[building],
            bouwjaren=[2000],
            statuses=["Pand in gebruik"],
            representative_points=[
                (float(building.representative_point().x), float(building.representative_point().y)),
            ],
            identificaties=[None],
        )
        bag_index.tree = type(
            "FakeTree",
            (),
            {"query": staticmethod(lambda _geom: [0])},
        )()

        _, _, _, _, _, bag_ids = _derive_bag_attributes_for_parcel(parcel, bag_index)

        assert bag_ids == []

    def test_build_bag_spatial_index_stores_identificaties(self):
        """_build_bag_spatial_index extracts BAG pand identificatie from WFS features."""
        building_geom = Polygon([(1, 1), (4, 1), (4, 4), (1, 4)])
        features = [
            {
                "geometry": building_geom.__geo_interface__,
                "properties": {
                    "bouwjaar": 2000,
                    "status": "Pand in gebruik",
                    "identificatie": "0363100012345678",
                },
            },
            {
                "geometry": Polygon([(5, 5), (8, 5), (8, 8), (5, 8)]).__geo_interface__,
                "properties": {
                    "bouwjaar": 2010,
                    "status": "Pand in gebruik",
                    "identificatie": "0363100087654321",
                },
            },
        ]

        bag_index = _build_bag_spatial_index(features)

        assert bag_index is not None
        assert len(bag_index.identificaties) == 2
        assert "0363100012345678" in bag_index.identificaties
        assert "0363100087654321" in bag_index.identificaties
