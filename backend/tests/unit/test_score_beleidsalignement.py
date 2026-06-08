import pytest

from app.ai.factors.beleidsalignement import GebiedPolicy, OmgevingsvisiePayload
from app.services.score_v3_factors import score_beleidsalignement


def _payload(policies, algemeen="", conf=1.0):
    return OmgevingsvisiePayload(
        tijdshorizon=2040, gebied_policies=policies, algemeen_citaat=algemeen, confidence=conf
    )


@pytest.fixture
def make_omgevingsvisie_payload():
    """Build an OmgevingsvisiePayload mirroring the real Venlo extraction's high-value gebieden.

    Includes the centraal_stedelijk "Hart van het Centraal stedelijk gebied" (woningbouw=hoog),
    the werklocatie "Werklocaties", and a stedelijk_wonen gebied — exactly the gebied_naam strings
    the Venlo crosswalk maps wijken to.
    """

    def _make(algemeen="compacte stad", conf=1.0):
        policies = [
            GebiedPolicy(
                gebied_naam="Hart van het Centraal stedelijk gebied",
                karakter="centraal_stedelijk",
                woningbouwprioriteit="hoog",
                transformatie_kansgebied=True,
                gebonden_plaatsen=["Binnenstad Venlo"],
                citaat="verdichten in het centraal stedelijk gebied",
                pagina=8,
            ),
            GebiedPolicy(
                gebied_naam="Werklocaties",
                karakter="werklocatie",
                woningbouwprioriteit="niet_benoemd",
                transformatie_kansgebied=False,
                gebonden_plaatsen=["Tradeport Venlo"],
                citaat="ruimte voor bedrijvigheid en logistiek",
                pagina=22,
            ),
            GebiedPolicy(
                gebied_naam="Stedelijke woongebieden",
                karakter="stedelijk_wonen",
                woningbouwprioriteit="gemiddeld",
                transformatie_kansgebied=False,
                gebonden_plaatsen=["Venlo-Zuid"],
                citaat="bestaande woonwijken behouden en versterken",
                pagina=14,
            ),
        ]
        return OmgevingsvisiePayload(
            tijdshorizon=2040, gebied_policies=policies, algemeen_citaat=algemeen, confidence=conf
        )

    return _make


def test_missing_payload_not_weighed():
    r = score_beleidsalignement(None, wijk_naam="Blerick", project_type="onbepaald")
    assert r.missing is True
    assert r.gewicht == 0
    assert r.categorie == "potentie"


def test_transformatie_kansgebied_scores_high():
    pol = GebiedPolicy(
        gebied_naam="Transformatiegebieden", karakter="transformatie",
        woningbouwprioriteit="hoog", transformatie_kansgebied=True,
        gebonden_plaatsen=["Middengebied"], citaat="klimaatadaptieve stadsbuurten", pagina=12,
    )
    r = score_beleidsalignement(_payload([pol]), wijk_naam="Middengebied", project_type="transformatie_wonen")
    assert r.genormaliseerde_score >= 0.85
    assert r.missing is False
    assert r.waarde["matched_policy"]["gebied_naam"] == "Transformatiegebieden"
    assert "klimaatadaptieve" in r.toelichting_lang


def test_landschap_scores_low():
    pol = GebiedPolicy(
        gebied_naam="Maas en beken", karakter="landschap",
        woningbouwprioriteit="laag", transformatie_kansgebied=False,
        gebonden_plaatsen=["Maasoever"], citaat="behoud van het beekdal",
    )
    r = score_beleidsalignement(_payload([pol]), wijk_naam="Maasoever", project_type="nieuwbouw_wonen")
    assert r.genormaliseerde_score <= 0.35


def test_no_match_uses_algemeen_citaat_and_not_weighed():
    pol = GebiedPolicy(
        gebied_naam="Dorpen", karakter="dorp", woningbouwprioriteit="gemiddeld",
        transformatie_kansgebied=False, gebonden_plaatsen=["Arcen"], citaat="vitale dorpskernen",
    )
    r = score_beleidsalignement(_payload([pol], algemeen="compacte stad"), wijk_naam="Onbekend", project_type="onbepaald")
    assert r.waarde["matched_policy"] is None
    assert r.waarde["algemeen_citaat"] == "compacte stad"
    assert r.gewicht == 0  # no-match → not weighed (sparse factor)


def test_hyphen_and_casing_match():
    pol = GebiedPolicy(
        gebied_naam="Stedelijke woongebieden", karakter="stedelijk_wonen",
        woningbouwprioriteit="gemiddeld", transformatie_kansgebied=False,
        gebonden_plaatsen=["Oud-Blerick"], citaat="bestaande woonwijken",
    )
    r = score_beleidsalignement(_payload([pol]), wijk_naam="oud‐blerick", project_type="onbepaald")
    assert r.waarde["matched_policy"]["gebied_naam"] == "Stedelijke woongebieden"


def test_crosswalk_blerick_midden_is_woongebied_not_centraal(make_omgevingsvisie_payload):
    """Blerick-Midden is mostly residential — the crosswalk maps it to Stedelijke
    woongebieden (neutraal), NOT the centraal-stedelijk gebied. Only the small Blerick
    kern is centraal; classifying the whole wijk as centrum over-inflated it to kansrijk."""
    payload = make_omgevingsvisie_payload()
    result = score_beleidsalignement(
        payload, wijk_naam="Wijk 21 Blerick-Midden", project_type="onbepaald"
    )
    assert result.waarde["matched_gebied"] == "Stedelijke woongebieden"
    assert result.waarde["verdict"] == "neutraal"


