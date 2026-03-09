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


# --- Gebruiksdoel uplift tests (Phase 89) ---


def test_asbest_industriefunctie_hoog_stays_hoog():
    """1963-1993 + industriefunctie: baseline hoog, stays hoog with factor set."""
    building = BuildingData(
        pand_id="test", bouwjaar=1980, gebruiksdoel=["Industriefunctie"]
    )
    result = assess_asbest_risk(building=building)

    assert result.risk == "hoog"
    assert result.gebruiksdoel_factor == "industriefunctie"
    assert "industriefunctie" in result.reden.lower()


def test_asbest_onderwijsfunctie_hoog_stays_hoog():
    """1963-1993 + onderwijsfunctie: baseline hoog, stays hoog with factor set."""
    building = BuildingData(
        pand_id="test", bouwjaar=1975, gebruiksdoel=["Onderwijsfunctie"]
    )
    result = assess_asbest_risk(building=building)

    assert result.risk == "hoog"
    assert result.gebruiksdoel_factor == "onderwijsfunctie"


def test_asbest_post1993_industriefunctie_uplifts_to_middel():
    """Post-1993 + industriefunctie: baseline geen -> uplifted to middel."""
    building = BuildingData(
        pand_id="test", bouwjaar=2000, gebruiksdoel=["Industriefunctie"]
    )
    result = assess_asbest_risk(building=building)

    assert result.risk == "middel"
    assert result.gebruiksdoel_factor == "industriefunctie"
    assert result.norm_reference is not None


def test_asbest_post1993_woonfunctie_stays_geen():
    """Post-1993 + woonfunctie: no uplift, stays geen."""
    building = BuildingData(
        pand_id="test", bouwjaar=2000, gebruiksdoel=["Woonfunctie"]
    )
    result = assess_asbest_risk(building=building)

    assert result.risk == "geen"
    assert result.gebruiksdoel_factor is None


def test_asbest_pre1963_industriefunctie_stays_middel():
    """Pre-1963 + industriefunctie: baseline middel, stays middel (can't go higher from gebruiksdoel alone)."""
    building = BuildingData(
        pand_id="test", bouwjaar=1950, gebruiksdoel=["Industriefunctie"]
    )
    result = assess_asbest_risk(building=building)

    assert result.risk == "middel"
    assert result.gebruiksdoel_factor == "industriefunctie"


def test_asbest_onbekend_with_industriefunctie_stays_onbekend():
    """Unknown bouwjaar + industriefunctie: no uplift on onbekend."""
    building = BuildingData(
        pand_id="test", bouwjaar=None, gebruiksdoel=["Industriefunctie"]
    )
    result = assess_asbest_risk(building=building)

    assert result.risk == "onbekend"
    assert result.gebruiksdoel_factor is None


def test_asbest_empty_gebruiksdoel_no_uplift():
    """Hoog baseline + empty gebruiksdoel: no uplift, factor is None."""
    building = BuildingData(pand_id="test", bouwjaar=1980, gebruiksdoel=[])
    result = assess_asbest_risk(building=building)

    assert result.risk == "hoog"
    assert result.gebruiksdoel_factor is None


def test_asbest_mixed_gebruiksdoel_picks_first_elevated():
    """Mixed gebruiksdoel picks first elevated function."""
    building = BuildingData(
        pand_id="test",
        bouwjaar=2000,
        gebruiksdoel=["Woonfunctie", "Industriefunctie"],
    )
    result = assess_asbest_risk(building=building)

    assert result.risk == "middel"
    assert result.gebruiksdoel_factor == "industriefunctie"


def test_asbest_case_insensitive_gebruiksdoel():
    """Case-insensitive matching of gebruiksdoel."""
    building = BuildingData(
        pand_id="test", bouwjaar=2000, gebruiksdoel=["INDUSTRIEFUNCTIE"]
    )
    result = assess_asbest_risk(building=building)

    assert result.risk == "middel"
    assert result.gebruiksdoel_factor == "industriefunctie"


def test_asbest_never_reduces_below_baseline():
    """ASBT-02: woonfunctie on hoog baseline must never reduce risk."""
    building = BuildingData(
        pand_id="test", bouwjaar=1970, gebruiksdoel=["Woonfunctie"]
    )
    result = assess_asbest_risk(building=building)

    assert result.risk == "hoog"
    assert result.gebruiksdoel_factor is None
