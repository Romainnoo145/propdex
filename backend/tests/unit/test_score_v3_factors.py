"""Tests for score_v3_factors.py — helpers and 10 scoring functions.

Each scoring function is pure (dict → FactorResult), no DB or async needed.
Tests cover: happy path, missing/empty data, edge cases.
"""

import math

import pytest

from app.services.score_v3 import FactorResult
from app.services.score_v3_factors import (
    _best_bestemming_type,
    _get,
    normalize_binary,
    normalize_linear,
    normalize_log,
    score_asbest,
    score_bestemming,
    score_funderingsrisico,
    score_geluid,
    score_leegstand,
    score_luchtkwaliteit,
    score_monument,
    score_overstromingsrisico,
    score_perceelgrootte,
    score_vrije_grond,
)


# ---------------------------------------------------------------------------
# Helper: normalize_log
# ---------------------------------------------------------------------------

class TestNormalizeLog:
    def test_positive_value(self):
        result = normalize_log(100, 10000)
        assert 0.0 < result < 1.0

    def test_zero_value(self):
        assert normalize_log(0, 10000) == 0.0

    def test_negative_value(self):
        assert normalize_log(-5, 10000) == 0.0

    def test_value_at_max(self):
        result = normalize_log(10000, 10000)
        assert result == pytest.approx(1.0)

    def test_value_exceeds_max(self):
        result = normalize_log(20000, 10000)
        assert result == 1.0  # clamped

    def test_zero_max(self):
        assert normalize_log(100, 0) == 0.0

    def test_negative_max(self):
        assert normalize_log(100, -1) == 0.0

    def test_math_correctness(self):
        """Verify log1p formula directly."""
        val, mx = 50, 1000
        expected = min(1.0, math.log1p(val) / math.log1p(mx))
        assert normalize_log(val, mx) == pytest.approx(expected)


# ---------------------------------------------------------------------------
# Helper: normalize_linear
# ---------------------------------------------------------------------------

class TestNormalizeLinear:
    def test_midpoint(self):
        assert normalize_linear(50, 0, 100) == pytest.approx(0.5)

    def test_at_min(self):
        assert normalize_linear(0, 0, 100) == pytest.approx(0.0)

    def test_at_max(self):
        assert normalize_linear(100, 0, 100) == pytest.approx(1.0)

    def test_below_min_clamped(self):
        assert normalize_linear(-10, 0, 100) == 0.0

    def test_above_max_clamped(self):
        assert normalize_linear(200, 0, 100) == 1.0

    def test_equal_min_max_returns_zero(self):
        assert normalize_linear(50, 50, 50) == 0.0

    def test_inverted_range_returns_zero(self):
        assert normalize_linear(50, 100, 0) == 0.0


# ---------------------------------------------------------------------------
# Helper: normalize_binary
# ---------------------------------------------------------------------------

class TestNormalizeBinary:
    def test_true(self):
        assert normalize_binary(True) == 1.0

    def test_false(self):
        assert normalize_binary(False) == 0.0

    def test_truthy_value(self):
        assert normalize_binary(1) == 1.0

    def test_falsy_value(self):
        assert normalize_binary(0) == 0.0


# ---------------------------------------------------------------------------
# Helper: _get
# ---------------------------------------------------------------------------

class TestGet:
    def test_single_key(self):
        assert _get({"a": 1}, "a") == 1

    def test_nested_keys(self):
        assert _get({"a": {"b": {"c": 42}}}, "a", "b", "c") == 42

    def test_missing_key_returns_default(self):
        assert _get({"a": 1}, "b") is None

    def test_custom_default(self):
        assert _get({"a": 1}, "b", default=99) == 99

    def test_none_dict(self):
        assert _get(None, "a") is None

    def test_intermediate_none(self):
        assert _get({"a": None}, "a", "b") is None

    def test_intermediate_non_dict(self):
        assert _get({"a": "string"}, "a", "b") is None

    def test_empty_dict(self):
        assert _get({}, "a", "b", "c", default="x") == "x"

    def test_no_keys(self):
        d = {"a": 1}
        assert _get(d) == d


