"""Unit tests M054/S01 — GrondprijzenPayload schema (grondprijzenbrief)."""
import pytest
from pydantic import ValidationError

from app.ai.factors.grondwaarde_fit import (
    GRONDPRIJS_FACTOR_DEF,
    GrondprijzenPayload,
)


def _venlo_payload() -> dict:
    return {
        "peiljaar": 2026,
        "grondbeleidstype": "actief",
        "prijsbanden": [
            {
                "grondproduct": "bouwkavel wonen vrije sector",
                "functiecategorie": "vrij",
                "bestemming_trefwoorden": ["wonen"],
                "prijs_per_m2_min": 450.0,
                "prijs_per_m2_max": 650.0,
                "prijsgrondslag": "residueel",
                "erfpacht_mogelijk": False,
                "sociale_huur_afwijking": None,
                "citaat": "De grondprijs voor vrije sector woningbouw wordt residueel bepaald.",
                "pagina": 4,
            },
            {
                "grondproduct": "sociale huurwoning",
                "functiecategorie": "sociaal",
                "bestemming_trefwoorden": ["wonen"],
                "prijs_per_m2_min": 250.0,
                "prijs_per_m2_max": None,
                "prijsgrondslag": "vaste_prijs",
                "erfpacht_mogelijk": True,
                "sociale_huur_afwijking": "Vaste grondprijs van €250/m² voor sociale huur.",
                "citaat": "Voor sociale huur geldt een vaste grondprijs.",
                "pagina": 5,
            },
        ],
        "algemeen_citaat": "Grondprijzen Venlo 2026.",
        "randvoorwaarden": [],
        "confidence": 0.92,
    }


def test_payload_validates_venlo_shape():
    p = GrondprijzenPayload.model_validate(_venlo_payload())
    assert p.peiljaar == 2026
    assert p.grondbeleidstype == "actief"
    assert len(p.prijsbanden) == 2
    band = p.prijsbanden[0]
    assert band.functiecategorie == "vrij"
    assert band.prijsgrondslag == "residueel"
    assert band.prijs_per_m2_min == 450.0
    assert band.bestemming_trefwoorden == ["wonen"]


def test_minimal_payload_only_confidence():
    # confidence is the only required field — a brief with no parseable bands.
    p = GrondprijzenPayload.model_validate({"confidence": 0.3})
    assert p.prijsbanden == []
    assert p.peiljaar is None
    assert p.randvoorwaarden == []


def test_payload_rejects_unknown_prijsgrondslag():
    bad = _venlo_payload()
    bad["prijsbanden"][0]["prijsgrondslag"] = "onderhandeld"  # not in enum
    with pytest.raises(ValidationError):
        GrondprijzenPayload.model_validate(bad)


def test_payload_rejects_unknown_functiecategorie():
    bad = _venlo_payload()
    bad["prijsbanden"][0]["functiecategorie"] = "industrieel"  # not in enum
    with pytest.raises(ValidationError):
        GrondprijzenPayload.model_validate(bad)


def test_factor_def_wiring():
    assert GRONDPRIJS_FACTOR_DEF.factor_id == "grondwaarde_fit"
    assert GRONDPRIJS_FACTOR_DEF.tool_name == "extract_grondwaarde_fit"
    assert GRONDPRIJS_FACTOR_DEF.payload_model is GrondprijzenPayload
    schema = GRONDPRIJS_FACTOR_DEF.input_schema
    assert "prijsbanden" in schema["properties"]
    assert "confidence" in schema["required"]
