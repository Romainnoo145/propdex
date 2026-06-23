from app.ai.factors.splitsingsrisico import HuisvestingsverordeningPayload
from app.reports_v2.beleid_reader import derive_themas


def _payload(vergunningplichten, randvoorwaarden=None):
    return HuisvestingsverordeningPayload(
        geldig_van=None, geldig_tot=None,
        voorraad_vergunningplichten=vergunningplichten,
        voorraad_citaat=None,
        huisvestingsvergunning_scope="corporatie_sociale_huur",
        opkoopbescherming=None,
        randvoorwaarden=randvoorwaarden or [],
        confidence=0.9,
    )


def test_themas_include_vergunningplichten():
    p = _payload(["splitsing", "omzetting"])
    themas = derive_themas(p)
    assert "splitsing" in themas
    assert "omzetting" in themas


def test_themas_empty_when_no_vergunningplicht():
    p = _payload([])
    assert derive_themas(p) == []
