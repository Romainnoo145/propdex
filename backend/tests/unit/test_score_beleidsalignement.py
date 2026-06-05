from app.ai.factors.beleidsalignement import GebiedPolicy, OmgevingsvisiePayload
from app.services.score_v3_factors import score_beleidsalignement


def _payload(policies, algemeen="", conf=1.0):
    return OmgevingsvisiePayload(
        tijdshorizon=2040, gebied_policies=policies, algemeen_citaat=algemeen, confidence=conf
    )


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