# ---------------------------------------------------------------------------
# Helper: _best_bestemming_type
# ---------------------------------------------------------------------------

class TestBestBestemmingType:
    def test_wonen_highest_priority(self):
        data = {"bestemmingen": [{"type": "Wonen"}, {"type": "Gemengd"}]}
        assert _best_bestemming_type(data) == "wonen"

    def test_gemengd(self):
        data = {"bestemmingen": [{"type": "Gemengd - 1"}]}
        assert "gemengd" in _best_bestemming_type(data)

    def test_centrum(self):
        data = {"bestemmingen": [{"type": "Centrum"}]}
        assert "centrum" in _best_bestemming_type(data)

    def test_empty_bestemmingen(self):
        assert _best_bestemming_type({"bestemmingen": []}) == "onbekend"

    def test_no_bestemmingen_key(self):
        assert _best_bestemming_type({}) == "onbekend"

    def test_none_bestemmingen(self):
        assert _best_bestemming_type({"bestemmingen": None}) == "onbekend"

    def test_non_dict_items_skipped(self):
        data = {"bestemmingen": ["not a dict", {"type": "Wonen"}]}
        assert _best_bestemming_type(data) == "wonen"


# ---------------------------------------------------------------------------
# score_vrije_grond (P1)
# ---------------------------------------------------------------------------

class TestScoreVrijeGrond:
    def test_happy_path_large_free_ground(self):
        data = {"area_m2": 1000, "building_metrics": {"pand_oppervlakte_m2": 200}}
        result = score_vrije_grond(data)
        assert isinstance(result, FactorResult)
        assert result.categorie == "potentie"
        assert result.gewicht == 12
        assert result.missing is False
        assert result.genormaliseerde_score > 0.5  # 80% free ground

    def test_no_area(self):
        result = score_vrije_grond({})
        assert result.genormaliseerde_score == pytest.approx(0.0)
        assert result.missing is False
        assert result.waarde == pytest.approx(0.0)

    def test_zero_area(self):
        data = {"area_m2": 0}
        result = score_vrije_grond(data)
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_fully_built(self):
        data = {"area_m2": 500, "building_metrics": {"pand_oppervlakte_m2": 500}}
        result = score_vrije_grond(data)
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_building_larger_than_parcel(self):
        """Edge case: pand_oppervlakte > area (overhang etc.)."""
        data = {"area_m2": 100, "building_metrics": {"pand_oppervlakte_m2": 150}}
        result = score_vrije_grond(data)
        # ratio clamped at 0, score should be 0
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_bijdrage_equals_score_times_weight(self):
        data = {"area_m2": 2000, "building_metrics": {"pand_oppervlakte_m2": 500}}
        result = score_vrije_grond(data)
        assert result.bijdrage == pytest.approx(
            result.genormaliseerde_score * result.gewicht, abs=0.001
        )


# ---------------------------------------------------------------------------
# score_bestemming (P3)
# ---------------------------------------------------------------------------

class TestScoreBestemming:
    def test_wonen_max_score(self):
        data = {"bestemmingen": [{"type": "Wonen"}]}
        result = score_bestemming(data)
        assert result.genormaliseerde_score == pytest.approx(1.0)
        assert result.categorie == "potentie"
        assert result.missing is False

    def test_gemengd_score(self):
        data = {"bestemmingen": [{"type": "Gemengd - 2"}]}
        result = score_bestemming(data)
        assert result.genormaliseerde_score == pytest.approx(0.7)

    def test_maatschappelijk_score(self):
        data = {"bestemmingen": [{"type": "Maatschappelijk"}]}
        result = score_bestemming(data)
        assert result.genormaliseerde_score == pytest.approx(0.4)

    def test_unknown_type_low_score(self):
        data = {"bestemmingen": [{"type": "Agrarisch"}]}
        result = score_bestemming(data)
        assert result.genormaliseerde_score == pytest.approx(0.2)

    def test_empty_bestemmingen(self):
        result = score_bestemming({"bestemmingen": []})
        assert result.genormaliseerde_score == pytest.approx(0.2)
        assert result.waarde == "onbekend"

    def test_no_data(self):
        result = score_bestemming({})
        assert result.genormaliseerde_score == pytest.approx(0.2)


