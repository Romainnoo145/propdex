"""Tests for foundation_risk_engine.py — 4 public functions.

Pure-function heuristics: bouwjaar x bodemtype decision matrix, KCAF cost
estimation, worst-of overall risk, and end-to-end profiel composition.
No DB or async needed.
"""

import pytest

from app.schemas.address import BuildingData
from app.schemas.bodem import BodemData, WBBDossierRef
from app.schemas.fysiek_risico import (
    FoundationRisk,
    FysiekRisicoProfiel,
    KCAFCostIndication,
    SoilProfile,
)
from app.schemas.property import AsbestIndicator
from app.services.foundation_risk_engine import (
    _derive_overall_risk,
    assess_foundation_risk,
    build_fysiek_risico_profiel,
    estimate_kcaf_cost,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _building(bouwjaar: int | None = None) -> BuildingData:
    return BuildingData(pand_id="0363100012345678", bouwjaar=bouwjaar)


def _soil(dominant: str) -> SoilProfile:
    return SoilProfile(
        dominant_type=dominant,
        dominant_type_label=dominant.capitalize(),
    )


# ---------------------------------------------------------------------------
# assess_foundation_risk
# ---------------------------------------------------------------------------


class TestAssessFoundationRisk:
    """Decision matrix tests for assess_foundation_risk."""

    def test_no_building_returns_onbekend(self):
        result = assess_foundation_risk(
            building=None, soil_profile=_soil("zand"), funderingsrisicogebied=None
        )
        assert result.risk == "onbekend"
        assert result.bouwjaar is None

    def test_no_bouwjaar_returns_onbekend(self):
        result = assess_foundation_risk(
            building=_building(None), soil_profile=_soil("zand"), funderingsrisicogebied=None
        )
        assert result.risk == "onbekend"

    def test_post_1970_returns_laag(self):
        result = assess_foundation_risk(
            building=_building(1985), soil_profile=_soil("klei"), funderingsrisicogebied=None
        )
        assert result.risk == "laag"
        assert result.bouwjaar == 1985

    def test_exactly_1970_returns_laag(self):
        result = assess_foundation_risk(
            building=_building(1970), soil_profile=_soil("veen"), funderingsrisicogebied=None
        )
        assert result.risk == "laag"

    def test_pre1970_veen_returns_hoog(self):
        result = assess_foundation_risk(
            building=_building(1920), soil_profile=_soil("veen"), funderingsrisicogebied=None
        )
        assert result.risk == "hoog"
        assert result.bodemtype == "veen"
        assert result.recommended_action is not None

    def test_pre1970_klei_returns_hoog(self):
        result = assess_foundation_risk(
            building=_building(1955), soil_profile=_soil("klei"), funderingsrisicogebied=None
        )
        assert result.risk == "hoog"
        assert result.bodemtype == "klei"

    def test_pre1970_leem_returns_middel(self):
        result = assess_foundation_risk(
            building=_building(1960), soil_profile=_soil("leem"), funderingsrisicogebied=None
        )
        assert result.risk == "middel"
        assert result.bodemtype == "leem"

    def test_pre1970_zand_returns_laag(self):
        result = assess_foundation_risk(
            building=_building(1930), soil_profile=_soil("zand"), funderingsrisicogebied=None
        )
        assert result.risk == "laag"
        assert result.bodemtype == "zand"

    def test_pre1970_unknown_soil_returns_onbekend(self):
        result = assess_foundation_risk(
            building=_building(1950), soil_profile=_soil("onbekend"), funderingsrisicogebied=None
        )
        assert result.risk == "onbekend"
        assert result.recommended_action is not None

    def test_pre1970_no_soil_returns_onbekend(self):
        result = assess_foundation_risk(
            building=_building(1950), soil_profile=None, funderingsrisicogebied=None
        )
        assert result.risk == "onbekend"

    def test_reden_contains_bouwjaar(self):
        result = assess_foundation_risk(
            building=_building(1945), soil_profile=_soil("veen"), funderingsrisicogebied=None
        )
        assert "1945" in result.reden


# ---------------------------------------------------------------------------
# estimate_kcaf_cost
# ---------------------------------------------------------------------------


class TestEstimateKcafCost:
    """KCAF cost estimation tests."""

    def test_hoog_risk_returns_cost(self):
        result = estimate_kcaf_cost(risk="hoog", oppervlakte_m2=100)
        assert result is not None
        assert result.low_eur == 700 * 100
        assert result.high_eur == 1000 * 100
        assert result.oppervlakte_m2 == 100

    def test_middel_risk_returns_cost(self):
        result = estimate_kcaf_cost(risk="middel", oppervlakte_m2=80)
        assert result is not None
        assert result.low_eur == 400 * 80
        assert result.high_eur == 700 * 80

    def test_laag_risk_returns_none(self):
        assert estimate_kcaf_cost(risk="laag", oppervlakte_m2=100) is None

    def test_onbekend_risk_returns_none(self):
        assert estimate_kcaf_cost(risk="onbekend", oppervlakte_m2=100) is None

    def test_none_oppervlakte_returns_none(self):
        assert estimate_kcaf_cost(risk="hoog", oppervlakte_m2=None) is None

    def test_zero_oppervlakte_returns_none(self):
        assert estimate_kcaf_cost(risk="hoog", oppervlakte_m2=0) is None

    def test_negative_oppervlakte_returns_none(self):
        assert estimate_kcaf_cost(risk="hoog", oppervlakte_m2=-10) is None

    def test_disclaimer_present(self):
        result = estimate_kcaf_cost(risk="hoog", oppervlakte_m2=50)
        assert result is not None
        assert "KCAF" in result.disclaimer


# ---------------------------------------------------------------------------
# _derive_overall_risk
# ---------------------------------------------------------------------------


class TestDeriveOverallRisk:
    """Worst-of severity calculation tests."""

    def test_all_none_returns_onbekend(self):
        risk, _ = _derive_overall_risk(
            foundation_risk=None, asbest_indicator=None, bodem_data=None
        )
        assert risk == "onbekend"

    def test_single_hoog_foundation(self):
        fr = FoundationRisk(risk="hoog", bouwjaar=1920, bodemtype="veen", reden="test")
        risk, explanation = _derive_overall_risk(
            foundation_risk=fr, asbest_indicator=None, bodem_data=None
        )
        assert risk == "hoog"
        assert "Funderingsrisico" in explanation

    def test_worst_of_mixed_risks(self):
        fr = FoundationRisk(risk="laag", bouwjaar=1985, bodemtype="zand", reden="test")
        ai = AsbestIndicator(risk="hoog", bouwjaar=1975, reden="test asbest")
        risk, explanation = _derive_overall_risk(
            foundation_risk=fr, asbest_indicator=ai, bodem_data=None
        )
        assert risk == "hoog"
        assert "Asbestrisico" in explanation

    def test_bodem_dossiers_contribute_middel(self):
        bodem = BodemData(
            dossiers=[WBBDossierRef(wbb_dossier_dbk=1)],
            disclaimer="test",
        )
        risk, _ = _derive_overall_risk(
            foundation_risk=None, asbest_indicator=None, bodem_data=bodem
        )
        assert risk == "middel"

    def test_empty_bodem_dossiers_ignored(self):
        bodem = BodemData(dossiers=[], disclaimer="test")
        risk, _ = _derive_overall_risk(
            foundation_risk=None, asbest_indicator=None, bodem_data=bodem
        )
        assert risk == "onbekend"

    def test_laag_foundation_only(self):
        fr = FoundationRisk(risk="laag", bouwjaar=2000, bodemtype="zand", reden="test")
        risk, explanation = _derive_overall_risk(
            foundation_risk=fr, asbest_indicator=None, bodem_data=None
        )
        assert risk == "laag"
        assert "Geen verhoogde" in explanation

    def test_onbekend_risk_excluded_from_worst_of(self):
        """'onbekend' risks are NOT in _RISK_SEVERITY so they are excluded."""
        fr = FoundationRisk(risk="onbekend", bouwjaar=None, bodemtype=None, reden="test")
        risk, _ = _derive_overall_risk(
            foundation_risk=fr, asbest_indicator=None, bodem_data=None
        )
        # onbekend is not in _RISK_SEVERITY → no risks list entry → returns onbekend
        assert risk == "onbekend"


# ---------------------------------------------------------------------------
# build_fysiek_risico_profiel
# ---------------------------------------------------------------------------


class TestBuildFysiekRisicoProfiel:
    """End-to-end composition tests."""

    def test_all_none_produces_valid_profiel(self):
        profiel = build_fysiek_risico_profiel(
            foundation_risk=None,
            soil_profile=None,
            asbest_indicator=None,
            bodem_data=None,
            funderingsrisicogebied=None,
            kcaf_cost=None,
        )
        assert isinstance(profiel, FysiekRisicoProfiel)
        assert profiel.overall_risk == "onbekend"

    def test_hoog_foundation_propagates_to_overall(self):
        fr = FoundationRisk(risk="hoog", bouwjaar=1920, bodemtype="veen", reden="test")
        profiel = build_fysiek_risico_profiel(
            foundation_risk=fr,
            soil_profile=_soil("veen"),
            asbest_indicator=None,
            bodem_data=None,
            funderingsrisicogebied=None,
            kcaf_cost=None,
        )
        assert profiel.overall_risk == "hoog"
        assert profiel.foundation_risk is fr

    def test_kcaf_cost_attached(self):
        cost = KCAFCostIndication(
            low_eur=70000, high_eur=100000,
            low_per_m2=700, high_per_m2=1000,
            oppervlakte_m2=100,
            disclaimer="test",
        )
        profiel = build_fysiek_risico_profiel(
            foundation_risk=None,
            soil_profile=None,
            asbest_indicator=None,
            bodem_data=None,
            funderingsrisicogebied=None,
            kcaf_cost=cost,
        )
        assert profiel.kcaf_cost is cost
