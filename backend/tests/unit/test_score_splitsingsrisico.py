"""Unit tests M053/S12 — score_splitsingsrisico (opkoopbescherming + voorraadstelsel)."""
from app.ai.factors.splitsingsrisico import HuisvestingsverordeningPayload
from app.services.score_v3_factors import score_splitsingsrisico


def _payload(**overrides) -> HuisvestingsverordeningPayload:
    base = {
        "voorraad_vergunningplichten": [],
        "opkoopbescherming": {
            "van_kracht": True,
            "duur_jaren": 4,
            "woz_grens_eur": 306000,
            "woz_peiljaar": 2022,
            "buurten": [{"buurt_naam": "Craneveld", "cbs_buurt_code": "BU09831401"}],
        },
        "confidence": 0.9,
    }
    base.update(overrides)
    return HuisvestingsverordeningPayload.model_validate(base)


def test_no_payload_is_missing():
    r = score_splitsingsrisico(None, buurt_code="BU09831401", woz_waarde=None, has_pand=True)
    assert r.missing is True and r.categorie == "risico" and r.bijdrage == 0.0


def test_geen_pand_niet_van_toepassing():
    r = score_splitsingsrisico(_payload(), buurt_code="BU09831401", woz_waarde=None, has_pand=False)
    assert r.missing is False
    assert r.waarde["verdict"] == "niet_van_toepassing"
    assert r.genormaliseerde_score == 0.0


def test_beschermde_buurt_woz_onder_grens_van_toepassing():
    r = score_splitsingsrisico(_payload(), buurt_code="BU09831401", woz_waarde=250000, has_pand=True)
    assert r.waarde["verdict"] == "van_toepassing"
    assert r.genormaliseerde_score >= 0.8
    assert "Craneveld" in r.toelichting_kort


def test_beschermde_buurt_woz_boven_grens():
    r = score_splitsingsrisico(_payload(), buurt_code="BU09831401", woz_waarde=400000, has_pand=True)
    assert r.waarde["verdict"] == "boven_woz_grens"
    assert r.genormaliseerde_score <= 0.2


def test_beschermde_buurt_woz_onbekend_mogelijk():
    r = score_splitsingsrisico(_payload(), buurt_code="BU09831401", woz_waarde=None, has_pand=True)
    assert r.waarde["verdict"] == "mogelijk_van_toepassing"
    assert 0.4 <= r.genormaliseerde_score <= 0.6


def test_buurt_buiten_lijst_geen_risico():
    r = score_splitsingsrisico(_payload(), buurt_code="BU09839999", woz_waarde=None, has_pand=True)
    assert r.waarde["verdict"] == "buiten_beschermd_gebied"
    assert r.genormaliseerde_score == 0.0


def test_buurt_onbekend_terwijl_regeling_geldt_is_missing():
    r = score_splitsingsrisico(_payload(), buurt_code=None, woz_waarde=None, has_pand=True)
    assert r.missing is True  # eerlijk: we kunnen het niet weten zonder buurt


def test_voorraadstelsel_zonder_opkoop_geeft_basisrisico():
    p = _payload(voorraad_vergunningplichten=["splitsing", "omzetting"], opkoopbescherming=None)
    r = score_splitsingsrisico(p, buurt_code="BU09831401", woz_waarde=None, has_pand=True)
    assert r.waarde["verdict"] == "vergunningstelsel_voorraad"
    assert 0.3 <= r.genormaliseerde_score <= 0.7
