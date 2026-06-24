"""Tests voor de gecureerde welstand-laag dakkapel (M055/S02)."""

from app.reports_v2.welstand_dakkapel import welstand_dakkapel


def test_venlo_geeft_gecureerde_welstand():
    blok = welstand_dakkapel("0983")
    assert blok is not None
    assert blok.samenvatting
    assert 0.0 <= blok.confidence <= 1.0


def test_onbekende_gemeente_geeft_none():
    assert welstand_dakkapel("9999") is None
    assert welstand_dakkapel(None) is None
