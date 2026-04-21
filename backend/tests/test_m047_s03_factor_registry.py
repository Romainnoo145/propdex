"""M047/S03 iron-rule + regression tests for FACTOR_REGISTRY + conditional weights.

Covers:
1. Backward-compat regression on 10 golden fixtures (onbepaald projecttype)
2. Conditional weight shift between nieuwbouw_wonen and optoppen
3. _POTENTIE_MAX and _RISICO_MAX derived from registry (== 100)
4. Sum-guard for all 6 project types
5. FactorResult.percentage_of_category populated correctly
6. ScoreV3Result.potentie_risico_balance field present and correct
"""

from app.services.score_v3 import (
    _ALL_PROJECT_TYPES,
    _POTENTIE_MAX,
    _RISICO_MAX,
    FACTOR_REGISTRY,
    ScoreV3Result,
    compute_score_v3,
)

# Golden fixtures: (parcel_data, neighborhood_metrics, expected_overall, expected_potentie, expected_risico)
# Captured from pre-refactor engine. Tolerance ±2.0 covers integer weight rounding
# (87→100 for risico introduces up to 1.24 pts deviation; overall propagation up to ~1.5).
GOLDEN_FIXTURES = [
    # F01: leeg perceel wonen laag risico
    (
        {
            "area_m2": 1500,
            "has_pand": False,
            "bouwjaar": None,
            "bestemmingen": [{"type": "Wonen", "naam": "Wonen"}],
            "building_metrics": {"pand_oppervlakte_m2": 0},
            "vacancy_signal": "leeg_perceel",
            "funderingsrisico": {"fgr": "laag"},
            "bodem": {"has_known_contamination": False, "dossiers_count": 0},
        },
        None,
        91.6,
        94.4,
        10.0,
    ),
    # F02: pand in gebruik pre-1970 gemiddeld risico
    (
        {
            "area_m2": 850,
            "has_pand": True,
            "bouwjaar": 1965,
            "bestemmingen": [{"type": "Wonen", "naam": "Wonen - 1"}],
            "building_metrics": {
                "pand_oppervlakte_m2": 200,
                "max_bouwhoogte": 12.0,
                "actual_bouwhoogte": 8.5,
                "max_bouwlagen": 4,
                "actual_bouwlagen": 2,
            },
            "vacancy_signal": "in_gebruik",
            "funderingsrisico": {"fgr": "gemiddeld"},
            "bodem": {"has_known_contamination": False, "dossiers_count": 1},
            "energielabel": {"energieklasse": "E"},
        },
        None,
        61.0,
        68.7,
        37.5,
    ),
    # F03: bedrijventerrein hoog bodemrisico
    (
        {
            "area_m2": 3000,
            "has_pand": True,
            "bouwjaar": 1980,
            "bestemmingen": [{"type": "Bedrijventerrein", "naam": "Bedrijventerrein"}],
            "building_metrics": {"pand_oppervlakte_m2": 1500},
            "vacancy_signal": "leegstaand_pand",
            "funderingsrisico": {"fgr": "hoog"},
            "bodem": {"has_known_contamination": True, "dossiers_count": 4},
        },
        None,
        50.8,
        66.9,
        80.2,
    ),
    # F04: all data missing
    ({}, None, 8.3, 10.9, 80.0),
    # F05: gemengd met natura2000
    (
        {
            "area_m2": 600,
            "has_pand": True,
            "bouwjaar": 2005,
            "bestemmingen": [{"type": "Gemengd", "naam": "Gemengd - 1"}],
            "building_metrics": {"pand_oppervlakte_m2": 400},
            "vacancy_signal": "in_gebruik",
            "natura2000": {
                "binnen_5km": True,
                "naam": "Maasduinen",
                "bescherming": "Vogel- en Habitatrichtlijn",
            },
            "funderingsrisico": {"fgr": "laag"},
            "bodem": {"has_known_contamination": False, "dossiers_count": 0},
        },
        None,
        54.4,
        58.9,
        25.5,
    ),
    # F06: optoppen scenario max height reached
    (
        {
            "area_m2": 250,
            "has_pand": True,
            "bouwjaar": 1990,
            "bestemmingen": [{"type": "Wonen", "naam": "Wonen"}],
            "building_metrics": {
                "pand_oppervlakte_m2": 200,
                "max_bouwlagen": 3,
                "actual_bouwlagen": 3,
                "max_bouwhoogte": 9.0,
                "actual_bouwhoogte": 9.0,
            },
            "vacancy_signal": "in_gebruik",
            "funderingsrisico": {"fgr": "laag"},
            "bodem": {"has_known_contamination": False, "dossiers_count": 0},
        },
        None,
        45.8,
        50.2,
        29.2,
    ),
    # F07: large nieuwbouw kavel with neighborhood metrics
    (
        {
            "area_m2": 5000,
            "has_pand": False,
            "bouwjaar": None,
            "bestemmingen": [{"type": "Wonen", "naam": "Wonen"}],
            "building_metrics": {"pand_oppervlakte_m2": 0},
            "vacancy_signal": "leeg_perceel",
            "funderingsrisico": {"fgr": "laag"},
            "bodem": {"has_known_contamination": False, "dossiers_count": 0},
        },
        {
            "data": {
                "demografie": {"aantal_inwoners": 15000},
                "inkomen": {"gem_gestandaardiseerd": 35000},
                "huishoudens": {"totaal": 7000},
            }
        },
        89.2,
        92.0,
        10.0,
    ),
    # F08: rijksmonument hoog funderingsrisico
    (
        {
            "area_m2": 400,
            "has_pand": True,
            "bouwjaar": 1920,
            "bestemmingen": [
                {"type": "Wonen - Waarde Cultuurhistorie", "naam": "Monument"}
            ],
            "building_metrics": {"pand_oppervlakte_m2": 380},
            "vacancy_signal": "in_gebruik",
            "rijksmonument": {
                "is_monument": True,
                "rce_objnaam": "Herenhuis Venlo",
                "rce_objrijksnr": 123456,
            },
            "funderingsrisico": {"fgr": "hoog"},
            "bodem": {"has_known_contamination": False, "dossiers_count": 0},
        },
        None,
        46.3,
        55.6,
        55.8,
    ),
    # F09: flood + geluid risk combo
    (
        {
            "area_m2": 2000,
            "has_pand": True,
            "bouwjaar": 1975,
            "bestemmingen": [{"type": "Wonen", "naam": "Wonen"}],
            "building_metrics": {"pand_oppervlakte_m2": 300},
            "vacancy_signal": "in_gebruik",
            "overstromingsrisico": {
                "in_risk_zone": True,
                "description": "Buitendijks gebied",
            },
            "geluid": {"classification": "hoog", "lden_db": 58},
            "funderingsrisico": {"fgr": "gemiddeld"},
            "bodem": {"has_known_contamination": False, "dossiers_count": 0},
        },
        None,
        65.8,
        76.1,
        45.0,
    ),
    # F10: criminal area maatschappelijk bestemming
    (
        {
            "area_m2": 500,
            "has_pand": True,
            "bouwjaar": 1988,
            "bestemmingen": [{"type": "Maatschappelijk", "naam": "Maatschappelijk"}],
            "building_metrics": {"pand_oppervlakte_m2": 450},
            "vacancy_signal": "leegstaand_pand",
            "funderingsrisico": {"fgr": "laag"},
            "bodem": {"has_known_contamination": False, "dossiers_count": 0},
            "natura2000": {"binnen_5km": False, "naam": None, "bescherming": None},
            "overstromingsrisico": {"in_risk_zone": False, "description": ""},
            "geluid": {"classification": "acceptabel", "lden_db": 38},
            "luchtkwaliteit": {
                "no2_ugm3": 45.0,
                "pm10_ugm3": 28.0,
                "boven_grenswaarde": False,
            },
        },
        {"data": {"criminaliteit": {"per_1000_inwoners": 95}}},
        44.8,
        49.1,
        29.2,
    ),
]

