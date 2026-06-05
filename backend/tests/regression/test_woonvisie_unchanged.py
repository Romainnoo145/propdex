"""Iron rule (M053/S01): adding beleidsalignement must NOT change woonvisie_match
behaviour or the registry weights of the override-bearing potentie factors."""
from app.ai.factors.woonvisie_match import WijkPolicy, WoonvisiePayload
from app.services.score_v3 import FACTOR_REGISTRY
from app.services.score_v3_factors import score_woonvisie_match


def test_override_bearing_weights_untouched():
    assert FACTOR_REGISTRY["vrije_grond"].default_weight == 13
    assert FACTOR_REGISTRY["optoppotentie"].default_weight == 11
    assert FACTOR_REGISTRY["woonvisie_match"].default_weight == 12
    assert FACTOR_REGISTRY["woonvisie_match"].weight_by_projecttype == {
        "nieuwbouw_wonen": 16,
        "optoppen": 8,
    }


def test_woonvisie_match_scoring_stable():
    payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Blerick",
                prioriteit="groei",
                gewenste_segmenten=["sociaal", "midden"],
                citaat="groeiwijk",
                pagina=5,
            )
        ],
        confidence=1.0,
    )
    r = score_woonvisie_match(payload, wijk_naam="Blerick", project_type="nieuwbouw_wonen")
    assert r.missing is False
    assert r.waarde["matched_policy"]["wijk_naam"] == "Blerick"
    # groei base 5+3 +2 segment-fit = 10 → normalised 1.0
    assert r.genormaliseerde_score == 1.0