def test_crosswalk_maps_venlo_centrum_to_centraal_gebied(make_omgevingsvisie_payload):
    """Wijk 11 Venlo-Centrum must resolve to the centraal-stedelijk gebied via the
    crosswalk, even though 'Binnenstad Venlo' does not substring-match 'Wijk 11 Venlo-Centrum'."""
    payload = make_omgevingsvisie_payload()  # must include the centraal_stedelijk gebied
    result = score_beleidsalignement(
        payload, wijk_naam="Wijk 11 Venlo-Centrum", project_type="nieuwbouw_wonen"
    )
    assert result.missing is False
    assert result.waarde["matched_gebied"] == "Hart van het Centraal stedelijk gebied"


def test_no_match_is_missing_not_plus_floor(make_omgevingsvisie_payload):
    """A parcel that matches no gebied must NOT receive the +0.5 floor — it is missing."""
    payload = make_omgevingsvisie_payload()
    result = score_beleidsalignement(
        payload, wijk_naam="Onbekende Wijk Buitengebied", project_type="onbepaald"
    )
    assert result.missing is True
    assert result.bijdrage == 0.0
    assert result.waarde["verdict"] == "geen_beleid"
    assert result.waarde["strijdig_met_visie"] is False


def test_werklocatie_is_strijdig(make_omgevingsvisie_payload):
    """A parcel in a werklocatie gebied is strijdig met de gemeentevisie voor wonen."""
    payload = make_omgevingsvisie_payload()  # must include the Werklocaties gebied
    result = score_beleidsalignement(
        payload, wijk_naam="Wijk 28 Trade-Port", project_type="nieuwbouw_wonen"
    )
    assert result.waarde["matched_gebied"] == "Werklocaties"
    assert result.waarde["strijdig_met_visie"] is True
    assert result.waarde["verdict"] == "strijdig"


def test_centraal_hoog_baseline_is_kansrijk(make_omgevingsvisie_payload):
    """No projecttype-lens (onbepaald): a high-value gebied + prioriteit hoog reads
    kansrijk because the gemeente actively steers development there."""
    payload = make_omgevingsvisie_payload()
    result = score_beleidsalignement(
        payload, wijk_naam="Wijk 11 Venlo-Centrum", project_type="onbepaald"
    )
    assert result.waarde["verdict"] == "kansrijk"
    assert result.waarde["strijdig_met_visie"] is False


def test_centraal_with_nonfitting_projecttype_is_neutraal(make_omgevingsvisie_payload):
    """With a real projecttype that does NOT fit the karakter, the lens wins: the
    baseline high-value shortcut is gated off, so verdict is neutraal (not kansrijk).
    nieuwbouw_wonen does not list centraal_stedelijk as a fit."""
    payload = make_omgevingsvisie_payload()
    result = score_beleidsalignement(
        payload, wijk_naam="Wijk 11 Venlo-Centrum", project_type="nieuwbouw_wonen"
    )
    assert result.waarde["verdict"] == "neutraal"


def test_randvoorwaarden_surfaced_in_waarde(make_omgevingsvisie_payload):
    from app.ai.factors.beleidsalignement import Randvoorwaarde
    payload = make_omgevingsvisie_payload()
    payload.randvoorwaarden = [
        Randvoorwaarde(categorie="programmering", titel="70/30",
                       samenvatting="70% vrije sector / 30% sociaal vanaf 30 woningen."),
    ]
    r = score_beleidsalignement(payload, wijk_naam="Wijk 11 Venlo-Centrum", project_type="onbepaald")
    assert isinstance(r.waarde["randvoorwaarden"], list)
    assert r.waarde["randvoorwaarden"][0]["categorie"] == "programmering"


def test_randvoorwaarden_do_not_change_score(make_omgevingsvisie_payload):
    """Measurability guard: randvoorwaarden are display-only — score + verdict identical."""
    from app.ai.factors.beleidsalignement import Randvoorwaarde
    base = make_omgevingsvisie_payload()
    enriched = make_omgevingsvisie_payload()
    enriched.randvoorwaarden = [
        Randvoorwaarde(categorie="financieel", titel="Kostenverhaal", samenvatting="..."),
    ]
    a = score_beleidsalignement(base, wijk_naam="Wijk 11 Venlo-Centrum", project_type="onbepaald")
    b = score_beleidsalignement(enriched, wijk_naam="Wijk 11 Venlo-Centrum", project_type="onbepaald")
    assert a.genormaliseerde_score == b.genormaliseerde_score
    assert a.waarde["verdict"] == b.waarde["verdict"]
    assert a.waarde["strijdig_met_visie"] == b.waarde["strijdig_met_visie"]


def test_centraal_with_fitting_projecttype_is_kansrijk(make_omgevingsvisie_payload):
    """A projecttype that fits centraal_stedelijk (transformatie_wonen) + hoog → kansrijk."""
    payload = make_omgevingsvisie_payload()
    result = score_beleidsalignement(
        payload, wijk_naam="Wijk 11 Venlo-Centrum", project_type="transformatie_wonen"
    )
    assert result.waarde["verdict"] == "kansrijk"
