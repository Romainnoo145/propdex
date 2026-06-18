"""Unit tests M054/S02 — ParkeernormenPayload schema."""
import pytest
from pydantic import ValidationError

from app.ai.factors.parkeerdruk import (
    PARKEERNORMEN_FACTOR_DEF,
    ParkeernormenPayload,
)


def _venlo_payload() -> dict:
    return {
        "peiljaar": 2026,
        "parkeerregulering_van_toepassing": True,
        "normbanden": [
            {
                "functie": "koop, appartement >100 m² bvo",
                "functiecategorie": "wonen",
                "bestemming_trefwoorden": ["wonen", "gemengd"],
                "gebied": "centrum",
                "auto_norm_per_eenheid": 1.0,
                "eenheid": "per woning",
                "fiets_norm_per_eenheid": 2.0,
                "bezoekers_aandeel": 0.3,
                "citaat": "In het centrum geldt een autonorm van 1,0 per appartement.",
                "pagina": 18,
            },
            {
                "functie": "fullservice supermarkt",
                "functiecategorie": "winkelen",
                "bestemming_trefwoorden": ["centrum", "detailhandel"],
                "gebied": "rest_bebouwde_kom",
                "auto_norm_per_eenheid": 3.5,
                "eenheid": "pp per 100 m² bvo",
            },
        ],
        "openbare_ruimte_drempel_pct": 70,
        "centrum_uitgesloten": True,
        "mobiliteitscorrecties": [
            {
                "type": "hov_station",
                "max_reductie_pct": 15,
                "voorwaarde": "binnen 0-200 m van HOV-station Venlo",
                "citaat": "Bij ligging binnen 200 meter van een HOV-station geldt 15% reductie.",
            },
        ],
        "nul_norm_sociale_huur_mogelijk": True,
        "fietsnorm_harde_eis": True,
        "algemeen_citaat": "Parkeren wordt in beginsel op eigen terrein opgelost.",
        "randvoorwaarden": [],
        "confidence": 0.92,
    }


def test_payload_validates_venlo_shape():
    p = ParkeernormenPayload.model_validate(_venlo_payload())
    assert p.peiljaar == 2026
    assert p.parkeerregulering_van_toepassing is True
    assert p.normbanden[0].gebied == "centrum"
    assert p.normbanden[0].auto_norm_per_eenheid == 1.0
    assert p.fietsnorm_harde_eis is True
    assert p.openbare_ruimte_drempel_pct == 70
    assert p.mobiliteitscorrecties[0].type == "hov_station"


def test_payload_rejects_unknown_gebied():
    bad = _venlo_payload()
    bad["normbanden"][0]["gebied"] = "platteland"  # geen geldige enum
    with pytest.raises(ValidationError):
        ParkeernormenPayload.model_validate(bad)


def test_payload_rejects_unknown_functiecategorie():
    bad = _venlo_payload()
    bad["normbanden"][0]["functiecategorie"] = "industrie"  # geen geldige enum
    with pytest.raises(ValidationError):
        ParkeernormenPayload.model_validate(bad)


def test_factor_def_wiring():
    assert PARKEERNORMEN_FACTOR_DEF.factor_id == "parkeerdruk"
    assert PARKEERNORMEN_FACTOR_DEF.payload_model is ParkeernormenPayload
    schema = PARKEERNORMEN_FACTOR_DEF.input_schema
    assert "normbanden" in schema["properties"]
    assert "confidence" in schema["required"]
