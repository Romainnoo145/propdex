"""Tests for zoning aggregator helper functions."""

from unittest.mock import MagicMock

import pytest
from shapely.geometry import Point, Polygon

from app.schemas.zoning import BuildingDimensions
from app.services.zoning_aggregator import (
    _extract_building_dimensions,
    _filter_and_sort_plans,
    _find_containing_features,
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
            ("vloeroppervlakte", "500", "max_floor_area_ratio", 500.0),
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

    def test_first_matching_value_wins(self):
        """First matching value should win, subsequent ignored per is None guard."""
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
        assert result.max_bouwhoogte == 10.0  # First value

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

    def test_no_matching_status_returns_empty(self):
        """If no plans match vastgesteld or ontwerp, return empty."""
        plans = [
            {"identificatie": "plan1", "planStatus": "ingetrokken", "datum": "2023-01-01"},
            {"identificatie": "plan2", "planStatus": "vervallen", "datum": "2023-06-01"},
        ]

        result = _filter_and_sort_plans(plans)
        assert result == []
