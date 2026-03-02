"""Unit tests for asbest_indicator.assess_asbest_risk() — RED phase."""

from app.schemas.address import BuildingData
from app.services.asbest_indicator import assess_asbest_risk


def test_asbest_no_building_returns_onbekend():
    result = assess_asbest_risk(building=None)

    assert result.risk == "onbekend"
    assert result.bouwjaar is None


def test_asbest_no_bouwjaar_returns_onbekend():
    building = BuildingData(pand_id="test", bouwjaar=None)
    result = assess_asbest_risk(building=building)

    assert result.risk == "onbekend"
    assert result.bouwjaar is None


def test_asbest_post_1993_geen():
    building = BuildingData(pand_id="test", bouwjaar=2000)
    result = assess_asbest_risk(building=building)

    assert result.risk == "geen"
    assert result.norm_reference is None


def test_asbest_bouwjaar_1994_boundary():
    """1994 is >= 1994 so should return geen."""
    building = BuildingData(pand_id="test", bouwjaar=1994)
    result = assess_asbest_risk(building=building)

    assert result.risk == "geen"


def test_asbest_bouwjaar_1993_boundary():
    """1993 is <= 1993 (the hoog band), so should return hoog."""
    building = BuildingData(pand_id="test", bouwjaar=1993)
    result = assess_asbest_risk(building=building)

    assert result.risk == "hoog"


def test_asbest_hoog_with_nen2991():
    building = BuildingData(pand_id="test", bouwjaar=1970)
    result = assess_asbest_risk(building=building)

    assert result.risk == "hoog"
    assert result.norm_reference == "NEN 2991"


def test_asbest_pre_1963_middel():
    building = BuildingData(pand_id="test", bouwjaar=1950)
    result = assess_asbest_risk(building=building)

    assert result.risk == "middel"
    assert result.norm_reference == "NEN 2991"


def test_asbest_bouwjaar_echoed():
    building = BuildingData(pand_id="test", bouwjaar=1980)
    result = assess_asbest_risk(building=building)

    assert result.bouwjaar == 1980
