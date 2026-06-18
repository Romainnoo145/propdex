"""Unit tests M054/S02 — score_parkeerdruk (parkeernorm-zwaarte + oplos-constraint)."""
from app.ai.factors.parkeerdruk import ParkeernormenPayload
from app.services.score_v3_factors import score_parkeerdruk

_WONEN = [{"type": "wonen"}]
_BEDRIJF = [{"type": "bedrijf"}]


def _payload(**overrides) -> ParkeernormenPayload:
    base = {
        "peiljaar": 2026,
        "parkeerregulering_van_toepassing": False,
        "normbanden": [
            {
                "functie": "appartement vrije sector",
                "functiecategorie": "wonen",
                "bestemming_trefwoorden": ["wonen", "gemengd"],
                "gebied": "rest_bebouwde_kom",
                "auto_norm_per_eenheid": 0.5,
            }
        ],
        "openbare_ruimte_drempel_pct": 70,
        "centrum_uitgesloten": True,
        "mobiliteitscorrecties": [],
        "nul_norm_sociale_huur_mogelijk": True,
        "fietsnorm_harde_eis": False,
        "confidence": 0.9,
    }
    base.update(overrides)
    return ParkeernormenPayload.model_validate(base)


def _band(**kw) -> dict:
    band = {
        "functie": "appartement vrije sector",
        "functiecategorie": "wonen",
        "bestemming_trefwoorden": ["wonen"],
        "gebied": "rest_bebouwde_kom",
        "auto_norm_per_eenheid": 0.5,
    }
    band.update(kw)
    return band


def test_no_payload_is_missing():
    r = score_parkeerdruk(None, bestemmingen=_WONEN, area_m2=500, projecttype="nieuwbouw_wonen")
    assert r.missing is True
    assert r.categorie == "risico"
    assert r.bijdrage == 0.0
    assert r.waarde["verdict"] == "geen_parkeerbeleid"


def test_geen_match_when_no_band_matches_bestemming():
    r = score_parkeerdruk(_payload(), bestemmingen=_BEDRIJF, area_m2=500, projecttype="onbepaald")
    assert r.missing is False
    assert r.waarde["verdict"] == "geen_match"
    assert r.genormaliseerde_score == 0.0


def test_laag_lichte_norm_ruime_escape():
    r = score_parkeerdruk(_payload(), bestemmingen=_WONEN, area_m2=500, projecttype="nieuwbouw_wonen")
    assert r.waarde["verdict"] == "laag"
    assert r.gewicht == 0  # context, in compute_score_v3 niet meegewogen
    assert 0.0 < r.genormaliseerde_score < 0.5


def test_verhoogd_via_centrum_zonder_escape():
    p = _payload(
        normbanden=[_band(gebied="centrum", auto_norm_per_eenheid=1.0, fiets_norm_per_eenheid=2.0)],
        centrum_uitgesloten=True,
    )
    r = score_parkeerdruk(p, bestemmingen=_WONEN, area_m2=500, projecttype="nieuwbouw_wonen")
    assert r.waarde["verdict"] == "verhoogd"
    assert r.waarde["gebied"] == "centrum"
    assert r.genormaliseerde_score >= 0.5


def test_verhoogd_via_gereguleerd_zonder_correctie():
    p = _payload(parkeerregulering_van_toepassing=True, mobiliteitscorrecties=[])
    r = score_parkeerdruk(p, bestemmingen=_WONEN, area_m2=500, projecttype="onbepaald")
    assert r.waarde["verdict"] == "verhoogd"


def test_gereguleerd_met_correctie_blijft_laag():
    p = _payload(
        parkeerregulering_van_toepassing=True,
        mobiliteitscorrecties=[{"type": "autodeel", "max_reductie_pct": 20}],
    )
    r = score_parkeerdruk(p, bestemmingen=_WONEN, area_m2=500, projecttype="onbepaald")
    assert r.waarde["verdict"] == "laag"


def test_verhoogd_via_zware_autonorm():
    p = _payload(normbanden=[_band(gebied="rest_bebouwde_kom", auto_norm_per_eenheid=2.0)])
    r = score_parkeerdruk(p, bestemmingen=_WONEN, area_m2=500, projecttype="onbepaald")
    assert r.waarde["verdict"] == "verhoogd"
    assert r.genormaliseerde_score >= 0.3


def test_verhoogd_via_fietsnorm_harde_eis():
    p = _payload(
        normbanden=[_band(fiets_norm_per_eenheid=2.0)],
        fietsnorm_harde_eis=True,
    )
    r = score_parkeerdruk(p, bestemmingen=_WONEN, area_m2=500, projecttype="nieuwbouw_wonen")
    assert r.waarde["verdict"] == "verhoogd"


def test_score_higher_for_centrum_than_rest():
    centrum = _payload(
        normbanden=[_band(gebied="centrum", auto_norm_per_eenheid=1.0)],
        centrum_uitgesloten=True,
    )
    rest = _payload(normbanden=[_band(gebied="rest_bebouwde_kom", auto_norm_per_eenheid=1.0)])
    r_centrum = score_parkeerdruk(centrum, bestemmingen=_WONEN, area_m2=500, projecttype="onbepaald")
    r_rest = score_parkeerdruk(rest, bestemmingen=_WONEN, area_m2=500, projecttype="onbepaald")
    # Risico-factor: hoger = meer risico. Centrum (krapste escape) > rest.
    assert r_centrum.genormaliseerde_score > r_rest.genormaliseerde_score


def test_picks_most_risky_band_when_multiple_match():
    p = _payload(
        normbanden=[
            _band(gebied="rest_bebouwde_kom", auto_norm_per_eenheid=0.5),
            _band(gebied="centrum", auto_norm_per_eenheid=1.0, functie="centrum-appartement"),
        ],
        centrum_uitgesloten=True,
    )
    r = score_parkeerdruk(p, bestemmingen=_WONEN, area_m2=500, projecttype="nieuwbouw_wonen")
    assert r.waarde["gebied"] == "centrum"
    assert r.waarde["verdict"] == "verhoogd"
