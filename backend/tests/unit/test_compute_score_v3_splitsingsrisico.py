"""M053/S12 — splitsingsrisico in compute_score_v3: verdict-gating + sparse weight-0."""
from app.ai.factors.splitsingsrisico import HuisvestingsverordeningPayload
from app.services.score_v3 import compute_score_v3

_PAYLOAD = HuisvestingsverordeningPayload.model_validate({
    "opkoopbescherming": {
        "van_kracht": True, "duur_jaren": 4, "woz_grens_eur": 306000,
        "buurten": [{"buurt_naam": "Craneveld", "cbs_buurt_code": "BU09831401"}],
    },
    "confidence": 0.9,
})


def _parcel(buurt: str | None) -> dict:
    return {"area_m2": 500, "has_pand": True, "buurt_code": buurt, "woz": None}


def test_in_beschermde_buurt_krijgt_gewicht():
    r = compute_score_v3(_parcel("BU09831401"), {}, cascade_payloads={"splitsingsrisico": _PAYLOAD})
    f = r.score_breakdown["splitsingsrisico"]
    assert f.waarde["verdict"] == "mogelijk_van_toepassing"
    assert f.gewicht == 7.0 and f.bijdrage > 0


def test_buiten_beschermd_gebied_context_only():
    r = compute_score_v3(_parcel("BU09839999"), {}, cascade_payloads={"splitsingsrisico": _PAYLOAD})
    f = r.score_breakdown["splitsingsrisico"]
    assert f.waarde["verdict"] == "buiten_beschermd_gebied"
    assert f.gewicht == 0.0 and f.bijdrage == 0.0  # zichtbaar in card, telt niet mee


def test_geen_payload_missing_weight_0():
    r = compute_score_v3(_parcel("BU09831401"), {}, cascade_payloads={})
    f = r.score_breakdown["splitsingsrisico"]
    assert f.missing is True and f.gewicht == 0


def _parcel_woz(buurt, waarde):
    return {"area_m2": 500, "has_pand": True, "buurt_code": buurt,
            "woz": {"meest_recente_waarde": waarde, "bron": "WOZ"}}


def test_woz_onder_grens_van_toepassing():
    r = compute_score_v3(_parcel_woz("BU09831401", 250000), {}, cascade_payloads={"splitsingsrisico": _PAYLOAD})
    f = r.score_breakdown["splitsingsrisico"]
    assert f.waarde["verdict"] == "van_toepassing"
    assert f.gewicht == 7.0


def test_woz_boven_grens_context_only():
    r = compute_score_v3(_parcel_woz("BU09831401", 400000), {}, cascade_payloads={"splitsingsrisico": _PAYLOAD})
    f = r.score_breakdown["splitsingsrisico"]
    assert f.waarde["verdict"] == "boven_woz_grens"
    assert f.gewicht == 0.0  # boven grens = niet actief
