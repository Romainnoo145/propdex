"""Unit tests M054/S01 — score_grondwaarde_fit (grondprijzenbrief fit)."""
from app.ai.factors.grondwaarde_fit import GrondprijzenPayload
from app.services.score_v3_factors import score_grondwaarde_fit


def _payload(**overrides) -> GrondprijzenPayload:
    base = {
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
            },
        ],
        "confidence": 0.9,
    }
    base.update(overrides)
    return GrondprijzenPayload.model_validate(base)


def _wonen() -> list[dict]:
    return [{"type": "wonen", "naam": "Wonen"}]


def test_no_payload_is_missing():
    r = score_grondwaarde_fit(None, bestemmingen=_wonen(), area_m2=500)
    assert r.missing is True
    assert r.categorie == "potentie"
    assert r.bijdrage == 0.0
    assert r.gewicht == 0


def test_residueel_match_actief_is_passend():
    r = score_grondwaarde_fit(_payload(), bestemmingen=_wonen(), area_m2=500)
    assert r.missing is False
    assert r.waarde["verdict"] == "passend"
    assert r.genormaliseerde_score >= 0.7
    assert r.gewicht == 0  # weight applied later in compute_score_v3


def test_geen_match_voor_andere_bestemming():
    r = score_grondwaarde_fit(
        _payload(), bestemmingen=[{"type": "bedrijf", "naam": "Bedrijventerrein"}], area_m2=500
    )
    assert r.waarde["verdict"] == "geen_match"
    assert r.genormaliseerde_score == 0.0


def test_faciliterende_gemeente_is_context_only():
    p = _payload(grondbeleidstype="faciliterend")
    r = score_grondwaarde_fit(p, bestemmingen=_wonen(), area_m2=500)
    assert r.waarde["verdict"] == "context"
    # context is shown but not weight-bearing — score < passend
    assert r.genormaliseerde_score < 0.7


def test_vaste_prijs_band_is_context_only():
    p = _payload(prijsbanden=[
        {
            "grondproduct": "sociale huurwoning",
            "functiecategorie": "sociaal",
            "bestemming_trefwoorden": ["wonen"],
            "prijs_per_m2_min": 250.0,
            "prijsgrondslag": "vaste_prijs",
        },
    ])
    r = score_grondwaarde_fit(p, bestemmingen=_wonen(), area_m2=500)
    assert r.waarde["verdict"] == "context"


def test_residueel_preferred_over_vaste_when_both_match():
    # parcel "wonen" matches both the vaste (sociaal) and residueel (vrij) band;
    # the residual band must win so the verdict is passend.
    p = _payload(prijsbanden=[
        {
            "grondproduct": "sociale huurwoning",
            "functiecategorie": "sociaal",
            "bestemming_trefwoorden": ["wonen"],
            "prijs_per_m2_min": 250.0,
            "prijsgrondslag": "vaste_prijs",
        },
        {
            "grondproduct": "bouwkavel wonen vrije sector",
            "functiecategorie": "vrij",
            "bestemming_trefwoorden": ["wonen"],
            "prijs_per_m2_min": 450.0,
            "prijsgrondslag": "residueel",
        },
    ])
    r = score_grondwaarde_fit(p, bestemmingen=_wonen(), area_m2=500)
    assert r.waarde["verdict"] == "passend"
    assert r.waarde["functiecategorie"] == "vrij"


def test_kleine_perceel_scoort_lager_dan_groot():
    klein = score_grondwaarde_fit(_payload(), bestemmingen=_wonen(), area_m2=60)
    groot = score_grondwaarde_fit(_payload(), bestemmingen=_wonen(), area_m2=800)
    assert klein.genormaliseerde_score < groot.genormaliseerde_score


def test_waarde_exposes_band_and_peiljaar_for_popup():
    r = score_grondwaarde_fit(_payload(), bestemmingen=_wonen(), area_m2=500)
    w = r.waarde
    assert w["peiljaar"] == 2026
    assert w["prijs_per_m2_min"] == 450.0
    assert w["prijs_per_m2_max"] == 650.0
    assert w["prijsgrondslag"] == "residueel"
    assert "randvoorwaarden" in w
