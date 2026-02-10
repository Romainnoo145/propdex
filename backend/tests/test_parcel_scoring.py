"""Unit tests for parcel opportunity scoring service."""

from datetime import datetime, timedelta

from app.services.parcel_scoring import (
    SCORING_WEIGHTS,
    ScoreBreakdown,
    compute_opportunity_score,
)


class MockParcelData:
    """Mock parcel data object for testing scoring function."""

    def __init__(
        self,
        has_pand: bool = False,
        area_m2: float | None = None,
        bestemmingen: list | None = None,
        enrichment_data: dict | None = None,
    ):
        self.has_pand = has_pand
        self.area_m2 = area_m2
        self.bestemmingen = bestemmingen if bestemmingen is not None else []
        self.enrichment_data = enrichment_data


def test_scoring_weights_exist():
    """Test that SCORING_WEIGHTS is exported for documentation."""
    assert isinstance(SCORING_WEIGHTS, dict)
    assert "vacant_land" in SCORING_WEIGHTS
    assert "size_optimal" in SCORING_WEIGHTS
    assert "zoning_residential" in SCORING_WEIGHTS
    assert "recent_permits" in SCORING_WEIGHTS


def test_perfect_score():
    """Vacant + optimal size (1000m²) + Wonen + 3 permits → High (100)."""
    # Create enrichment_data with 3 recent permits
    now = datetime.utcnow()
    enrichment_data = {
        "vergunningen": [
            {"publicatiedatum": (now - timedelta(days=30)).strftime("%Y-%m-%d")},
            {"publicatiedatum": (now - timedelta(days=180)).strftime("%Y-%m-%d")},
            {"publicatiedatum": (now - timedelta(days=365)).strftime("%Y-%m-%d")},
        ]
    }

    parcel = MockParcelData(
        has_pand=False,
        area_m2=1000.0,
        bestemmingen=[{"type": "Wonen", "naam": "Wonen - 1"}],
        enrichment_data=enrichment_data,
    )

    result = compute_opportunity_score(parcel)

    assert isinstance(result, ScoreBreakdown)
    assert result.total_score == 100.0
    assert result.category == "High"
    assert result.factors["vacant_land"] == 30.0
    assert result.factors["size_optimal"] == 25.0
    assert result.factors["zoning_residential"] == 25.0
    assert result.factors["recent_permits"] == 20.0


def test_high_score_no_permits():
    """Vacant + optimal size + Wonen + 0 permits → High (80)."""
    parcel = MockParcelData(
        has_pand=False,
        area_m2=1000.0,
        bestemmingen=[{"type": "Wonen", "naam": "Wonen - 1"}],
        enrichment_data=None,
    )

    result = compute_opportunity_score(parcel)

    assert result.total_score == 80.0
    assert result.category == "High"
    assert result.factors["vacant_land"] == 30.0
    assert result.factors["size_optimal"] == 25.0
    assert result.factors["zoning_residential"] == 25.0
    assert result.factors["recent_permits"] == 0.0


def test_medium_score_no_zoning():
    """Vacant + optimal size + no Wonen + 0 permits → Medium (55)."""
    parcel = MockParcelData(
        has_pand=False,
        area_m2=1000.0,
        bestemmingen=[{"type": "Bedrijven", "naam": "Bedrijven - 1"}],
        enrichment_data=None,
    )

    result = compute_opportunity_score(parcel)

    assert result.total_score == 55.0
    assert result.category == "Medium"
    assert result.factors["vacant_land"] == 30.0
    assert result.factors["size_optimal"] == 25.0
    assert result.factors["zoning_residential"] == 0.0
    assert result.factors["recent_permits"] == 0.0


def test_low_score_has_pand_small():
    """Has pand + small (200m²) + no Wonen + 0 permits → Low (5)."""
    parcel = MockParcelData(
        has_pand=True,
        area_m2=200.0,
        bestemmingen=[{"type": "Bedrijven", "naam": "Bedrijven - 1"}],
        enrichment_data=None,
    )

    result = compute_opportunity_score(parcel)

    assert result.total_score == 5.0
    assert result.category == "Low"
    assert result.factors["vacant_land"] == 0.0
    assert result.factors["size_optimal"] == 5.0
    assert result.factors["zoning_residential"] == 0.0
    assert result.factors["recent_permits"] == 0.0


