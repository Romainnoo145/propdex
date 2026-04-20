"""M046/S02 iron-rule regression tests.

These tests MUST pass before any future M046 slice merges. They guard
against regressions that would re-introduce the BUG-2 behavior — road-strip
percelen krijgen anders 100% vrije-grond-score wat semantisch onzin is voor
een 2m brede strook langs een weg.
"""

from app.services.score_v3_factors import score_vrije_grond


def test_shape_ratio_threshold_is_strict_greater_than_10() -> None:
    """RM iron rule: threshold is strict > 10.

    Exact 10.0 mag NIET triggeren. Marginaal boven (10.01) MOET triggeren.
    Beton tegen threshold-drift die silent scoring-behavior verschuift.
    """
    # area=100, perimeter=100 → shape_ratio = 100 / sqrt(100) = 10.0
    at_threshold = score_vrije_grond({
        "area_m2": 100,
        "perimeter_m": 100,
        "building_metrics": {"pand_oppervlakte_m2": 0},
    })
    assert at_threshold.missing is False, (
        "shape_ratio == 10.0 mag GEEN guard triggeren (strict >)"
    )

    # area=100, perimeter=100.1 → shape_ratio = 10.01
    above_threshold = score_vrije_grond({
        "area_m2": 100,
        "perimeter_m": 100.1,
        "building_metrics": {"pand_oppervlakte_m2": 0},
    })
    assert above_threshold.missing is True, (
        "shape_ratio > 10 MOET guard triggeren"
    )


def test_missing_perimeter_preserves_legacy_behavior() -> None:
    """RM iron rule: legacy scans (zonder perimeter_m) behouden bestaand gedrag.

    Als de plumbing per ongeluk wordt verwijderd — of oude scans worden
    bevraagd vóór backfill — mag de factor NIET silently alles als missing
    markeren. Guard moet simpelweg niet firen bij None perimeter.
    """
    legacy = score_vrije_grond({
        "area_m2": 500,
        "building_metrics": {"pand_oppervlakte_m2": 0},
    })
    assert legacy.missing is False
    assert legacy.genormaliseerde_score > 0

    # Expliciete None waarde (bv. uit SQL-NULL) moet ook backward-compat zijn
    explicit_none = score_vrije_grond({
        "area_m2": 500,
        "perimeter_m": None,
        "building_metrics": {"pand_oppervlakte_m2": 0},
    })
    assert explicit_none.missing is False
    assert explicit_none.genormaliseerde_score > 0
