"""Unit tests for parcel opportunity scoring service (v2 split model)."""

from app.services.parcel_scoring import (
    QUALIFICATION_THRESHOLD,
    SCORING_WEIGHTS,
    ScoreBreakdown,
    compute_opportunity_score,
)


class MockParcelData:
    """Mock parcel data object for scoring tests."""

    def __init__(
        self,
        has_pand: bool = True,
        area_m2: float | None = None,
        bestemmingen: list | None = None,
        pand_status: str = "",
        bouwjaar: int | None = None,
    ) -> None:
        self.has_pand = has_pand
        self.area_m2 = area_m2
        self.bestemmingen = bestemmingen if bestemmingen is not None else []
        self.pand_status = pand_status
        self.bouwjaar = bouwjaar


def test_scoring_weights_expose_v2_split_weights():
    assert isinstance(SCORING_WEIGHTS, dict)
    assert SCORING_WEIGHTS["pand_status_signal"] == 40
    assert SCORING_WEIGHTS["underutilization"] == 30
    assert SCORING_WEIGHTS["zoning_value"] == 20
    assert SCORING_WEIGHTS["vacancy_subscore_weight"] == 0.70
    assert SCORING_WEIGHTS["buildability_subscore_weight"] == 0.30


def test_qualification_threshold_stays_at_40():
    assert QUALIFICATION_THRESHOLD == 40.0


def test_in_use_gets_gradual_underutilization_instead_of_hard_zero():
    parcel = MockParcelData(
        has_pand=True,
        pand_status="Pand in gebruik",
        area_m2=4000.0,
        bouwjaar=1960,
        bestemmingen=[
            {
                "type": "Wonen",
                "max_floor_area_ratio": 2.5,
                "max_bebouwingspercentage": 80,
            }
        ],
    )

    result = compute_opportunity_score(parcel)

    assert result.factors["underutilization"] > 0.0
    assert result.factors["pand_status_signal"] == 4.0
    assert result.vacancy_subscore > 0.0
    assert result.total_score < 67
    assert result.category in {"Low", "Medium"}


def test_empty_parcel_ranks_high_with_strong_vacancy_subscore():
    parcel = MockParcelData(
        has_pand=False,
        area_m2=2000.0,
        bouwjaar=None,
        bestemmingen=[
            {
                "type": "Gemengd",
                "max_floor_area_ratio": 1.8,
                "max_bebouwingspercentage": 60,
            }
        ],
    )

    result = compute_opportunity_score(parcel)

    assert isinstance(result, ScoreBreakdown)
    assert result.vacancy_subscore >= 90
    assert result.buildability_subscore >= 60
    assert result.total_score >= 65
    assert result.category == "High"
    assert result.model_version == "opportunity-score-v2.1"


def test_score_breakdown_contains_split_subscores():
    parcel = MockParcelData(
        has_pand=True,
        pand_status="Pand buiten gebruik",
        area_m2=1200.0,
        bouwjaar=1975,
        bestemmingen=[
            {
                "type": "Bedrijf",
                "max_floor_area_ratio": 1.2,
                "max_bebouwingspercentage": 50,
            }
        ],
    )

    result = compute_opportunity_score(parcel)

    assert "vacancy_subscore" in result.factors
    assert "buildability_subscore" in result.factors
    assert "vacancy_guardrail" in result.factors
    assert 0 <= result.factors["vacancy_subscore"] <= 100
    assert 0 <= result.factors["buildability_subscore"] <= 100


def test_unknown_status_with_modest_inputs_stays_low():
    parcel = MockParcelData(
        has_pand=True,
        pand_status="",
        area_m2=800.0,
        bouwjaar=1985,
        bestemmingen=[{"type": "Wonen"}],
    )

    result = compute_opportunity_score(parcel)

    assert result.total_score < 40
    assert result.category == "Low"


def test_in_use_score_spreads_with_scale_and_planruimte():
    compact = MockParcelData(
        has_pand=True,
        pand_status="Pand in gebruik",
        area_m2=260.0,
        bouwjaar=2005,
        bestemmingen=[{"type": "Wonen", "max_floor_area_ratio": 0.9, "max_bebouwingspercentage": 85}],
    )
    larger = MockParcelData(
        has_pand=True,
        pand_status="Pand in gebruik",
        area_m2=2800.0,
        bouwjaar=1980,
        bestemmingen=[{"type": "Wonen", "max_floor_area_ratio": 1.9, "max_bebouwingspercentage": 55}],
    )

    compact_score = compute_opportunity_score(compact)
    larger_score = compute_opportunity_score(larger)

    assert larger_score.factors["underutilization"] > compact_score.factors["underutilization"]
    assert larger_score.vacancy_subscore > compact_score.vacancy_subscore
    assert larger_score.total_score > compact_score.total_score