TOLERANCE = 2.0  # max acceptable delta. Integer rounding of risico weights (87→100)
# introduces up to 1.24 pts deviation on risico_score for funderingsrisico=hoog.
# With discount propagation to overall, worst-case is ~1.5. Use 2.0 for safety.


def test_factor_registry_backward_compat() -> None:
    """Regression guard: projecttype=onbepaald scores match pre-refactor golden values."""
    for i, (
        parcel_data,
        neighborhood_metrics,
        exp_overall,
        exp_potentie,
        exp_risico,
    ) in enumerate(GOLDEN_FIXTURES, 1):
        result = compute_score_v3(
            parcel_data, neighborhood_metrics, project_type="onbepaald"
        )
        assert abs(result.overall - exp_overall) <= TOLERANCE, (
            f"F{i:02d} overall: got {result.overall}, expected {exp_overall} (±{TOLERANCE})"
        )
        assert abs(result.potentie_score - exp_potentie) <= TOLERANCE, (
            f"F{i:02d} potentie: got {result.potentie_score}, expected {exp_potentie} (±{TOLERANCE})"
        )
        assert abs(result.risico_score - exp_risico) <= TOLERANCE, (
            f"F{i:02d} risico: got {result.risico_score}, expected {exp_risico} (±{TOLERANCE})"
        )


