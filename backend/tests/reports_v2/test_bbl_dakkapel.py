"""Tests voor de landelijke Bbl-vergunningvrij-toets dakkapel (M055/S02)."""

from app.reports_v2.bbl_dakkapel import bbl_vergunningvrij_toets


def test_oordeel_is_conditioneel_geen_hard_verdict() -> None:
    o = bbl_vergunningvrij_toets()
    # IRON RULE (optie A): nooit een absoluut "mag wel/niet"
    assert "mits" in o.achterdakvlak.lower()
    laag = (o.achterdakvlak + o.voor_zijdakvlak).lower()
    assert "mag wel" not in laag and "mag niet" not in laag


def test_achterdakvlak_vergunningvrij_voorkant_plichtig() -> None:
    o = bbl_vergunningvrij_toets()
    assert "vergunningvrij" in o.achterdakvlak.lower()
    assert "vergunningplicht" in o.voor_zijdakvlak.lower()


def test_bepalende_factoren_bevatten_kerncriteria() -> None:
    o = bbl_vergunningvrij_toets()
    blob = " ".join(o.bepalende_factoren).lower()
    assert "1,75" in blob  # max hoogte
    assert "nok" in blob
    assert "dakvoet" in blob
