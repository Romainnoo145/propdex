"""REGRESSION: woondeal is context-only. It must never enter the scoring registry
(M054/S06). If a future slice activates a score signal, it does so deliberately —
this guard forces that decision to be explicit (update this test in lockstep).
"""
from app.services.score_v3 import FACTOR_REGISTRY


def test_woondeal_not_in_registry():
    assert "woondeal" not in FACTOR_REGISTRY
    assert "woondeal_boost" not in FACTOR_REGISTRY


def test_registry_count_still_29():
    assert len(FACTOR_REGISTRY) == 29
