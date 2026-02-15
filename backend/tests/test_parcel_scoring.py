"""Unit tests for parcel opportunity scoring service (5-factor model)."""

from app.services.parcel_scoring import (
    QUALIFICATION_THRESHOLD,
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
        pand_status: str = "",
        bouwjaar: int | None = None,
    ):
        self.has_pand = has_pand
        self.area_m2 = area_m2
        self.bestemmingen = bestemmingen if bestemmingen is not None else []
        self.pand_status = pand_status
        self.bouwjaar = bouwjaar


def test_scoring_weights_exist():
    """Test that SCORING_WEIGHTS contains all 5 factors."""
    assert isinstance(SCORING_WEIGHTS, dict)
    assert "pand_status_signal" in SCORING_WEIGHTS
    assert "building_age" in SCORING_WEIGHTS
    assert "zoning_value" in SCORING_WEIGHTS
    assert "footprint_size" in SCORING_WEIGHTS
    assert "underutilization" in SCORING_WEIGHTS


def test_qualification_threshold():
    """Test that QUALIFICATION_THRESHOLD is 40."""
    assert QUALIFICATION_THRESHOLD == 40.0


def test_prime_opportunity():
    """1960s vacant warehouse, 2500m², Gemengd → ~90 (High)."""
    parcel = MockParcelData(
        has_pand=True,
        area_m2=2500.0,
        bestemmingen=[{"type": "Gemengd", "naam": "Gemengd - 1"}],
        pand_status="Niet in gebruik",
        bouwjaar=1960,
    )

    result = compute_opportunity_score(parcel)

    assert isinstance(result, ScoreBreakdown)
    assert result.factors["pand_status_signal"] == 30.0
    assert result.factors["building_age"] == 15.0
    assert result.factors["zoning_value"] == 25.0
    assert result.factors["footprint_size"] == 12.0
    assert result.factors["underutilization"] == 10.0  # vacant+large+vacant+old+old+large capped
    assert result.total_score == 92.0
    assert result.category == "High"


