"""Tests for zoning aggregator helper functions."""

from unittest.mock import MagicMock

import pytest
from shapely.geometry import Point, Polygon

from app.schemas.zoning import BuildingDimensions
from app.services.zoning_aggregator import (
    _extract_building_dimensions,
    _extract_dimensions_from_plan_texts,
    _extract_dimensions_from_plu,
    _filter_and_sort_plans,
    _find_containing_features,
    _merge_building_dimensions,
)


class TestFindContainingFeatures:
    """Test spatial filtering of features."""

    def test_point_inside_polygon_returns_feature(self):
        """Point inside polygon should return the feature."""
        property_point = Point(50, 50)
        polygon = Polygon([[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]])
        features = [
            {
                "naam": "TestFeature",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _find_containing_features(property_point, features)
        assert len(result) == 1
        assert result[0]["naam"] == "TestFeature"

    def test_point_outside_polygon_returns_empty(self):
        """Point outside polygon should return empty list."""
        property_point = Point(200, 200)
        features = [
            {
                "naam": "TestFeature",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _find_containing_features(property_point, features)
        assert result == []

    def test_point_on_boundary_returns_feature(self):
        """Point on polygon boundary should return feature (intersects=True)."""
        property_point = Point(100, 50)  # On right edge
        features = [
            {
                "naam": "TestFeature",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _find_containing_features(property_point, features)
        assert len(result) == 1
        assert result[0]["naam"] == "TestFeature"

    def test_multiple_features_only_containing_returned(self):
        """With multiple features, only containing ones should be returned."""
        property_point = Point(50, 50)
        features = [
            {
                "naam": "ContainingFeature",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            },
            {
                "naam": "NonContainingFeature",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[200, 200], [300, 200], [300, 300], [200, 300], [200, 200]]],
                },
            },
        ]

        result = _find_containing_features(property_point, features)
        assert len(result) == 1
        assert result[0]["naam"] == "ContainingFeature"

    def test_missing_geometry_key_skipped(self):
        """Feature with missing geometry key should be skipped without error."""
        property_point = Point(50, 50)
        features = [
            {"naam": "NoGeometry"},
            {
                "naam": "HasGeometry",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            },
        ]

        result = _find_containing_features(property_point, features)
        assert len(result) == 1
        assert result[0]["naam"] == "HasGeometry"

    def test_invalid_geometry_data_skipped(self):
        """Feature with invalid geometry data should be skipped with warning."""
        property_point = Point(50, 50)
        features = [
            {
                "naam": "InvalidGeometry",
                "geometrie": {"type": "InvalidType", "coordinates": "not-valid"},
            },
            {
                "naam": "ValidGeometry",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            },
        ]

        result = _find_containing_features(property_point, features)
        assert len(result) == 1
        assert result[0]["naam"] == "ValidGeometry"

    def test_empty_features_list_returns_empty(self):
        """Empty features list should return empty list."""
        property_point = Point(50, 50)
        result = _find_containing_features(property_point, [])
        assert result == []

    def test_custom_geometry_key_works(self):
        """Custom geometry_key parameter should work."""
        property_point = Point(50, 50)
        features = [
            {
                "naam": "TestFeature",
                "geometry": {  # Note: "geometry" instead of "geometrie"
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _find_containing_features(property_point, features, geometry_key="geometry")
        assert len(result) == 1
        assert result[0]["naam"] == "TestFeature"


class TestExtractBuildingDimensions:
    """Test building dimension extraction from maatvoeringen."""

    @pytest.mark.parametrize(
        "naam,waarde,expected_field,expected_value",
        [
            ("bouwhoogte", "12.5", "max_bouwhoogte", 12.5),
            ("max bouwhoogte", "10 meter", "max_bouwhoogte", 10.0),
            ("goothoogte", "8.0", "max_goothoogte", 8.0),
            ("bebouwingspercentage", "60", "max_bebouwingspercentage", 60.0),
            ("bebouwingspercentage", "45%", "max_bebouwingspercentage", 45.0),
            ("hoogte", "15", "max_hoogte", 15.0),
            ("fsi", "2.5", "max_floor_area_ratio", 2.5),
            ("vloerfactor", "1.8", "max_floor_area_ratio", 1.8),
        ],
    )
    def test_dimension_field_mapping(self, naam, waarde, expected_field, expected_value):
        """Test Dutch field name to schema field mapping."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": naam,
                "waarde": waarde,
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert getattr(result, expected_field) == expected_value

    def test_empty_maatvoeringen_returns_empty_dimensions(self):
        """Empty maatvoeringen should return BuildingDimensions with all None."""
        property_point = Point(50, 50)
        result = _extract_building_dimensions([], property_point)

        assert result.max_hoogte is None
        assert result.max_bouwhoogte is None
        assert result.max_goothoogte is None
        assert result.max_bebouwingspercentage is None
        assert result.max_floor_area_ratio is None
        assert result.has_any_data is False

    def test_maatvoeringen_outside_property_excluded(self):
        """Maatvoeringen outside property point should be excluded (spatial filtering)."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": "bouwhoogte",
                "waarde": "12.5",
                "geometrie": {
                    "type": "Polygon",
                    # Polygon far away from property point
                    "coordinates": [[[200, 200], [300, 200], [300, 300], [200, 300], [200, 200]]],
                },
            }
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert result.max_bouwhoogte is None
        assert result.has_any_data is False

    def test_non_numeric_waarde_skipped(self):
        """Non-numeric waarde should be skipped gracefully."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": "bouwhoogte",
                "waarde": "geen waarde",  # No numbers
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            },
            {
                "naam": "goothoogte",
                "waarde": "8.0",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            },
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert result.max_bouwhoogte is None  # Skipped
        assert result.max_goothoogte == 8.0  # Extracted

    def test_highest_matching_value_wins(self):
        """Highest matching value should be kept across overlapping maatvoeringen."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": "bouwhoogte",
                "waarde": "10.0",
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            },
            {
                "naam": "bouwhoogte",
                "waarde": "15.0",  # Should be ignored
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            },
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert result.max_bouwhoogte == 15.0

    def test_extracts_tar_far_from_maatvoering_text_payload(self):
        """Tar/Far may be encoded in free-text maatvoering payload fields."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": "maatvoering",
                "maatvoering": '"maximum bebouwingspercentage terrein (%)"="70"',
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            },
            {
                "naam": "maatvoering",
                "maatvoering": '"maximum FSI"="2,4"',
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            },
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert result.max_bebouwingspercentage == 70.0
        assert result.max_floor_area_ratio == 2.4

    def test_extracts_tar_far_from_plan_texts(self):
        """Plan articles can provide TAR/FAR when maatvoeringen are absent."""
        teksten_raw = [
            {
                "titel": "Artikel 3.2.1",
                "tekst": "Het bebouwingspercentage bedraagt maximaal 60%.",
            },
            {
                "titel": "Artikel 3.2.2",
                "tekst": "De FAR is maximaal 1,6 voor dit bouwvlak.",
            },
        ]

        result = _extract_dimensions_from_plan_texts(teksten_raw)
        assert result.max_bebouwingspercentage == 60.0
        assert result.max_floor_area_ratio == 1.6

    def test_extracts_tar_far_from_plu_fallback(self):
        """PLU fallback should map explicit TAR/FAR fields into dimensions."""
        bestemmingen = [
            {
                "type": "Wonen",
                "naam": "Wonen",
                "max_bebouwingspercentage": 55,
                "max_floor_area_ratio": 1.4,
            }
        ]
        result = _extract_dimensions_from_plu(bestemmingen)
        assert result.max_bebouwingspercentage == 55.0
        assert result.max_floor_area_ratio == 1.4

    def test_numeric_waarde_not_parsed(self):
        """Numeric waarde (not string) should work directly."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": "bouwhoogte",
                "waarde": 12.5,  # Already numeric
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert result.max_bouwhoogte == 12.5

    def test_bouwlagen_extracted_from_maatvoeringen(self):
        """Maatvoering with 'maximum bouwlagen' naam and waarde=4 extracts max_bouwlagen=4."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": "maximum bouwlagen",
                "waarde": 4,
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert result.max_bouwlagen == 4

    def test_bouwlaag_synonym_extracted(self):
        """Maatvoering with 'max. bouwlaag' naam and waarde=3 extracts max_bouwlagen=3."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": "max. bouwlaag",
                "waarde": 3,
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert result.max_bouwlagen == 3

    def test_verdieping_synonym_extracted(self):
        """Maatvoering with 'aantal verdiepingen' naam and waarde=2 extracts max_bouwlagen=2."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": "aantal verdiepingen",
                "waarde": 2,
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert result.max_bouwlagen == 2

    def test_bouwlagen_float_rounded(self):
        """Maatvoering with waarde=3.7 rounds to max_bouwlagen=4."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": "maximum bouwlagen",
                "waarde": 3.7,
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert result.max_bouwlagen == 4

    def test_bouwlagen_out_of_range_ignored(self):
        """Maatvoering with waarde=100 (>50) is ignored, max_bouwlagen remains None."""
        property_point = Point(50, 50)
        maatvoeringen = [
            {
                "naam": "maximum bouwlagen",
                "waarde": 100,
                "geometrie": {
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
                },
            }
        ]

        result = _extract_building_dimensions(maatvoeringen, property_point)
        assert result.max_bouwlagen is None


class TestMergeBuildingDimensions:
    """Test merging of BuildingDimensions including bouwlagen."""

    def test_merge_building_dimensions_bouwlagen(self):
        """Merging two BuildingDimensions with bouwlagen 3 and 5 yields max_bouwlagen=5."""
        dim_a = BuildingDimensions(max_bouwlagen=3)
        dim_b = BuildingDimensions(max_bouwlagen=5)
        merged = _merge_building_dimensions(dim_a, dim_b)
        assert merged is not None
        assert merged.max_bouwlagen == 5

    def test_merge_bouwlagen_none_plus_value(self):
        """Merging None bouwlagen with a value yields that value."""
        dim_a = BuildingDimensions(max_bouwhoogte=10.0)
        dim_b = BuildingDimensions(max_bouwlagen=4)
        merged = _merge_building_dimensions(dim_a, dim_b)
        assert merged is not None
        assert merged.max_bouwlagen == 4
        assert merged.max_bouwhoogte == 10.0


class TestFilterAndSortPlans:
    """Test plan filtering and sorting logic."""

    def test_vastgesteld_plans_kept_others_filtered(self):
        """Plans with vastgesteld status should be kept, others filtered out."""
        plans = [
            {"identificatie": "plan1", "planStatus": "vastgesteld", "datum": "2023-01-01"},
            {"identificatie": "plan2", "planStatus": "ontwerp", "datum": "2023-06-01"},
            {"identificatie": "plan3", "planStatus": "vastgesteld", "datum": "2023-03-01"},
        ]

        result = _filter_and_sort_plans(plans)
        assert len(result) == 2
        assert all(p["planStatus"] == "vastgesteld" for p in result)

    def test_plans_sorted_by_datum_descending(self):
        """Plans should be sorted by datum descending (newest first)."""
        plans = [
            {"identificatie": "plan1", "planStatus": "vastgesteld", "datum": "2023-01-01"},
            {"identificatie": "plan2", "planStatus": "vastgesteld", "datum": "2023-06-01"},
            {"identificatie": "plan3", "planStatus": "vastgesteld", "datum": "2023-03-01"},
        ]

        result = _filter_and_sort_plans(plans)
        assert result[0]["datum"] == "2023-06-01"
        assert result[1]["datum"] == "2023-03-01"
        assert result[2]["datum"] == "2023-01-01"

    def test_fallback_to_ontwerp_when_no_vastgesteld(self):
        """If no vastgesteld plans, should fall back to ontwerp plans."""
        plans = [
            {"identificatie": "plan1", "planStatus": "ontwerp", "datum": "2023-01-01"},
            {"identificatie": "plan2", "planStatus": "ontwerp", "datum": "2023-06-01"},
        ]

        result = _filter_and_sort_plans(plans)
        assert len(result) == 2
        assert all(p["planStatus"] == "ontwerp" for p in result)

    def test_missing_datum_sorts_correctly(self):
        """Plans with missing datum should sort correctly (empty string)."""
        plans = [
            {"identificatie": "plan1", "planStatus": "vastgesteld", "datum": "2023-06-01"},
            {"identificatie": "plan2", "planStatus": "vastgesteld"},  # Missing datum
            {"identificatie": "plan3", "planStatus": "vastgesteld", "datum": "2023-01-01"},
        ]

        result = _filter_and_sort_plans(plans)
        # Plans with dates should come first, then empty
        assert result[0]["datum"] == "2023-06-01"
        assert result[1]["datum"] == "2023-01-01"
        assert result[2].get("datum") in [None, ""]

    def test_empty_plan_list_returns_empty(self):
        """Empty plan list should return empty list."""
        result = _filter_and_sort_plans([])
        assert result == []

    def test_mixed_case_plan_status_handled(self):
        """Mixed case planStatus should be handled (lowered comparison)."""
        plans = [
            {"identificatie": "plan1", "planStatus": "Vastgesteld", "datum": "2023-01-01"},
            {"identificatie": "plan2", "planStatus": "VASTGESTELD", "datum": "2023-06-01"},
            {"identificatie": "plan3", "planStatus": "ontwerp", "datum": "2023-03-01"},
        ]

        result = _filter_and_sort_plans(plans)
        assert len(result) == 2
        assert result[0]["planStatus"] == "VASTGESTELD"
        assert result[1]["planStatus"] == "Vastgesteld"

    def test_no_matching_status_falls_back_to_all_plans(self):
        """If no plans match vastgesteld/ontwerp, keep all plans as fallback."""
        plans = [
            {"identificatie": "plan1", "planStatus": "ingetrokken", "datum": "2023-01-01"},
            {"identificatie": "plan2", "planStatus": "vervallen", "datum": "2023-06-01"},
        ]

        result = _filter_and_sort_plans(plans)
        assert len(result) == 2
        assert result[0]["identificatie"] == "plan2"
        assert result[1]["identificatie"] == "plan1"
