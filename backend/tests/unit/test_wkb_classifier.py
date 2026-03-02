"""Unit tests for wkb_classifier.classify_wkb() — RED phase."""

from app.schemas.address import BuildingData
from app.schemas.monument import MonumentStatus
from app.services.wkb_classifier import classify_wkb


def _make_monument(consensus_status: str) -> MonumentStatus:
    return MonumentStatus(sources=[], consensus_status=consensus_status)


def test_classify_wkb_no_data_returns_onbekend():
    result = classify_wkb(building=None, monuments=None)

    assert result.wkb_applicable is True
    assert result.gevolgklasse == "onbekend"
    assert result.exclusion_reason is None
    assert result.disclaimer != ""


def test_classify_wkb_rijksmonument_excluded():
    monuments = _make_monument("rijksmonument")
    result = classify_wkb(building=None, monuments=monuments)

    assert result.wkb_applicable is False
    assert result.exclusion_reason == "rijksmonument"
    assert result.gevolgklasse == "niet_van_toepassing"


def test_classify_wkb_verbouwing_excluded():
    building = BuildingData(pand_id="test", status="Verbouwing pand")
    result = classify_wkb(building=building, monuments=None)

    assert result.wkb_applicable is False
    assert result.exclusion_reason == "verbouwing"
    assert result.gevolgklasse == "niet_van_toepassing"


def test_classify_wkb_verbouwing_excluded_trailing_space():
    building = BuildingData(pand_id="test", status="verbouwing pand  ")
    result = classify_wkb(building=building, monuments=None)

    assert result.wkb_applicable is False
    assert result.exclusion_reason == "verbouwing"


def test_classify_wkb_gk1_woonfunctie():
    building = BuildingData(pand_id="test", gebruiksdoel=["Woonfunctie"])
    result = classify_wkb(building=building, monuments=None)

    assert result.gevolgklasse == "GK1"
    assert result.wkb_applicable is True
    assert result.exclusion_reason is None


def test_classify_wkb_monument_takes_precedence_over_verbouwing():
    """Rijksmonument exclusion must be checked BEFORE verbouwing."""
    building = BuildingData(pand_id="test", status="Verbouwing pand")
    monuments = _make_monument("rijksmonument")
    result = classify_wkb(building=building, monuments=monuments)

    assert result.wkb_applicable is False
    assert result.exclusion_reason == "rijksmonument"


def test_classify_wkb_no_gebruiksdoel_returns_onbekend():
    building = BuildingData(pand_id="test", status="Pand in gebruik")
    result = classify_wkb(building=building, monuments=None)

    assert result.gevolgklasse == "onbekend"
    assert result.wkb_applicable is True


def test_classify_wkb_disclaimer_always_present():
    result = classify_wkb(building=None, monuments=None)
    assert len(result.disclaimer) > 0

    building = BuildingData(pand_id="test", status="Verbouwing pand")
    result2 = classify_wkb(building=building, monuments=None)
    assert len(result2.disclaimer) > 0