def test_modern_house_in_use():
    """Modern house in use, 300m², Wonen → 29 (Low) — correctly filtered out."""
    parcel = MockParcelData(
        has_pand=True,
        area_m2=300.0,
        bestemmingen=[{"type": "Wonen", "naam": "Wonen - 1"}],
        pand_status="Pand in gebruik",
        bouwjaar=2015,
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["pand_status_signal"] == 0.0
    assert result.factors["building_age"] == 0.0
    assert result.factors["zoning_value"] == 20.0
    assert result.factors["footprint_size"] == 4.0
    assert result.factors["underutilization"] == 0.0
    assert result.total_score == 24.0
    assert result.category == "Low"


def test_borderline_medium():
    """1935 building in use, 800m², Wonen → ~49 (Medium)."""
    parcel = MockParcelData(
        has_pand=True,
        area_m2=800.0,
        bestemmingen=[{"type": "Wonen", "naam": "Wonen - 1"}],
        pand_status="Pand in gebruik",
        bouwjaar=1935,
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["pand_status_signal"] == 0.0
    assert result.factors["building_age"] == 20.0
    assert result.factors["zoning_value"] == 20.0
    assert result.factors["footprint_size"] == 7.0
    assert result.factors["underutilization"] == 0.0
    assert result.total_score == 47.0
    assert result.category == "Medium"


def test_sloopvergunning_max_status():
    """Sloopvergunning → 30 points."""
    parcel = MockParcelData(
        pand_status="Sloopvergunning verleend",
        area_m2=500.0,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["pand_status_signal"] == 30.0


def test_buiten_gebruik_status():
    """Buiten gebruik → 25 points."""
    parcel = MockParcelData(
        pand_status="Pand buiten gebruik",
        area_m2=500.0,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["pand_status_signal"] == 25.0


def test_bouwvergunning_status():
    """Bouwvergunning → 20 points."""
    parcel = MockParcelData(
        pand_status="Bouwvergunning verleend",
        area_m2=500.0,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["pand_status_signal"] == 20.0


def test_verbouwing_status():
    """Verbouwing → 10 points."""
    parcel = MockParcelData(
        pand_status="Verbouwing",
        area_m2=500.0,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["pand_status_signal"] == 10.0


def test_in_gebruik_status():
    """Pand in gebruik → 0 points."""
    parcel = MockParcelData(
        pand_status="Pand in gebruik",
        area_m2=500.0,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["pand_status_signal"] == 0.0


def test_unknown_status():
    """Unknown/empty status → 15 points (benefit of the doubt)."""
    parcel = MockParcelData(
        pand_status="",
        area_m2=500.0,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["pand_status_signal"] == 15.0


def test_building_age_pre_1940():
    """Pre-1940 → 20 points."""
    parcel = MockParcelData(bouwjaar=1920, area_m2=500.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["building_age"] == 20.0


def test_building_age_1940_1970():
    """1940-1970 → 15 points."""
    parcel = MockParcelData(bouwjaar=1955, area_m2=500.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["building_age"] == 15.0


def test_building_age_1970_1990():
    """1970-1990 → 10 points."""
    parcel = MockParcelData(bouwjaar=1980, area_m2=500.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["building_age"] == 10.0


def test_building_age_1990_2010():
    """1990-2010 → 5 points."""
    parcel = MockParcelData(bouwjaar=2005, area_m2=500.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["building_age"] == 5.0


def test_building_age_2010_plus():
    """2010+ → 0 points."""
    parcel = MockParcelData(bouwjaar=2020, area_m2=500.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["building_age"] == 0.0


def test_building_age_unknown():
    """Unknown bouwjaar → 10 points."""
    parcel = MockParcelData(bouwjaar=None, area_m2=500.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["building_age"] == 10.0


def test_zoning_gemengd():
    """Gemengd → 25 points."""
    parcel = MockParcelData(
        bestemmingen=[{"type": "Gemengd", "naam": "Gemengd - 1"}],
        area_m2=500.0,
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["zoning_value"] == 25.0


def test_zoning_centrum():
    """Centrum → 25 points."""
    parcel = MockParcelData(
        bestemmingen=[{"type": "Centrum", "naam": "Centrum - 1"}],
        area_m2=500.0,
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["zoning_value"] == 25.0


def test_zoning_wonen():
    """Wonen → 20 points."""
    parcel = MockParcelData(
        bestemmingen=[{"type": "Wonen", "naam": "Wonen - 1"}],
        area_m2=500.0,
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["zoning_value"] == 20.0


def test_zoning_maatschappelijk():
    """Maatschappelijk → 15 points."""
    parcel = MockParcelData(
        bestemmingen=[{"type": "Maatschappelijk", "naam": "Maatschappelijk - 1"}],
        area_m2=500.0,
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["zoning_value"] == 15.0


def test_zoning_bedrijven():
    """Bedrijven → 10 points."""
    parcel = MockParcelData(
        bestemmingen=[{"type": "Bedrijven", "naam": "Bedrijven - 1"}],
        area_m2=500.0,
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["zoning_value"] == 10.0


def test_zoning_agrarisch():
    """Agrarisch → 5 points."""
    parcel = MockParcelData(
        bestemmingen=[{"type": "Agrarisch", "naam": "Agrarisch - 1"}],
        area_m2=500.0,
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["zoning_value"] == 5.0


def test_zoning_none():
    """No bestemmingen → 0 points."""
    parcel = MockParcelData(bestemmingen=None, area_m2=500.0)
    result = compute_opportunity_score(parcel)
    assert result.factors["zoning_value"] == 0.0


def test_zoning_best_of_multiple():
    """Multiple bestemmingen → use highest value."""
    parcel = MockParcelData(
        bestemmingen=[
            {"type": "Agrarisch", "naam": "Agrarisch - 1"},
            {"type": "Wonen", "naam": "Wonen - 1"},
        ],
        area_m2=500.0,
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["zoning_value"] == 20.0


def test_size_very_large():
    """>5000m² → 15 points."""
    parcel = MockParcelData(area_m2=6000.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["footprint_size"] == 15.0


def test_size_large():
    """2000-5000m² → 12 points."""
    parcel = MockParcelData(area_m2=3000.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["footprint_size"] == 12.0


def test_size_medium():
    """1000-2000m² → 10 points."""
    parcel = MockParcelData(area_m2=1500.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["footprint_size"] == 10.0


def test_size_small_medium():
    """500-1000m² → 7 points."""
    parcel = MockParcelData(area_m2=750.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["footprint_size"] == 7.0


def test_size_small():
    """200-500m² → 4 points."""
    parcel = MockParcelData(area_m2=350.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["footprint_size"] == 4.0


def test_size_tiny():
    """<200m² → 1 point."""
    parcel = MockParcelData(area_m2=100.0, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["footprint_size"] == 1.0


def test_size_none():
    """None area → 0 points."""
    parcel = MockParcelData(area_m2=None, bestemmingen=[])
    result = compute_opportunity_score(parcel)
    assert result.factors["footprint_size"] == 0.0


def test_underutilization_vacant_large():
    """Vacant + large → +5."""
    parcel = MockParcelData(
        pand_status="Niet in gebruik",
        area_m2=2000.0,
        bouwjaar=2010,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["underutilization"] == 5.0


def test_underutilization_vacant_old():
    """Vacant + old → +3."""
    parcel = MockParcelData(
        pand_status="Niet in gebruik",
        area_m2=500.0,
        bouwjaar=1950,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["underutilization"] == 3.0


def test_underutilization_old_large():
    """Old + large → +2."""
    parcel = MockParcelData(
        pand_status="Pand in gebruik",
        area_m2=2000.0,
        bouwjaar=1950,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["underutilization"] == 2.0


def test_underutilization_all_three_capped():
    """Vacant + old + large → 5+3+2=10 (capped at 10)."""
    parcel = MockParcelData(
        pand_status="Buiten gebruik",
        area_m2=2000.0,
        bouwjaar=1950,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["underutilization"] == 10.0


def test_underutilization_none():
    """In use, new, small → 0."""
    parcel = MockParcelData(
        pand_status="Pand in gebruik",
        area_m2=500.0,
        bouwjaar=2015,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    assert result.factors["underutilization"] == 0.0


def test_all_factors_present_in_breakdown():
    """Factors dict always contains all 5 keys even when value is 0."""
    parcel = MockParcelData(
        has_pand=True,
        area_m2=100.0,
        bestemmingen=[],
        pand_status="",
        bouwjaar=None,
    )

    result = compute_opportunity_score(parcel)

    assert set(result.factors.keys()) == {
        "pand_status_signal",
        "building_age",
        "zoning_value",
        "footprint_size",
        "underutilization",
    }


def test_category_high_threshold():
    """Score >= 65 → High."""
    parcel = MockParcelData(
        pand_status="Sloopvergunning verleend",
        bouwjaar=1930,
        area_m2=3000.0,
        bestemmingen=[{"type": "Wonen"}],
    )
    result = compute_opportunity_score(parcel)
    assert result.total_score >= 65
    assert result.category == "High"


def test_category_medium_threshold():
    """40 <= score < 65 → Medium."""
    parcel = MockParcelData(
        pand_status="",
        bouwjaar=1985,
        area_m2=600.0,
        bestemmingen=[{"type": "Wonen"}],
    )
    result = compute_opportunity_score(parcel)
    # 15 + 10 + 20 + 7 + 0 = 52
    assert 40 <= result.total_score < 65
    assert result.category == "Medium"


def test_category_low_threshold():
    """Score < 40 → Low."""
    parcel = MockParcelData(
        pand_status="Pand in gebruik",
        bouwjaar=2020,
        area_m2=150.0,
        bestemmingen=[],
    )
    result = compute_opportunity_score(parcel)
    # 0 + 0 + 0 + 1 + 0 = 1
    assert result.total_score < 40
    assert result.category == "Low"
