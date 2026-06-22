from app.services.score_v3 import FACTOR_REGISTRY, _verify_registry_sum_guard


def test_beleidsalignement_in_registry():
    e = FACTOR_REGISTRY["beleidsalignement"]
    assert e.category == "potentie"
    assert e.default_weight == 10
    assert e.weight_by_projecttype is None  # constant → invariant-safe


def test_potentie_sum_is_100():
    s = sum(e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "potentie")
    assert s == 100


def test_rebalanced_weights_exact():
    # M054/S07 restored no-override potentie factor weights (M054/S07).
    # funda_frictie stays 4.
    assert FACTOR_REGISTRY["bestemming"].default_weight == 11
    assert FACTOR_REGISTRY["leegstand"].default_weight == 7
    assert FACTOR_REGISTRY["funda_frictie"].default_weight == 4
    assert FACTOR_REGISTRY["perceelgrootte"].default_weight == 11
    assert FACTOR_REGISTRY["demografie"].default_weight == 8
    assert FACTOR_REGISTRY["vergunning_succeskans"].default_weight == 13


def test_sum_guard_holds_all_projecttypes():
    _verify_registry_sum_guard()  # raises AssertionError if any projecttype != 100
