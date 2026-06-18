"""M054/S02 — parkeerdruk registry-entry + risico-rebalance 93 -> 86.

Rebalance: parkeerdruk=7 (risico, cascade-gated). Because both verdict-gated risico
cascade factors (splitsingsrisico 7 + parkeerdruk 7 = 14) are reserved from the
risico-100 pool, the 16 core risico factors are re-rebalanced via largest-remainder
from sum=93 to sum=86. All risico factors have weight_by_projecttype=None, so every
projecttype risico sum stays == 100.

Pinned post-rebalance core weights (the EXACT largest-remainder output for 93 -> 86):
    funderingsrisico 12->11, asbest 6->5, bodemverontreiniging 6->5,
    bestemmingswijziging 6->5, juridisch_klimaat 6->5, overstromingsrisico 5->4,
    hypotheek_risico 9->8 (the 7 units freed); all other core factors unchanged.
"""
from app.services.score_v3 import (
    _CASCADE_GATED_RISICO_WEIGHT,
    _RISICO_REDISTRIBUTION_TARGET,
    CASCADE_GATED_FACTORS,
    FACTOR_REGISTRY,
    _verify_registry_sum_guard,
)


def test_parkeerdruk_registered_risico_weight_7():
    e = FACTOR_REGISTRY["parkeerdruk"]
    assert e.category == "risico"
    assert e.default_weight == 7
    assert e.weight_by_projecttype is None  # constant → invariant-safe
    assert e.bron == "gemeente_beleid"


def test_parkeerdruk_is_cascade_gated():
    assert "parkeerdruk" in CASCADE_GATED_FACTORS


def test_risico_weights_sum_100():
    total = sum(e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "risico")
    assert total == 100


def test_redistribution_target_moved_93_to_86():
    """Both cascade-gated risico factors reserve 14 → target 93 -> 86 (derived)."""
    assert _CASCADE_GATED_RISICO_WEIGHT == 14
    assert _RISICO_REDISTRIBUTION_TARGET == 86


def test_core_risico_factors_sum_to_target():
    """The in-breakdown core risico factors (non-cascade) sum to the target (86)."""
    core = sum(
        e.default_weight
        for k, e in FACTOR_REGISTRY.items()
        if e.category == "risico" and k not in CASCADE_GATED_FACTORS
    )
    assert core == _RISICO_REDISTRIBUTION_TARGET == 86


def test_rebalanced_core_weights_exact():
    """Pin the EXACT largest-remainder rescaled risico weights (93 -> 86)."""
    # 7 units freed (one each):
    assert FACTOR_REGISTRY["funderingsrisico"].default_weight == 11
    assert FACTOR_REGISTRY["asbest"].default_weight == 5
    assert FACTOR_REGISTRY["bodemverontreiniging"].default_weight == 5
    assert FACTOR_REGISTRY["bestemmingswijziging"].default_weight == 5
    assert FACTOR_REGISTRY["juridisch_klimaat"].default_weight == 5
    assert FACTOR_REGISTRY["overstromingsrisico"].default_weight == 4
    assert FACTOR_REGISTRY["hypotheek_risico"].default_weight == 8
    # Unchanged core factors:
    assert FACTOR_REGISTRY["monument"].default_weight == 5
    assert FACTOR_REGISTRY["constructieve_staat"].default_weight == 5
    assert FACTOR_REGISTRY["criminaliteit"].default_weight == 5
    assert FACTOR_REGISTRY["max_hoogte_bereikt"].default_weight == 5
    assert FACTOR_REGISTRY["natura2000"].default_weight == 5
    assert FACTOR_REGISTRY["geluid"].default_weight == 5
    assert FACTOR_REGISTRY["luchtkwaliteit"].default_weight == 4
    assert FACTOR_REGISTRY["eigendoms_complexiteit"].default_weight == 5
    assert FACTOR_REGISTRY["koopwaarde_trend"].default_weight == 4
    # Cascade-gated reserved weights:
    assert FACTOR_REGISTRY["splitsingsrisico"].default_weight == 7
    assert FACTOR_REGISTRY["parkeerdruk"].default_weight == 7


def test_sum_guard_holds_all_projecttypes():
    _verify_registry_sum_guard()  # raises AssertionError if any projecttype != 100