# ---------------------------------------------------------------------------
# score_leegstand (P4)
# ---------------------------------------------------------------------------

class TestScoreLeegstand:
    def test_leeg_perceel_max(self):
        data = {"vacancy_signal": "leeg_perceel"}
        result = score_leegstand(data)
        assert result.genormaliseerde_score == pytest.approx(1.0)
        assert result.categorie == "potentie"

    def test_leegstaand_pand(self):
        data = {"vacancy_signal": "leegstaand_pand"}
        result = score_leegstand(data)
        assert result.genormaliseerde_score == pytest.approx(0.8)

    def test_in_gebruik_zero(self):
        data = {"vacancy_signal": "in_gebruik"}
        result = score_leegstand(data)
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_onbekend_signal(self):
        data = {"vacancy_signal": "onbekend"}
        result = score_leegstand(data)
        assert result.genormaliseerde_score == pytest.approx(0.3)

    def test_missing_signal_defaults_onbekend(self):
        result = score_leegstand({})
        assert result.genormaliseerde_score == pytest.approx(0.3)

    def test_none_signal(self):
        data = {"vacancy_signal": None}
        result = score_leegstand(data)
        assert result.genormaliseerde_score == pytest.approx(0.3)


# ---------------------------------------------------------------------------
# score_perceelgrootte (P6)
# ---------------------------------------------------------------------------

class TestScorePerceelgrootte:
    def test_large_parcel(self):
        data = {"area_m2": 5000}
        result = score_perceelgrootte(data)
        assert result.categorie == "potentie"
        assert result.gewicht == 12
        assert result.genormaliseerde_score > 0.7

    def test_small_parcel(self):
        data = {"area_m2": 100}
        result = score_perceelgrootte(data)
        assert result.genormaliseerde_score > 0.0
        assert result.genormaliseerde_score < 0.6

    def test_zero_area(self):
        result = score_perceelgrootte({"area_m2": 0})
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_no_area(self):
        result = score_perceelgrootte({})
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_at_max_reference(self):
        """10000 m² is the max reference — score should be 1.0."""
        data = {"area_m2": 10000}
        result = score_perceelgrootte(data)
        assert result.genormaliseerde_score == pytest.approx(1.0)

    def test_toelichting_has_area(self):
        data = {"area_m2": 2500}
        result = score_perceelgrootte(data)
        assert "2500" in result.toelichting_kort


# ---------------------------------------------------------------------------
# score_funderingsrisico (R1)
# ---------------------------------------------------------------------------

class TestScoreFunderingsrisico:
    def test_high_risk_full_compound(self):
        """High FGR + slappe bodem + pre-1970 → score 1.0."""
        data = {
            "funderingsrisico": {"fgr": "hoog"},
            "bodemtype": {"dominant_type": "veen"},
            "bouwjaar": 1950,
        }
        result = score_funderingsrisico(data)
        assert result.categorie == "risico"
        assert result.gewicht == 15
        assert result.genormaliseerde_score == pytest.approx(1.0)
        assert result.missing is False

    def test_high_risk_no_compound(self):
        data = {
            "funderingsrisico": {"fgr": "hoog"},
            "bodemtype": {"dominant_type": "zand"},
            "bouwjaar": 2000,
        }
        result = score_funderingsrisico(data)
        assert result.genormaliseerde_score == pytest.approx(0.8)

    def test_low_risk(self):
        data = {
            "funderingsrisico": {"fgr": "laag"},
            "bodemtype": {"dominant_type": "zand"},
            "bouwjaar": 2010,
        }
        result = score_funderingsrisico(data)
        assert result.genormaliseerde_score == pytest.approx(0.2)

    def test_missing_data_neutral(self):
        result = score_funderingsrisico({})
        assert result.genormaliseerde_score == pytest.approx(0.5)
        assert result.missing is True

    def test_none_funderingsrisico(self):
        data = {"funderingsrisico": None}
        result = score_funderingsrisico(data)
        assert result.missing is True

    def test_compound_boost_gemiddeld_slappe_bodem_pre1970(self):
        """Gemiddeld FGR + slappe bodem + pre-1970 gets +0.15 boost."""
        data = {
            "funderingsrisico": {"fgr": "gemiddeld"},
            "bodemtype": {"dominant_type": "klei"},
            "bouwjaar": 1960,
        }
        result = score_funderingsrisico(data)
        # base 0.5 + 0.15 = 0.65
        assert result.genormaliseerde_score == pytest.approx(0.65)


