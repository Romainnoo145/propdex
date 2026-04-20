"""M046/S05 iron-rule regression tests — score_monument via RCE.

Must pass before any future M046 slice merges. Guards against:
- Pre-S05 regression: `score_monument` only did keyword-match, missed 30-40%
  rijksmonumenten buiten erfgoed-bestemmingen
- Post-S05 regression: RCE data not being consumed, OR keyword fallback broken
  when RCE unavailable, OR data_bronnen not correctly attributed
"""
from app.services.score_v3_factors import score_monument


def test_rce_monument_detected_overrides_keyword_match() -> None:
    """Iron rule: RCE-data 'is_monument:True' produceert factor=monument ook
    zonder erfgoed-keyword in bestemmingsplan. Pre-S05 zou dit worden gemist
    (de 30-40% bug).
    """
    parcel_data = {
        "rijksmonument": {
            "is_monument": True,
            "rce_objrijksnr": "12345",
            "rce_objnaam": "Huis De Doelen",
            "beschrijving": "17e-eeuws koopmanshuis",
        },
        "bestemmingen": [{"type": "wonen", "naam": "Wonen"}],  # GEEN erfgoed-keyword
    }
    result = score_monument(parcel_data)
    assert result.waarde is True
    assert result.genormaliseerde_score == 1.0
    assert result.bijdrage == 5.0
    assert "Huis De Doelen" in result.toelichting_lang
    assert "RCE API" in result.data_bronnen


def test_no_rce_data_falls_back_to_keyword_match() -> None:
    """Iron rule: wanneer RCE niet beschikbaar is (flags.rijksmonument is None),
    valt de factor terug op het legacy keyword-match gedrag. Dit voorkomt dat
    een API-outage alle monument-detection uit zet.
    """
    parcel_data = {
        "rijksmonument": None,  # API error / pre-S05 data
        "bestemmingen": [{"type": "waarde-monument", "naam": ""}],
    }
    result = score_monument(parcel_data)
    assert result.waarde is True, "keyword fallback moet triggeren"
    assert result.data_bronnen == ["Bestemmingsplan"], (
        "Geen RCE-attribution wanneer geen RCE-data gebruikt"
    )
    assert result.missing is True, (
        "missing=True signaleert in frontend dat data-betrouwbaarheid lager is"
    )


def test_rce_not_monument_clean_zero() -> None:
    """Iron rule: RCE expliciet 'is_monument:False' geeft factor score 0.0
    zonder fallback naar bestemming-keyword. RCE is authoritatief voor
    RIJKSmonumenten — een afwezig keyword is geen reden te twijfelen.
    """
    parcel_data = {
        "rijksmonument": {"is_monument": False},
        "bestemmingen": [{"type": "wonen", "naam": ""}],
    }
    result = score_monument(parcel_data)
    assert result.waarde is False
    assert result.genormaliseerde_score == 0.0
    assert result.bijdrage == 0.0
    assert "Geen rijksmonument" in result.toelichting_kort
    assert "RCE API" in result.data_bronnen


def test_rce_authoritative_over_conflicting_keyword() -> None:
    """Iron rule: wanneer RCE zegt 'niet een rijksmonument' en bestemmingsplan
    'waarde-erfgoed' keyword bevat, trusten we RCE. Bestemmingsplan-text is
    vaak onnauwkeurig (generieke waardebestemming voor hele zones); RCE is
    per-object authoritative. Een gemeentelijk monument zou hier 'False'
    geven — dat is correct voor S05 scope (alleen rijksmonumenten).
    """
    parcel_data = {
        "rijksmonument": {"is_monument": False},
        "bestemmingen": [{"type": "waarde-erfgoed", "naam": "cultuurhistorische waarde"}],
    }
    result = score_monument(parcel_data)
    assert result.waarde is False, (
        "RCE overrulet bestemmingsplan-keyword — bestemmingsplan-erfgoed-keyword "
        "kan duiden op gemeentelijk monument (buiten S05 scope) of zone-brede "
        "waarde zonder individuele monument-status"
    )


def test_rce_missing_and_no_keyword_clean_zero() -> None:
    """Guard: wanneer RCE niet beschikbaar is EN geen keyword-match, factor=0
    met missing=True (data-provenance signaleert betrouwbaarheid-beperking).
    """
    parcel_data = {
        "rijksmonument": None,
        "bestemmingen": [{"type": "wonen", "naam": ""}],
    }
    result = score_monument(parcel_data)
    assert result.waarde is False
    assert result.genormaliseerde_score == 0.0
    assert result.missing is True, (
        "RCE-data ontbreekt → frontend moet betrouwbaarheid-signaal kunnen tonen"
    )
    assert result.data_bronnen == ["Bestemmingsplan"]