def test_conditional_weight_shift() -> None:
    """Different projecttype yields different score on identical parcel."""
    parcel = {
        "area_m2": 500,
        "has_pand": True,
        "bouwjaar": 2000,
        "bestemmingen": [{"type": "Wonen", "naam": "Wonen"}],
        "building_metrics": {
            "pand_oppervlakte_m2": 200,
            "max_bouwlagen": 3,
            "actual_bouwlagen": 1,
            "max_bouwhoogte": 9.0,
            "actual_bouwhoogte": 3.5,
        },
        "vacancy_signal": "in_gebruik",
        "funderingsrisico": {"fgr": "laag"},
        "bodem": {"has_known_contamination": False, "dossiers_count": 0},
    }
    r_nieuw = compute_score_v3(parcel, project_type="nieuwbouw_wonen")
    r_optop = compute_score_v3(parcel, project_type="optoppen")

    assert r_nieuw.potentie_score != r_optop.potentie_score, (
        "nieuwbouw_wonen and optoppen should yield different potentie scores"
    )

    # vrije_grond contributes more for nieuwbouw_wonen (weight 18 vs 12)
    vg_nieuw = r_nieuw.score_breakdown["vrije_grond"]
    vg_optop = r_optop.score_breakdown["vrije_grond"]
    assert vg_nieuw.gewicht > vg_optop.gewicht, (
        f"vrije_grond: nieuwbouw={vg_nieuw.gewicht}, optoppen={vg_optop.gewicht}"
    )

    # optoppotentie contributes more for optoppen (weight 15 vs 9)
    op_nieuw = r_nieuw.score_breakdown["optoppotentie"]
    op_optop = r_optop.score_breakdown["optoppotentie"]
    assert op_optop.gewicht > op_nieuw.gewicht, (
        f"optoppotentie: optoppen={op_optop.gewicht}, nieuwbouw={op_nieuw.gewicht}"
    )


def test_dynamic_potentie_risico_max() -> None:
    """_POTENTIE_MAX and _RISICO_MAX are derived from registry, not hardcoded."""
    registry_p = sum(
        e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "potentie"
    )
    registry_r = sum(
        e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "risico"
    )
    assert _POTENTIE_MAX == registry_p == 100
    assert _RISICO_MAX == registry_r == 100


def test_sum_guard_all_project_types() -> None:
    """For every projecttype, weights per category sum to exactly 100."""
    for ptype in _ALL_PROJECT_TYPES:
        for cat in ("potentie", "risico"):
            total = sum(
                (e.weight_by_projecttype or {}).get(ptype, e.default_weight)
                for e in FACTOR_REGISTRY.values()
                if e.category == cat
            )
            assert total == 100, (
                f"{cat} weights for '{ptype}' = {total} (expected 100)"
            )


def test_percentage_of_category() -> None:
    """Each FactorResult.percentage_of_category == round(gewicht/100, 4)."""
    result = compute_score_v3(
        {"area_m2": 500, "vacancy_signal": "in_gebruik"},
        project_type="onbepaald",
    )
    for name, factor in result.score_breakdown.items():
        expected = round(factor.gewicht / 100.0, 4)
        assert abs(factor.percentage_of_category - expected) < 0.0001, (
            f"{name}: percentage_of_category={factor.percentage_of_category}, "
            f"gewicht/100={expected}"
        )


def test_score_v3_result_has_balance_field() -> None:
    """ScoreV3Result.potentie_risico_balance is present and defaults to 0.7."""
    result = compute_score_v3({"area_m2": 500}, project_type="onbepaald")
    assert hasattr(result, "potentie_risico_balance")
    assert result.potentie_risico_balance == 0.7

    # Also verify direct construction works with the field
    direct = ScoreV3Result(
        potentie_score=70.0,
        risico_score=30.0,
        overall=60.0,
        category="Gemiddeld",
        potentie_risico_balance=0.5,
    )
    assert direct.potentie_risico_balance == 0.5