# ---------------------------------------------------------------------------
# score_asbest (R2)
# ---------------------------------------------------------------------------

class TestScoreAsbest:
    def test_pre_1994_residential(self):
        data = {"bouwjaar": 1980}
        result = score_asbest(data)
        assert result.categorie == "risico"
        assert result.genormaliseerde_score == pytest.approx(0.7)
        assert result.missing is False

    def test_pre_1994_industrial(self):
        data = {
            "bouwjaar": 1975,
            "bestemmingen": [{"type": "Bedrijventerrein"}],
        }
        result = score_asbest(data)
        assert result.genormaliseerde_score == pytest.approx(1.0)

    def test_post_2000_zero(self):
        data = {"bouwjaar": 2005}
        result = score_asbest(data)
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_between_1994_2000(self):
        data = {"bouwjaar": 1997}
        result = score_asbest(data)
        assert result.genormaliseerde_score == pytest.approx(0.2)

    def test_missing_bouwjaar(self):
        result = score_asbest({})
        assert result.missing is True
        assert result.genormaliseerde_score == pytest.approx(0.5)

    def test_none_bouwjaar(self):
        result = score_asbest({"bouwjaar": None})
        assert result.missing is True


# ---------------------------------------------------------------------------
# score_monument (R4)
# ---------------------------------------------------------------------------

class TestScoreMonument:
    def test_monument_detected(self):
        """Pre-S05 alle keyword-hits waren missing=False. Post-S05: keyword-path
        is fallback (RCE ontbreekt), dus missing=True signaleert data-provenance
        voor frontend. genormaliseerde_score blijft 1.0 (detection correct)."""
        data = {"bestemmingen": [{"type": "Waarde - Cultuurhistorie", "naam": "monument"}]}
        result = score_monument(data)
        assert result.categorie == "risico"
        assert result.genormaliseerde_score == pytest.approx(1.0)
        assert result.missing is True, "M046/S05: fallback path → missing=True"

    def test_no_monument(self):
        data = {"bestemmingen": [{"type": "Wonen", "naam": "Wonen - 1"}]}
        result = score_monument(data)
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_empty_bestemmingen(self):
        result = score_monument({"bestemmingen": []})
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_no_bestemmingen(self):
        result = score_monument({})
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_erfgoed_in_naam(self):
        data = {"bestemmingen": [{"type": "Bestemming", "naam": "Erfgoed zone A"}]}
        result = score_monument(data)
        assert result.genormaliseerde_score == pytest.approx(1.0)

    def test_waarde_in_type(self):
        """'waarde' keyword in type triggers monument detection."""
        data = {"bestemmingen": [{"type": "Waarde - Archeologie"}]}
        result = score_monument(data)
        assert result.genormaliseerde_score == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# score_overstromingsrisico (R11)
# ---------------------------------------------------------------------------