def test_medium_score_large_parcel_one_permit():
    """Vacant + large (5000m²) + Wonen + 1 permit → High (70) - at threshold."""
    now = datetime.utcnow()
    enrichment_data = {
        "vergunningen": [
            {"publicatiedatum": (now - timedelta(days=100)).strftime("%Y-%m-%d")},
        ]
    }

    parcel = MockParcelData(
        has_pand=False,
        area_m2=5000.0,
        bestemmingen=[{"type": "Wonen", "naam": "Wonen - 1"}],
        enrichment_data=enrichment_data,
    )

    result = compute_opportunity_score(parcel)

    # Actual math: 30 (vacant) + 5 (large size) + 25 (wonen) + 10 (1 permit) = 70
    assert result.total_score == 70.0
    assert result.category == "High"
    assert result.factors["vacant_land"] == 30.0
    assert result.factors["size_optimal"] == 5.0
    assert result.factors["zoning_residential"] == 25.0
    assert result.factors["recent_permits"] == 10.0


def test_none_area_m2():
    """None values for area_m2 → size_optimal defaults to 0."""
    parcel = MockParcelData(
        has_pand=False,
        area_m2=None,
        bestemmingen=[{"type": "Wonen", "naam": "Wonen - 1"}],
        enrichment_data=None,
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["size_optimal"] == 0.0
    # Total = 30 (vacant) + 0 (size) + 25 (wonen) + 0 (permits) = 55
    assert result.total_score == 55.0


def test_empty_bestemmingen_list():
    """Empty bestemmingen list → zoning_residential = 0."""
    parcel = MockParcelData(
        has_pand=False,
        area_m2=1000.0,
        bestemmingen=[],
        enrichment_data=None,
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["zoning_residential"] == 0.0
    # Total = 30 (vacant) + 25 (size) + 0 (zoning) + 0 (permits) = 55
    assert result.total_score == 55.0


def test_none_enrichment_data():
    """None enrichment_data → recent_permits = 0."""
    parcel = MockParcelData(
        has_pand=False,
        area_m2=1000.0,
        bestemmingen=[{"type": "Wonen", "naam": "Wonen - 1"}],
        enrichment_data=None,
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["recent_permits"] == 0.0


def test_all_factors_present_in_breakdown():
    """Factors dict always contains all 4 keys even when value is 0."""
    parcel = MockParcelData(
        has_pand=True,
        area_m2=100.0,
        bestemmingen=[],
        enrichment_data=None,
    )

    result = compute_opportunity_score(parcel)

    # All 4 factor keys must be present
    assert set(result.factors.keys()) == {
        "vacant_land",
        "size_optimal",
        "zoning_residential",
        "recent_permits",
    }


def test_optimal_size_mid_range():
    """Test optimal size scoring at 500m² lower boundary."""
    parcel = MockParcelData(
        has_pand=False,
        area_m2=500.0,
        bestemmingen=[],
        enrichment_data=None,
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["size_optimal"] == 25.0


def test_suboptimal_size_low_range():
    """Test suboptimal size scoring at 400m² (300-500 range)."""
    parcel = MockParcelData(
        has_pand=False,
        area_m2=400.0,
        bestemmingen=[],
        enrichment_data=None,
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["size_optimal"] == 15.0


def test_suboptimal_size_high_range():
    """Test suboptimal size scoring at 2500m² (2000-3000 range)."""
    parcel = MockParcelData(
        has_pand=False,
        area_m2=2500.0,
        bestemmingen=[],
        enrichment_data=None,
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["size_optimal"] == 15.0


def test_recent_permits_boundary_3_years():
    """Test permits exactly at 3-year boundary are excluded."""
    now = datetime.utcnow()
    enrichment_data = {
        "vergunningen": [
            # Exactly 3 years + 1 day ago should be excluded
            {"publicatiedatum": (now - timedelta(days=1096)).strftime("%Y-%m-%d")},
        ]
    }

    parcel = MockParcelData(
        has_pand=False,
        area_m2=1000.0,
        bestemmingen=[],
        enrichment_data=enrichment_data,
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["recent_permits"] == 0.0


def test_two_recent_permits():
    """Test 2 recent permits → 10 points."""
    now = datetime.utcnow()
    enrichment_data = {
        "vergunningen": [
            {"publicatiedatum": (now - timedelta(days=30)).strftime("%Y-%m-%d")},
            {"publicatiedatum": (now - timedelta(days=180)).strftime("%Y-%m-%d")},
        ]
    }

    parcel = MockParcelData(
        has_pand=False,
        area_m2=1000.0,
        bestemmingen=[],
        enrichment_data=enrichment_data,
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["recent_permits"] == 10.0
