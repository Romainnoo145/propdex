"""M053/S12 — splitsingsrisico registry-entry + risico-rebalance som=100.

M054/S02 update: parkeerdruk (the second verdict-gated risico cascade factor, also
weight 7) now shares the reserved-weight pool with splitsingsrisico, so the
in-breakdown risico redistribution target moved 93 -> 86 (100 - 7 - 7). The registry
risico sum stays 100 (core rebalanced to 86 + splitsingsrisico 7 + parkeerdruk 7).
splitsingsrisico's own weight is unchanged at 7.
"""
from app.services.score_v3 import (
    _CASCADE_GATED_RISICO_WEIGHT,
    _RISICO_REDISTRIBUTION_TARGET,
    FACTOR_REGISTRY,
)


def test_splitsingsrisico_registered_risico_weight_7():
    e = FACTOR_REGISTRY["splitsingsrisico"]
    assert e.category == "risico"
    assert e.default_weight == 7
    assert e.bron == "gemeente_beleid"


def test_risico_weights_sum_100_after_rebalance():
    total = sum(e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "risico")
    assert total == 100


def test_shared_redistribution_target_is_86():
    """M054/S02: splitsingsrisico (7) + parkeerdruk (7) reserved → target 93 -> 86."""
    assert _CASCADE_GATED_RISICO_WEIGHT == 14
    assert _RISICO_REDISTRIBUTION_TARGET == 86
