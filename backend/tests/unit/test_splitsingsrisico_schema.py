"""Unit tests M053/S12 — HuisvestingsverordeningPayload schema."""
import pytest
from pydantic import ValidationError

from app.ai.factors.splitsingsrisico import (
    HUISVESTINGSVERORDENING_FACTOR_DEF,
    HuisvestingsverordeningPayload,
)


def _venlo_payload() -> dict:
    return {
        "geldig_van": "2026-07-01",
        "geldig_tot": "2030-06-30",
        "voorraad_vergunningplichten": [],
        "huisvestingsvergunning_scope": "corporatie_sociale_huur",
        "opkoopbescherming": {
            "van_kracht": True,
            "duur_jaren": 4,
            "woz_grens_eur": 306000,
            "woz_peiljaar": 2022,
            "buurten": [
                {"buurt_naam": "Craneveld", "cbs_buurt_code": "BU09831401"},
                {"buurt_naam": "Q4", "cbs_buurt_code": "BU09831102"},
            ],
            "citaat": "Gedurende de periode van vier jaren na de datum van inschrijving is het verboden beschermde woonruimte te verhuren zonder verhuurvergunning opkoopbescherming.",
        },
        "randvoorwaarden": [],
        "confidence": 0.95,
    }


def test_payload_validates_venlo_shape():
    p = HuisvestingsverordeningPayload.model_validate(_venlo_payload())
    assert p.opkoopbescherming is not None
    assert p.opkoopbescherming.woz_grens_eur == 306000
    assert p.opkoopbescherming.buurten[0].cbs_buurt_code == "BU09831401"
    assert p.voorraad_vergunningplichten == []


def test_payload_rejects_unknown_vergunningplicht():
    bad = _venlo_payload()
    bad["voorraad_vergunningplichten"] = ["verhuurverbod"]  # geen geldige enum
    with pytest.raises(ValidationError):
        HuisvestingsverordeningPayload.model_validate(bad)


def test_factor_def_wiring():
    assert HUISVESTINGSVERORDENING_FACTOR_DEF.factor_id == "splitsingsrisico"
    assert HUISVESTINGSVERORDENING_FACTOR_DEF.payload_model is HuisvestingsverordeningPayload
    schema = HUISVESTINGSVERORDENING_FACTOR_DEF.input_schema
    assert "opkoopbescherming" in schema["properties"]
    assert "confidence" in schema["required"]
