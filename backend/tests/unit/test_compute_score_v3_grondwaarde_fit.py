"""M054/S01 — grondwaarde_fit in compute_score_v3: verdict-gating + sparse weight-0."""
from app.ai.factors.grondwaarde_fit import GrondprijzenPayload
from app.services.score_v3 import compute_score_v3

_PAYLOAD = GrondprijzenPayload.model_validate({
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
})


def _parcel(bestemming_type: str) -> dict:
    return {"area_m2": 500, "has_pand": True,
            "bestemmingen": [{"type": bestemming_type, "naam": bestemming_type}]}


def test_passend_krijgt_gewicht():
    r = compute_score_v3(_parcel("wonen"), {}, cascade_payloads={"grondwaarde_fit": _PAYLOAD})
    f = r.score_breakdown["grondwaarde_fit"]
    assert f.waarde["verdict"] == "passend"
    assert f.gewicht == 8.0 and f.bijdrage > 0
    assert f.categorie == "potentie"


def test_geen_match_context_only():
    r = compute_score_v3(_parcel("bedrijf"), {}, cascade_payloads={"grondwaarde_fit": _PAYLOAD})
    f = r.score_breakdown["grondwaarde_fit"]
    assert f.waarde["verdict"] == "geen_match"
    assert f.gewicht == 0.0 and f.bijdrage == 0.0  # zichtbaar in card, telt niet mee


def test_geen_payload_missing_weight_0():
    r = compute_score_v3(_parcel("wonen"), {}, cascade_payloads={})
    f = r.score_breakdown["grondwaarde_fit"]
    assert f.waarde["verdict"] == "geen_grondbeleid"
    assert f.missing is True and f.gewicht == 0


def test_faciliterend_context_weight_0():
    payload = GrondprijzenPayload.model_validate({
        "peiljaar": 2026, "grondbeleidstype": "faciliterend",
        "prijsbanden": [{
            "grondproduct": "bouwkavel wonen", "functiecategorie": "vrij",
            "bestemming_trefwoorden": ["wonen"], "prijs_per_m2_min": 450.0,
            "prijsgrondslag": "residueel",
        }],
        "confidence": 0.9,
    })
    r = compute_score_v3(_parcel("wonen"), {}, cascade_payloads={"grondwaarde_fit": payload})
    f = r.score_breakdown["grondwaarde_fit"]
    assert f.waarde["verdict"] == "context"
    assert f.gewicht == 0.0


def test_onbekend_grondbeleid_context_weight_0():
    payload = GrondprijzenPayload.model_validate({
        "peiljaar": 2026, "grondbeleidstype": None,
        "prijsbanden": [{
            "grondproduct": "bouwkavel wonen", "functiecategorie": "vrij",
            "bestemming_trefwoorden": ["wonen"], "prijs_per_m2_min": 450.0,
            "prijsgrondslag": "residueel",
        }],
        "confidence": 0.9,
    })
    r = compute_score_v3(_parcel("wonen"), {}, cascade_payloads={"grondwaarde_fit": payload})
    f = r.score_breakdown["grondwaarde_fit"]
    assert f.waarde["verdict"] == "context"
    assert f.gewicht == 0.0
    assert f.bijdrage == 0.0


def test_residueel_actief_zonder_prijs_context_weight_0():
    payload = GrondprijzenPayload.model_validate({
        "peiljaar": 2026, "grondbeleidstype": "actief",
        "prijsbanden": [{
            "grondproduct": "bouwkavel wonen", "functiecategorie": "vrij",
            "bestemming_trefwoorden": ["wonen"],
            "prijsgrondslag": "residueel",
        }],
        "confidence": 0.9,
    })
    r = compute_score_v3(_parcel("wonen"), {}, cascade_payloads={"grondwaarde_fit": payload})
    f = r.score_breakdown["grondwaarde_fit"]
    assert f.waarde["verdict"] == "context"
    assert f.gewicht == 0.0
    assert f.bijdrage == 0.0


def test_redistribution_holds_when_grondwaarde_absent():
    """Sparse-neutral: with no grondprijzenbrief, grondwaarde_fit weight=0 and the
    potentie non-missing gewicht stays within the 100-pool (no leak)."""
    r = compute_score_v3(_parcel("wonen"), {}, cascade_payloads={})
    potentie = {k: v for k, v in r.score_breakdown.items() if v.categorie == "potentie"}
    non_missing = sum(f.gewicht for f in potentie.values() if not f.missing)
    assert non_missing <= 100.0 + 1.0
    assert r.score_breakdown["grondwaarde_fit"].gewicht == 0
