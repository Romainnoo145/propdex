"""Unit tests for rule-based Wkb precheck evaluator."""

from app.schemas.address import BuildingData
from app.schemas.monument import MonumentStatus
from app.schemas.property import BuildabilityDelta, WkbRefinementInput
from app.schemas.zoning import ZoningData
from app.services.wkb_precheck import evaluate_wkb_precheck


def test_wkb_precheck_not_applicable_without_context():
    result = evaluate_wkb_precheck(
        building=None,
        monuments=None,
        zoning_data=None,
        buildability_delta=None,
    )

    assert result.status == "not_applicable"
    assert result.confidence == "low"
    assert result.required_documents == []


def test_wkb_precheck_layer_a_likely_required_with_strong_signals():
    result = evaluate_wkb_precheck(
        building=BuildingData(
            pand_id="0123456789",
            status="Bouw gestart",
            oppervlakte=240,
        ),
        monuments=MonumentStatus(sources=[]),
        zoning_data=ZoningData(
            plans=[],
            primary_bestemming="Gemengd",
            building_dimensions=None,
            data_gaps=[],
        ),
        buildability_delta=BuildabilityDelta(
            parcel_area_m2=600.0,
            current_built_area_m2=240.0,
            current_built_ratio_pct=40.0,
            max_bebouwingspercentage_pct=80.0,
            max_buildable_area_m2=480.0,
            remaining_buildable_area_m2=240.0,
            current_far=0.4,
            max_far=1.2,
            remaining_far=0.8,
            confidence="high",
        ),
    )

    assert result.status == "likely_required"
    assert result.confidence in {"medium", "high"}
    assert len(result.triggered_rules) > 0
    assert len(result.required_documents) > 0


def test_wkb_precheck_layer_b_refines_outcome_and_marks_applied():
    result = evaluate_wkb_precheck(
        building=BuildingData(
            pand_id="0123456789",
            status="Pand in gebruik",
            oppervlakte=120,
        ),
        monuments=MonumentStatus(sources=[]),
        zoning_data=ZoningData(
            plans=[],
            primary_bestemming="Wonen",
            building_dimensions=None,
            data_gaps=[],
        ),
        buildability_delta=BuildabilityDelta(
            parcel_area_m2=300.0,
            current_built_area_m2=120.0,
            current_built_ratio_pct=40.0,
            max_bebouwingspercentage_pct=70.0,
            max_buildable_area_m2=210.0,
            remaining_buildable_area_m2=90.0,
            current_far=0.4,
            max_far=1.0,
            remaining_far=0.6,
            confidence="medium",
        ),
        refinement_input=WkbRefinementInput(
            constructieve_wijziging=True,
            uitbreiding_m2=24.0,
            functiewijziging=None,
        ),
    )

    assert result.layer_b.applied is True
    assert result.layer_b.input is not None
    assert result.layer_b.effect_note is not None
    assert result.status in {"likely_required", "uncertain"}