class TestScoreOverstromingsrisico:
    def test_in_risk_zone(self):
        data = {
            "overstromingsrisico": {
                "in_risk_zone": True,
                "description": "dijkring 43",
                "qualitative_value": "groot",
            }
        }
        result = score_overstromingsrisico(data)
        assert result.categorie == "risico"
        assert result.genormaliseerde_score == pytest.approx(1.0)
        assert result.missing is False

    def test_not_in_risk_zone(self):
        data = {"overstromingsrisico": {"in_risk_zone": False}}
        result = score_overstromingsrisico(data)
        assert result.genormaliseerde_score == pytest.approx(0.0)

    def test_missing_data(self):
        result = score_overstromingsrisico({})
        assert result.genormaliseerde_score == pytest.approx(0.5)
        assert result.missing is True

    def test_none_data(self):
        result = score_overstromingsrisico({"overstromingsrisico": None})
        assert result.missing is True

    def test_empty_dict(self):
        """Empty dict is falsy via `not ostr` check."""
        result = score_overstromingsrisico({"overstromingsrisico": {}})
        assert result.missing is True


# ---------------------------------------------------------------------------
# score_geluid (R12)
# ---------------------------------------------------------------------------

class TestScoreGeluid:
    def test_acceptabel(self):
        data = {"geluid": {"classification": "acceptabel", "lden_db": 40}}
        result = score_geluid(data)
        assert result.categorie == "risico"
        assert result.genormaliseerde_score == pytest.approx(0.0)
        assert result.missing is False

    def test_hoog(self):
        data = {"geluid": {"classification": "hoog", "lden_db": 60}}
        result = score_geluid(data)
        assert result.genormaliseerde_score == pytest.approx(0.7)

    def test_zeer_hoog(self):
        data = {"geluid": {"classification": "zeer_hoog", "lden_db": 70}}
        result = score_geluid(data)
        assert result.genormaliseerde_score == pytest.approx(1.0)

    def test_verhoogd(self):
        data = {"geluid": {"classification": "verhoogd"}}
        result = score_geluid(data)
        assert result.genormaliseerde_score == pytest.approx(0.4)

    def test_missing_data(self):
        result = score_geluid({})
        assert result.genormaliseerde_score == pytest.approx(0.3)
        assert result.missing is True

    def test_unknown_classification(self):
        data = {"geluid": {"classification": "something_else"}}
        result = score_geluid(data)
        assert result.genormaliseerde_score == pytest.approx(0.3)


# ---------------------------------------------------------------------------
# score_luchtkwaliteit (R13)
# ---------------------------------------------------------------------------

class TestScoreLuchtkwaliteit:
    def test_clean_air(self):
        data = {"luchtkwaliteit": {"no2_ugm3": 15, "pm10_ugm3": 10, "boven_grenswaarde": False}}
        result = score_luchtkwaliteit(data)
        assert result.categorie == "risico"
        assert result.genormaliseerde_score == pytest.approx(0.0)
        assert result.missing is False

    def test_at_eu_limit(self):
        data = {"luchtkwaliteit": {"no2_ugm3": 50, "boven_grenswaarde": True}}
        result = score_luchtkwaliteit(data)
        assert result.genormaliseerde_score == pytest.approx(1.0)

    def test_mid_range(self):
        data = {"luchtkwaliteit": {"no2_ugm3": 35, "boven_grenswaarde": False}}
        result = score_luchtkwaliteit(data)
        assert result.genormaliseerde_score == pytest.approx(0.5)

    def test_missing_data(self):
        result = score_luchtkwaliteit({})
        assert result.genormaliseerde_score == pytest.approx(0.3)
        assert result.missing is True

    def test_no_no2_but_boven_grenswaarde(self):
        data = {"luchtkwaliteit": {"boven_grenswaarde": True}}
        result = score_luchtkwaliteit(data)
        assert result.genormaliseerde_score == pytest.approx(1.0)

    def test_no_no2_no_flag(self):
        data = {"luchtkwaliteit": {"pm10_ugm3": 25}}
        result = score_luchtkwaliteit(data)
        # no2 is None, boven_grenswaarde is falsy → 0.3
        assert result.genormaliseerde_score == pytest.approx(0.3)

    def test_toelichting_contains_pollutants(self):
        data = {"luchtkwaliteit": {"no2_ugm3": 30, "pm10_ugm3": 20, "boven_grenswaarde": False}}
        result = score_luchtkwaliteit(data)
        assert "NO2" in result.toelichting_kort
        assert "PM10" in result.toelichting_kort
