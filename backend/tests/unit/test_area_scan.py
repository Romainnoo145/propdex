from shapely.geometry import Polygon

from app.jobs.area_scan import (
    SCAN_RESULT_INSERT_BATCH_SIZE,
    BagSpatialIndex,
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
        )
        bag_index.tree = type(
            "FakeTree",
            (),
            {"query": staticmethod(lambda _geom: [0, 1])},
        )()

        has_pand, bouwjaar, pand_status, address_point = _derive_bag_attributes_for_parcel(
            parcel,
            bag_index,
        )

        assert has_pand is True
        assert bouwjaar == 1999
        assert pand_status == "Pand in gebruik"
        assert address_point == bag_index.representative_points[0]

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
        )
        bag_index.tree = type(
            "FakeTree",
            (),
            {"query": staticmethod(lambda _geom: [0])},
        )()

        has_pand, bouwjaar, pand_status, address_point = _derive_bag_attributes_for_parcel(
            parcel,
            bag_index,
        )

        assert has_pand is False
        assert bouwjaar is None
        assert pand_status is None
        assert address_point is None

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
        )
        bag_index.tree = type(
            "FakeTree",
            (),
            {"query": staticmethod(lambda _geom: [0])},
        )()

        has_pand, bouwjaar, pand_status, address_point = _derive_bag_attributes_for_parcel(
            parcel,
            bag_index,
        )

        assert has_pand is False
        assert bouwjaar is None
        assert pand_status is None
        assert address_point is None
