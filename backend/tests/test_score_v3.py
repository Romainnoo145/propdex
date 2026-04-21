"""Comprehensive unit tests for Score v3.0 engine (dual-subscore model)."""

import pytest

from app.services.score_v3 import (
    compute_score_v3,
)
from app.services.score_v3_factors import (
    normalize_binary,
    normalize_linear,
    normalize_log,
    score_asbest,
    score_bestemming,
    score_bestemmingswijziging,
    score_bodemverontreiniging,
    score_constructieve_staat,
    score_criminaliteit,
    score_demografie,
    score_funda_frictie,
    score_funderingsrisico,
    score_juridisch_klimaat,
    score_leegstand,
    score_max_hoogte_bereikt,
    score_monument,
    score_optoppotentie,
    score_perceelgrootte,
    score_vergunning_succeskans,
    score_vrije_grond,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def full_parcel_data() -> dict:
    """Realistic Venlo parcel with all fields populated."""
    return {
        "area_m2": 850,
        "has_pand": True,
        "pand_status": "Pand in gebruik",
        "bouwjaar": 1965,
        "bestemmingen": [
            {
                "type": "Wonen",
                "naam": "Wonen - 1",
                "max_bouwhoogte": 12.0,
                "max_bouwlagen": 4,
                "max_bebouwingspercentage": 60.0,
                "max_floor_area_ratio": 1.8,
            }
        ],
        "building_metrics": {
            "pand_oppervlakte_m2": 200,
            "max_bouwhoogte": 12.0,
            "max_bouwlagen": 4,
            "actual_bouwhoogte": 8.5,
            "actual_bouwlagen": 2,
        },
        "vacancy_signal": "in_gebruik",
        "vacancy_confidence": 0.2,
        "market_signals": {
            "listing_duration_days": 120,
            "price_change_count": 1,
        },
        "bodem": {
            "has_known_contamination": False,
            "dossiers_count": 1,
        },
        "bodemtype": {
            "dominant_type": "klei",
            "dominant_type_label": "Poldervaaggronden",
        },
        "funderingsrisico": {
            "fgr": "gemiddeld",
            "percvoor1970": 60.0,
        },
        "energielabel": {
            "energieklasse": "D",
            "is_geregistreerd": True,
        },
        "vergunningen": {
            "records": [{"title": "Verbouwen"}],
            "total_postcode_count": 5,
        },
    }


@pytest.fixture
def minimal_parcel_data() -> dict:
    """Only basic fields present."""
    return {
        "area_m2": 400,
        "has_pand": True,
        "pand_status": "Pand in gebruik",
        "bouwjaar": 2005,
        "bestemmingen": [{"type": "Wonen"}],
    }


@pytest.fixture
def full_neighborhood_metrics() -> dict:
    """CBS wijk data matching RESEARCH.md section 3 shape."""
    return {
        "data": {
            "demografie": {
                "aantal_inwoners": 12500,
                "percentage_huurwoningen": 45.0,
                "percentage_koopwoningen": 55.0,
            },
            "inkomen": {
                "gem_per_ontvanger": 35200,
                "gem_per_inwoner": 24100,
                "gem_gestandaardiseerd": 28900,
            },
            "huishoudens": {
                "totaal": 5800,
                "eenpersoons": 2100,
            },
        },
        "criminaliteit": {
            "per_1000_inwoners": 36.0,
            "totaal_misdrijven": 450,
        },
        "juridisch_klimaat": {
            "approval_rate": 0.72,
            "ruling_count": 45,
        },
    }


@pytest.fixture
def empty_neighborhood_metrics():
    return None


# ---------------------------------------------------------------------------
# Individual factor tests (17 tests)
# ---------------------------------------------------------------------------

def test_vrije_grond_with_large_unbuilt_area(full_parcel_data):
    r = score_vrije_grond(full_parcel_data)
    assert r.categorie == "potentie"
    assert r.gewicht == 12
    assert 0 <= r.genormaliseerde_score <= 1
    assert not r.missing
    # 850m2 parcel with 200m2 building = ~76% free
    assert r.genormaliseerde_score > 0.7


# ---------------------------------------------------------------------------
# M046/S02 BUG-2: shape-ratio guard tegen road-strip valse positieven
# ---------------------------------------------------------------------------


def test_vrije_grond_strip_guard_triggers_when_shape_ratio_above_10():
    """Strookperceel (2m × 100m): area=200, perimeter=204 → shape_ratio=14.4."""
    pd = {
        "area_m2": 200,
        "perimeter_m": 204,
        "building_metrics": {"pand_oppervlakte_m2": 0},
    }
    r = score_vrije_grond(pd)
    assert r.missing is True
    assert r.genormaliseerde_score == 0.0
    assert "strook" in r.toelichting_kort.lower()


def test_vrije_grond_no_guard_on_normal_parcel():
    """Normaal perceel (30m × 40m): area=1200, perimeter=140 → shape_ratio=4.04."""
    pd = {
        "area_m2": 1200,
        "perimeter_m": 140,
        "building_metrics": {"pand_oppervlakte_m2": 0},
    }
    r = score_vrije_grond(pd)
    assert r.missing is False
    # 100% vrije grond op normaal perceel → hoge score verwacht
    assert r.genormaliseerde_score > 0.5


def test_vrije_grond_backward_compat_without_perimeter():
    """Legacy parcel_data zonder perimeter_m key → guard fires NIET, normale score."""
    pd = {
        "area_m2": 200,
        "building_metrics": {"pand_oppervlakte_m2": 0},
    }
    r = score_vrije_grond(pd)
    assert r.missing is False
    assert r.genormaliseerde_score > 0


def test_vrije_grond_guard_threshold_strict_at_10():
    """Strict >: shape_ratio == 10.0 exact → geen guard; shape_ratio > 10 → guard fires."""
    # Exact op threshold: area=100, perimeter=100 → shape_ratio = 100 / sqrt(100) = 10.0
    pd_at_threshold = {
        "area_m2": 100,
        "perimeter_m": 100,
        "building_metrics": {"pand_oppervlakte_m2": 0},
    }
    r_at = score_vrije_grond(pd_at_threshold)
    assert r_at.missing is False, "shape_ratio == 10.0 mag GEEN guard triggeren (strict >)"

    # Net boven threshold: area=100, perimeter=100.1 → shape_ratio = 10.01
    pd_above_threshold = {
        "area_m2": 100,
        "perimeter_m": 100.1,
        "building_metrics": {"pand_oppervlakte_m2": 0},
    }
    r_above = score_vrije_grond(pd_above_threshold)
    assert r_above.missing is True, "shape_ratio > 10 MOET guard triggeren"


# ---------------------------------------------------------------------------
# M046/S04 BUG-1: _best_bestemming_type count-voting + priority tie-breaker
# ---------------------------------------------------------------------------


def test_best_bestemming_single_type_unchanged():
    """Single-bestemming parcels blijven werken als voorheen."""
    from app.services.score_v3_factors import _best_bestemming_type
    assert _best_bestemming_type({"bestemmingen": [{"type": "wonen"}]}) == "wonen"


def test_best_bestemming_count_wins_over_priority():
    """BUG-1 regression: 2× verkeer + 1× wonen → verkeer (count wint).

    Voorheen: wonen heeft priority=4 dus wint altijd ongeacht count.
    Nu: count wint eerst, pas bij gelijkspel is priority de tie-breaker.
    """
    from app.services.score_v3_factors import _best_bestemming_type
    pd = {
        "bestemmingen": [
            {"type": "verkeer"},
            {"type": "verkeer - verblijfsgebied"},
            {"type": "wonen"},
        ]
    }
    assert _best_bestemming_type(pd) == "verkeer"


def test_best_bestemming_priority_tiebreaker_on_equal_counts():
    """1× bedrijf + 1× wonen (tie) → wonen (transformatie-kans behouden).

    Bij count-tie behoudt de helper de bestaande priority-lijst zodat
    transformatie-signaal niet verdwijnt: een gemengd bedrijf+wonen
    perceel wordt nog steeds als wonen geklasseerd (ontwikkelpotentieel).
    """
    from app.services.score_v3_factors import _best_bestemming_type
    pd = {"bestemmingen": [{"type": "bedrijf"}, {"type": "wonen"}]}
    assert _best_bestemming_type(pd) == "wonen"


def test_best_bestemming_fallback_to_type_when_no_priority_match():
    """Geen priority-match + geen mixed → return type zelf (niet 'onbekend')."""
    from app.services.score_v3_factors import _best_bestemming_type
    assert _best_bestemming_type({"bestemmingen": [{"type": "water"}]}) == "water"


def test_optoppotentie_with_headroom(full_parcel_data):
    r = score_optoppotentie(full_parcel_data)
    assert r.categorie == "potentie"
    assert r.gewicht == 10
    assert not r.missing
    # 2 of 4 bouwlagen = 50% headroom
    assert r.genormaliseerde_score == 0.5


def test_optoppotentie_missing_when_no_max():
    r = score_optoppotentie({"building_metrics": {"actual_bouwlagen": 2}})
    assert r.missing
    assert r.genormaliseerde_score == 0.5


def test_bestemming_wonen_scores_high(full_parcel_data):
    r = score_bestemming(full_parcel_data)
    assert r.categorie == "potentie"
    assert r.gewicht == 12
    assert r.genormaliseerde_score == 1.0


def test_bestemming_industrie_scores_low():
    r = score_bestemming({"bestemmingen": [{"type": "Bedrijventerrein"}]})
    assert r.genormaliseerde_score == 0.2


def test_leegstand_leeg_perceel_scores_max():
    r = score_leegstand({"vacancy_signal": "leeg_perceel"})
    assert r.categorie == "potentie"
    assert r.gewicht == 8
    assert r.genormaliseerde_score == 1.0


def test_leegstand_in_gebruik_scores_zero():
    r = score_leegstand({"vacancy_signal": "in_gebruik"})
    assert r.genormaliseerde_score == 0.0


def test_funda_frictie_long_duration():
    r = score_funda_frictie({
        "market_signals": {"listing_duration_days": 300, "price_change_count": 3}
    })
    assert r.categorie == "potentie"
    assert r.gewicht == 5
    assert r.genormaliseerde_score > 0.6
    assert not r.missing


def test_funda_frictie_missing_when_no_signals():
    r = score_funda_frictie({})
    assert r.missing
    assert r.genormaliseerde_score == 0.5


def test_funda_frictie_missing_narrative_mentions_pilot_phase():
    """M046/S03: narrative must communicate this is a platform-wide state,
    not a parcel-specific data gap. Protects against users/reports
    interpreting the neutral score as a legitimate Funda-derived signal.
    """
    r = score_funda_frictie({})
    assert r.missing
    lang = r.toelichting_lang.lower()
    assert "pilot" in lang or "nog niet productief" in lang or "uitgeschakeld" in lang, (
        f"Narrative should explicitly state Funda data pipeline is in pilot/inactive state, "
        f"got: {r.toelichting_lang!r}"
    )


def test_perceelgrootte_large_parcel():
    r = score_perceelgrootte({"area_m2": 5000})
    assert r.categorie == "potentie"
    assert r.gewicht == 12
    assert r.genormaliseerde_score > 0.8


def test_perceelgrootte_small_parcel():
    r = score_perceelgrootte({"area_m2": 50})
    assert r.genormaliseerde_score < 0.5


def test_demografie_with_data(full_neighborhood_metrics):
    r = score_demografie(full_neighborhood_metrics)
    assert r.categorie == "potentie"
    assert r.gewicht == 8
    assert not r.missing
    assert 0 <= r.genormaliseerde_score <= 1


def test_demografie_missing_when_no_metrics():
    r = score_demografie(None)
    assert r.missing
    assert r.genormaliseerde_score == 0.5


def test_vergunning_succeskans_with_data(full_neighborhood_metrics):
    r = score_vergunning_succeskans(full_neighborhood_metrics)
    assert r.categorie == "potentie"
    assert r.gewicht == 13
    assert not r.missing
    # 72% approval rate should score reasonably high
    assert r.genormaliseerde_score > 0.5


def test_vergunning_succeskans_missing_without_jk():
    r = score_vergunning_succeskans({})
    assert r.missing


def test_funderingsrisico_hoog_klei_pre1970(full_parcel_data):
    full_parcel_data["funderingsrisico"] = {"fgr": "hoog"}
    r = score_funderingsrisico(full_parcel_data)
    assert r.categorie == "risico"
    assert r.gewicht == 15
    # hoog + klei + pre-1970 = 1.0
    assert r.genormaliseerde_score == 1.0


def test_funderingsrisico_missing_is_critical():
    r = score_funderingsrisico({})
    assert r.missing
    assert r.genormaliseerde_score == 0.5  # before critical penalty


def test_asbest_pre1994_industrial():
    r = score_asbest({
        "bouwjaar": 1970,
        "bestemmingen": [{"type": "Bedrijventerrein"}],
    })
    assert r.categorie == "risico"
    assert r.gewicht == 6
    assert r.genormaliseerde_score == 1.0


def test_asbest_post2000_safe():
    r = score_asbest({"bouwjaar": 2010, "bestemmingen": []})
    assert r.genormaliseerde_score == 0.0


def test_bodemverontreiniging_contaminated():
    r = score_bodemverontreiniging({
        "bodem": {"has_known_contamination": True, "dossiers_count": 4}
    })
    assert r.categorie == "risico"
    assert r.gewicht == 7
    assert r.genormaliseerde_score == 1.0


def test_bodemverontreiniging_clean():
    r = score_bodemverontreiniging({
        "bodem": {"has_known_contamination": False, "dossiers_count": 0}
    })
    assert r.genormaliseerde_score == 0.0


def test_monument_detected_via_waarde_bestemming():
    r = score_monument({
        "bestemmingen": [{"type": "Waarde - Cultuurhistorie", "naam": ""}]
    })
    assert r.categorie == "risico"
    assert r.gewicht == 5
    assert r.genormaliseerde_score == 1.0


def test_monument_not_detected(full_parcel_data):
    r = score_monument(full_parcel_data)
    assert r.genormaliseerde_score == 0.0


def test_bestemmingswijziging_wonen_no_change():
    r = score_bestemmingswijziging({
        "bestemmingen": [{"type": "Wonen"}],
    })
    assert r.categorie == "risico"
    assert r.gewicht == 8
    assert r.genormaliseerde_score == 0.0


def test_bestemmingswijziging_industrie_needs_change():
    r = score_bestemmingswijziging({
        "bestemmingen": [{"type": "Bedrijventerrein"}],
    })
    assert r.genormaliseerde_score == 0.8


def test_constructieve_staat_old_poor_energy():
    r = score_constructieve_staat({
        "bouwjaar": 1930,
        "energielabel": {"energieklasse": "G"},
    })
    assert r.categorie == "risico"
    assert r.gewicht == 7
    assert r.genormaliseerde_score > 0.8


def test_constructieve_staat_new_good_energy():
    r = score_constructieve_staat({
        "bouwjaar": 2020,
        "energielabel": {"energieklasse": "A"},
    })
    assert r.genormaliseerde_score < 0.2


def test_juridisch_klimaat_low_approval(full_neighborhood_metrics):
    full_neighborhood_metrics["juridisch_klimaat"]["approval_rate"] = 0.25
    r = score_juridisch_klimaat(full_neighborhood_metrics)
    assert r.categorie == "risico"
    assert r.gewicht == 8
    assert r.genormaliseerde_score > 0.8


def test_juridisch_klimaat_missing():
    r = score_juridisch_klimaat(None)
    assert r.missing


# ---------------------------------------------------------------------------
# M046/S01 RM-1: sparse-dev-types signal (missing=True in juridisch_klimaat)
# ---------------------------------------------------------------------------


def test_vergunning_succeskans_missing_when_sparse_dev_types():
    """Aggregator signals missing=True → factor degrades to neutral 0.5."""
    nm = {
        "juridisch_klimaat": {
            "approval_rate": 0.8,
            "missing": True,
            "ruling_count": 11,
            "ruling_count_dev_types": 2,
            "reason": "insufficient_dev_type_rulings",
        }
    }
    r = score_vergunning_succeskans(nm)
    assert r.missing is True
    assert r.genormaliseerde_score == 0.5
    assert r.gewicht == 13
    assert r.categorie == "potentie"
    assert "2 van 5" in r.toelichting_kort


def test_juridisch_klimaat_missing_when_sparse_dev_types():
    """Risico-inverse path honors the same missing signal."""
    nm = {
        "juridisch_klimaat": {
            "approval_rate": 0.3,
            "missing": True,
            "ruling_count": 8,
            "ruling_count_dev_types": 1,
            "reason": "insufficient_dev_type_rulings",
        }
    }
    r = score_juridisch_klimaat(nm)
    assert r.missing is True
    assert r.genormaliseerde_score == 0.5
    assert r.gewicht == 8
    assert r.categorie == "risico"


def test_vergunning_succeskans_uses_approval_rate_when_not_missing():
    """Regression guard: existing behavior preserved when missing=False."""
    nm = {
        "juridisch_klimaat": {
            "approval_rate": 0.75,
            "missing": False,
            "ruling_count": 12,
            "ruling_count_dev_types": 8,
        }
    }
    r = score_vergunning_succeskans(nm)
    assert r.missing is False
    assert r.genormaliseerde_score > 0.7


def test_criminaliteit_high():
    r = score_criminaliteit({"criminaliteit": {"per_1000_inwoners": 90}})
    assert r.categorie == "risico"
    assert r.gewicht == 6
    assert r.genormaliseerde_score > 0.8


def test_criminaliteit_low():
    r = score_criminaliteit({"criminaliteit": {"per_1000_inwoners": 15}})
    assert r.genormaliseerde_score < 0.2


def test_max_hoogte_bereikt_at_max():
    r = score_max_hoogte_bereikt({
        "building_metrics": {
            "max_bouwlagen": 3,
            "actual_bouwlagen": 3,
        },
    })
    assert r.categorie == "risico"
    assert r.gewicht == 5
    assert r.genormaliseerde_score == 1.0


def test_max_hoogte_bereikt_not_at_max():
    r = score_max_hoogte_bereikt({
        "building_metrics": {
            "max_bouwlagen": 5,
            "actual_bouwlagen": 2,
        },
    })
    assert r.genormaliseerde_score == 0.0


def test_max_hoogte_bereikt_missing():
    r = score_max_hoogte_bereikt({"building_metrics": {}})
    assert r.missing


# ---------------------------------------------------------------------------
# Normalization tests
# ---------------------------------------------------------------------------

def test_normalize_log_scale():
    """Large values shouldn't saturate immediately."""
    s1 = normalize_log(100, 10000)
    s2 = normalize_log(1000, 10000)
    s3 = normalize_log(10000, 10000)
    assert s1 < s2 < s3
    assert s3 == 1.0
    assert 0 < s1 < 1


def test_normalize_log_zero_returns_zero():
    assert normalize_log(0, 10000) == 0.0
    assert normalize_log(-5, 10000) == 0.0


def test_normalize_linear_clamps():
    assert normalize_linear(0, 10, 100) == 0.0
    assert normalize_linear(150, 10, 100) == 1.0
    assert 0 < normalize_linear(50, 10, 100) < 1


def test_normalize_linear_equal_bounds():
    assert normalize_linear(5, 10, 10) == 0.0


def test_normalize_binary():
    assert normalize_binary(True) == 1.0
    assert normalize_binary(False) == 0.0


# ---------------------------------------------------------------------------
# Missing data tests
# ---------------------------------------------------------------------------

def test_missing_non_critical_factor_gets_neutral():
    """Non-critical missing factor should get neutral 0.5 score."""
    # Funda frictie is non-critical
    r = score_funda_frictie({})
    assert r.missing
    assert r.genormaliseerde_score == 0.5


def test_missing_critical_risk_factor_gets_penalty():
    """Critical risk factors get neutral + 10% penalty after compute_score_v3."""
    parcel = {
        "area_m2": 500,
        "bouwjaar": 1980,
        "bestemmingen": [{"type": "Wonen"}],
        "vacancy_signal": "in_gebruik",
    }
    result = compute_score_v3(parcel)
    # funderingsrisico, bodemverontreiniging, asbest are critical
    # Without data, funderingsrisico and bodemverontreiniging are missing
    fr = result.score_breakdown["funderingsrisico"]
    assert fr.missing
    # After penalty: 0.5 + 0.1 = 0.6
    assert fr.genormaliseerde_score == pytest.approx(0.6, abs=0.01)

    bv = result.score_breakdown["bodemverontreiniging"]
    assert bv.missing
    assert bv.genormaliseerde_score == pytest.approx(0.6, abs=0.01)


def test_weight_redistribution_when_many_missing():
    """>20% missing triggers weight redistribution."""
    # Minimal data = many missing factors
    parcel = {
        "area_m2": 500,
        "bestemmingen": [{"type": "Wonen"}],
        "vacancy_signal": "in_gebruik",
    }
    result = compute_score_v3(parcel, None)

    # Count missing potentie factors
    potentie_factors = {
        k: v for k, v in result.score_breakdown.items()
        if v.categorie == "potentie"
    }
    missing_count = sum(1 for v in potentie_factors.values() if v.missing)

    if missing_count / len(potentie_factors) > 0.2:
        # Missing factors should have weight 0 (redistributed)
        for v in potentie_factors.values():
            if v.missing:
                assert v.gewicht == 0
                assert v.bijdrage == 0


def test_total_weights_preserved_after_redistribution():
    """Total category weight stays the same after redistribution."""
    parcel = {
        "area_m2": 500,
        "bestemmingen": [{"type": "Wonen"}],
        "vacancy_signal": "in_gebruik",
    }
    result = compute_score_v3(parcel, None)

    potentie_factors = {
        k: v for k, v in result.score_breakdown.items()
        if v.categorie == "potentie"
    }
    missing_count = sum(1 for v in potentie_factors.values() if v.missing)

    if missing_count / len(potentie_factors) > 0.2:
        # Total weight of present factors should approximate original total
        # Updated for M047/S03 weight normalization (old: 80, new: 100)
        total_weight = sum(v.gewicht for v in potentie_factors.values())
        assert total_weight == pytest.approx(100, abs=1)


# ---------------------------------------------------------------------------
# Overall score tests
# ---------------------------------------------------------------------------

def test_full_data_produces_valid_scores(full_parcel_data, full_neighborhood_metrics):
    result = compute_score_v3(full_parcel_data, full_neighborhood_metrics)
    assert 0 <= result.potentie_score <= 100
    assert 0 <= result.risico_score <= 100
    assert isinstance(result.overall, float)


def test_empty_parcel_high_potentie():
    """Leeg perceel with wonen bestemming = high potentie."""
    parcel = {
        "area_m2": 2000,
        "has_pand": False,
        "bestemmingen": [{"type": "Wonen"}],
        "vacancy_signal": "leeg_perceel",
        "building_metrics": {"pand_oppervlakte_m2": 0},
    }
    result = compute_score_v3(parcel)
    assert result.potentie_score > 50


def test_risky_parcel_high_risico():
    """Old building + klei + contamination = high risico."""
    parcel = {
        "area_m2": 300,
        "bouwjaar": 1920,
        "bestemmingen": [{"type": "Bedrijventerrein"}],
        "vacancy_signal": "in_gebruik",
        "building_metrics": {"pand_oppervlakte_m2": 250},
        "funderingsrisico": {"fgr": "hoog"},
        "bodemtype": {"dominant_type": "veen"},
        "bodem": {"has_known_contamination": True, "dossiers_count": 5},
        "energielabel": {"energieklasse": "G"},
    }
    result = compute_score_v3(parcel)
    assert result.risico_score > 50


def test_overall_can_be_negative():
    """High risk + low potentie = negative overall."""
    parcel = {
        "area_m2": 100,
        "bouwjaar": 1910,
        "bestemmingen": [{"type": "Bedrijventerrein"}],
        "vacancy_signal": "in_gebruik",
        "building_metrics": {"pand_oppervlakte_m2": 90},
        "funderingsrisico": {"fgr": "hoog"},
        "bodemtype": {"dominant_type": "veen"},
        "bodem": {"has_known_contamination": True, "dossiers_count": 10},
        "energielabel": {"energieklasse": "G"},
    }
    result = compute_score_v3(parcel)
    # With bad everything, overall should be low
    assert result.overall < 25


def test_category_thresholds():
    """Verify Hoog/Gemiddeld/Laag boundaries."""
    # Create scenarios by manipulating parcels
    # Hoog: > 40
    high_parcel = {
        "area_m2": 5000,
        "has_pand": False,
        "bestemmingen": [{"type": "Wonen"}],
        "vacancy_signal": "leeg_perceel",
        "building_metrics": {"pand_oppervlakte_m2": 0},
    }
    r_high = compute_score_v3(high_parcel)

    # Laag: <= 10
    low_parcel = {
        "area_m2": 80,
        "bouwjaar": 1910,
        "bestemmingen": [{"type": "Bedrijventerrein"}],
        "vacancy_signal": "in_gebruik",
        "building_metrics": {"pand_oppervlakte_m2": 75},
        "funderingsrisico": {"fgr": "hoog"},
        "bodemtype": {"dominant_type": "veen"},
        "bodem": {"has_known_contamination": True, "dossiers_count": 5},
        "energielabel": {"energieklasse": "G"},
    }
    r_low = compute_score_v3(low_parcel)

    # At minimum one should be Hoog and one should be Laag
    assert r_high.category in ("Hoog", "Gemiddeld")
    assert r_low.category in ("Laag", "Gemiddeld")
    assert r_high.overall > r_low.overall


# ---------------------------------------------------------------------------
# Narrative tests
# ---------------------------------------------------------------------------

def test_toelichting_kort_not_empty(full_parcel_data, full_neighborhood_metrics):
    result = compute_score_v3(full_parcel_data, full_neighborhood_metrics)
    for name, factor in result.score_breakdown.items():
        assert factor.toelichting_kort, f"{name} has empty toelichting_kort"
        assert len(factor.toelichting_kort) > 5, f"{name} toelichting_kort too short"


def test_toelichting_lang_not_empty(full_parcel_data, full_neighborhood_metrics):
    result = compute_score_v3(full_parcel_data, full_neighborhood_metrics)
    for name, factor in result.score_breakdown.items():
        assert factor.toelichting_lang, f"{name} has empty toelichting_lang"
        assert len(factor.toelichting_lang) > 20, f"{name} toelichting_lang too short"


def test_data_bronnen_not_empty(full_parcel_data, full_neighborhood_metrics):
    result = compute_score_v3(full_parcel_data, full_neighborhood_metrics)
    for name, factor in result.score_breakdown.items():
        assert factor.data_bronnen, f"{name} has empty data_bronnen"
        assert len(factor.data_bronnen) >= 1


def test_missing_factor_narrative_mentions_unavailable():
    """Missing factor narratives should indicate data is unavailable."""
    parcel = {"area_m2": 500, "bestemmingen": [{"type": "Wonen"}]}
    result = compute_score_v3(parcel, None)

    for name, factor in result.score_breakdown.items():
        if factor.missing:
            kort_lower = factor.toelichting_kort.lower()
            lang_lower = factor.toelichting_lang.lower()
            has_missing_indicator = any(
                word in kort_lower or word in lang_lower
                for word in ("onbekend", "geen", "niet beschikbaar", "onvoldoende", "neutraal")
            )
            assert has_missing_indicator, (
                f"{name} is missing but narrative doesn't indicate unavailability: "
                f"kort='{factor.toelichting_kort}'"
            )


# ---------------------------------------------------------------------------
# Model version test
# ---------------------------------------------------------------------------

def test_model_version_is_v3(full_parcel_data):
    result = compute_score_v3(full_parcel_data)
    assert result.model_version == "score-v3.0"


# ---------------------------------------------------------------------------
# Breakdown structure test
# ---------------------------------------------------------------------------

def test_score_breakdown_has_expected_keys(full_parcel_data, full_neighborhood_metrics):
    """All 21 factor names present in breakdown."""
    result = compute_score_v3(full_parcel_data, full_neighborhood_metrics)
    expected_keys = {
        # Potentie
        "vrije_grond", "optoppotentie", "bestemming", "leegstand",
        "funda_frictie", "perceelgrootte", "demografie", "vergunning_succeskans",
        # Risico
        "funderingsrisico", "asbest", "bodemverontreiniging", "monument",
        "bestemmingswijziging", "constructieve_staat", "juridisch_klimaat",
        "criminaliteit", "max_hoogte_bereikt",
        # New factors
        "luchtkwaliteit", "overstromingsrisico", "natura2000", "geluid",
    }
    assert set(result.score_breakdown.keys()) == expected_keys
    assert len(result.score_breakdown) == 21


def test_all_potentie_factors_have_correct_categorie(full_parcel_data, full_neighborhood_metrics):
    result = compute_score_v3(full_parcel_data, full_neighborhood_metrics)
    potentie_names = {
        "vrije_grond", "optoppotentie", "bestemming", "leegstand",
        "funda_frictie", "perceelgrootte", "demografie", "vergunning_succeskans",
    }
    for name in potentie_names:
        assert result.score_breakdown[name].categorie == "potentie", f"{name} wrong categorie"


def test_all_risico_factors_have_correct_categorie(full_parcel_data, full_neighborhood_metrics):
    result = compute_score_v3(full_parcel_data, full_neighborhood_metrics)
    risico_names = {
        "funderingsrisico", "asbest", "bodemverontreiniging", "monument",
        "bestemmingswijziging", "constructieve_staat", "juridisch_klimaat",
        "criminaliteit", "max_hoogte_bereikt",
        "luchtkwaliteit", "overstromingsrisico", "natura2000", "geluid",
    }
    for name in risico_names:
        assert result.score_breakdown[name].categorie == "risico", f"{name} wrong categorie"


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_empty_parcel_data():
    """Scoring with empty dict should not crash."""
    result = compute_score_v3({})
    assert 0 <= result.potentie_score <= 100
    assert 0 <= result.risico_score <= 100
    assert isinstance(result.overall, float)
    assert result.missing_factor_count > 0


def test_missing_factor_count(minimal_parcel_data):
    """Missing count should reflect actual missing factors."""
    result = compute_score_v3(minimal_parcel_data, None)
    assert result.missing_factor_count > 0
    actual_missing = sum(1 for f in result.score_breakdown.values() if f.missing)
    assert result.missing_factor_count == actual_missing


def test_factor_bijdrage_equals_score_times_weight(full_parcel_data, full_neighborhood_metrics):
    """Each factor's bijdrage should equal score * gewicht."""
    result = compute_score_v3(full_parcel_data, full_neighborhood_metrics)
    for name, factor in result.score_breakdown.items():
        expected = round(factor.genormaliseerde_score * factor.gewicht, 4)
        assert factor.bijdrage == pytest.approx(expected, abs=0.01), (
            f"{name}: bijdrage {factor.bijdrage} != score {factor.genormaliseerde_score} * gewicht {factor.gewicht}"
        )
