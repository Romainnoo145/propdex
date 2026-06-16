"""M053/S12 — splitsingsrisico registry-entry + risico-rebalance som=100."""
from app.services.score_v3 import FACTOR_REGISTRY


def test_splitsingsrisico_registered_risico_weight_7():
    e = FACTOR_REGISTRY["splitsingsrisico"]
    assert e.category == "risico"
    assert e.default_weight == 7
    assert e.bron == "gemeente_beleid"


def test_risico_weights_sum_100_after_rebalance():
    total = sum(e.default_weight for e in FACTOR_REGISTRY.values() if e.category == "risico")
    assert total == 100
