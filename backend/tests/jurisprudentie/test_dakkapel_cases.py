"""Tests voor dakkapel-jurisprudentie + selector-registratie (M055/S02)."""

from app.jurisprudentie.dakkapel_cases import DAKKAPEL_CASES
from app.jurisprudentie.selector import select_cases


def test_dakkapel_cases_zijn_geldig():
    assert len(DAKKAPEL_CASES) >= 1
    for c in DAKKAPEL_CASES:
        assert c.verbouwingstype == "dakkapel"
        assert c.ecli.startswith("ECLI:")
        assert c.bron_url.startswith("https://")
        assert c.duiding


def test_selector_kent_dakkapel():
    cases = select_cases("dakkapel", themas=["welstand"], gemeente_code=None, limit=4)
    assert all(c.verbouwingstype == "dakkapel" for c in cases)
