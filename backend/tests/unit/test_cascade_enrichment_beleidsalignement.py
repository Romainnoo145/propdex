from app.ai.factors.beleidsalignement import GebiedPolicy, OmgevingsvisiePayload
from app.services.score_v3 import compute_score_v3


def _payload():
    return OmgevingsvisiePayload(
        tijdshorizon=2040,
        gebied_policies=[
            GebiedPolicy(
                gebied_naam="Transformatiegebieden", karakter="transformatie",
                woningbouwprioriteit="hoog", transformatie_kansgebied=True,
                gebonden_plaatsen=["Blerick"], citaat="nieuwe stadsbuurten",
            )
        ],
        confidence=1.0,
    )


def test_beleidsalignement_flows_into_breakdown():
    parcel_data = {"area_m2": 500, "wijk_naam": "Blerick", "has_pand": True}
    res = compute_score_v3(
        parcel_data, None, project_type="transformatie_wonen",
        cascade_payloads={"beleidsalignement": _payload()},
    )
    f = res.score_breakdown["beleidsalignement"]
    assert f.categorie == "potentie"
    assert f.missing is False
    assert f.gewicht == 10  # registry weight applied for matched factor
    assert f.waarde["matched_policy"]["gebied_naam"] == "Transformatiegebieden"


def test_beleidsalignement_absent_is_missing():
    parcel_data = {"area_m2": 500, "wijk_naam": "Blerick", "has_pand": True}
    res = compute_score_v3(parcel_data, None, cascade_payloads={})
    f = res.score_breakdown["beleidsalignement"]
    assert f.missing is True
    assert f.gewicht == 0
