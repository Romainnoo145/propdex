"""M054/S01 — grondwaarde_fit registry-entry + potentie-rebalance som=100.

Rebalance: grondwaarde_fit=8, freed from no-override potentie factors
(bestemming -2, perceelgrootte -2, vergunning_succeskans -2, demografie -1,
leegstand -1). Because only no-override factors are shaved, every projecttype
potentie sum stays == 100.
"""
from app.services.score_v3 import (
    CASCADE_GATED_FACTORS,
    FACTOR_REGISTRY,
    _verify_registry_sum_guard,
)


def test_grondwaarde_fit_registered_potentie_weight_8():
    e = FACTOR_REGISTRY["grondwaarde_fit"]
    assert e.category == "potentie"
    assert e.default_weight == 8
    assert e.weight_by_projecttype is None  # constant → invariant-safe
    assert e.bron == "gemeente_beleid"


def test_grondwaarde_fit_is_cascade_gated():
    assert "grondwaarde_fit" in CASCADE_GATED_FACTORS


def test_potentie_weights_sum_100():
    total = sum(e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "potentie")
    assert total == 100


def test_rebalanced_no_override_weights_exact():
    assert FACTOR_REGISTRY["bestemming"].default_weight == 9
    assert FACTOR_REGISTRY["perceelgrootte"].default_weight == 9
    assert FACTOR_REGISTRY["vergunning_succeskans"].default_weight == 11
    assert FACTOR_REGISTRY["demografie"].default_weight == 7
    assert FACTOR_REGISTRY["leegstand"].default_weight == 6
    # untouched
    assert FACTOR_REGISTRY["funda_frictie"].default_weight == 4
    assert FACTOR_REGISTRY["beleidsalignement"].default_weight == 10
    assert FACTOR_REGISTRY["woonvisie_match"].default_weight == 12


def test_sum_guard_holds_all_projecttypes():
    _verify_registry_sum_guard()  # raises AssertionError if any projecttype != 100
