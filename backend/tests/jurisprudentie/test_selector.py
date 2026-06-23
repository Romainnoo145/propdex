from app.jurisprudentie.models import JurisprudentieCase
from app.jurisprudentie.selector import select_cases


def _case(ecli, themas, gemeente=None, vt="splitsing"):
    return JurisprudentieCase(
        ecli=ecli, verbouwingstype=vt, gemeente_code=gemeente,
        instantie="Raad van State", datum="2022-01-01", themas=themas,
        uitkomst="geweigerd", duiding="x", bron_url="https://example.test/" + ecli,
    )


def test_filters_by_verbouwingstype():
    cases = [_case("A", ["schaarste"]), _case("B", ["welstand"], vt="dakkapel")]
    out = select_cases("splitsing", ["schaarste"], None, limit=4, cases=cases)
    assert [c.ecli for c in out] == ["A"]


def test_scores_on_thema_overlap_and_prefers_same_gemeente():
    cases = [
        _case("LANDELIJK", ["schaarste", "leefbaarheid"], gemeente=None),
        _case("VENLO", ["schaarste"], gemeente="0983"),
        _case("OTHER", ["proces"], gemeente="0363"),
    ]
    out = select_cases("splitsing", ["schaarste", "leefbaarheid"], "0983", limit=2, cases=cases)
    # Same-gemeente case ranks first on equal thema-overlap; OTHER (no overlap) excluded.
    assert out[0].ecli == "VENLO"
    assert "OTHER" not in [c.ecli for c in out]


def test_falls_back_to_landelijk_when_no_local():
    cases = [_case("LANDELIJK", ["schaarste"], gemeente=None)]
    out = select_cases("splitsing", ["schaarste"], "0983", limit=4, cases=cases)
    assert [c.ecli for c in out] == ["LANDELIJK"]
