"""REGRESSION-CRITICAL: pins backend FACTOR_REGISTRY shape (25 factors post-M050/S03).

Drift-detector — if a future slice renames or removes a factor, this test fails
BEFORE the parallel frontend test
(``frontend/src/components/map/panels/parcel/layers/__tests__/RisicoLayer.factor-coverage.test.tsx``)
silently rots. Backend test is the canary: any rename here breaks CI immediately,
forcing the frontend KNOWN_25_FACTOR_KEYS list + FACTOR_LABELS to be updated
in lockstep before merge.

Source of truth: ``backend/app/services/score_v3.py`` FACTOR_REGISTRY 2026-05-19
(9 potentie + 13 pre-M050 risico + 3 M050/S03 BRK risico).

Iron-rule pattern (per MEMORY.md ``feedback_iron_rule_regression_pattern``):
encode 'X must not change' as a regression test, never as a comment.
"""
from __future__ import annotations

from app.services.score_v3 import FACTOR_REGISTRY

# Source of truth — keep in sync with the parallel frontend list:
#   frontend/src/components/map/panels/parcel/layers/__tests__/RisicoLayer.factor-coverage.test.tsx
KNOWN_25_FACTOR_KEYS: frozenset[str] = frozenset({
    # Potentie (9)
    "vrije_grond", "optoppotentie", "bestemming", "leegstand", "funda_frictie",
    "perceelgrootte", "demografie", "vergunning_succeskans", "woonvisie_match",
    # Risico — pre-M050 (13)
    "funderingsrisico", "asbest", "bodemverontreiniging", "monument",
    "bestemmingswijziging", "constructieve_staat", "juridisch_klimaat",
    "criminaliteit", "max_hoogte_bereikt", "natura2000", "overstromingsrisico",
    "geluid", "luchtkwaliteit",
    # Risico — M050/S03 BRK (3)
    "hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend",
})

BRK_FACTOR_KEYS: frozenset[str] = frozenset({
    "hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend",
})


def test_registry_count_is_25() -> None:
    """FACTOR_REGISTRY must contain exactly 25 factors."""
    assert len(FACTOR_REGISTRY) == 25, (
        f"Expected 25 factors in FACTOR_REGISTRY, got {len(FACTOR_REGISTRY)}. "
        "If you added/removed a factor, update KNOWN_25_FACTOR_KEYS in both "
        "this file AND the parallel frontend test."
    )


def test_registry_keys_match_known_set() -> None:
    """FACTOR_REGISTRY keys must equal KNOWN_25_FACTOR_KEYS exactly."""
    actual = set(FACTOR_REGISTRY.keys())
    expected = set(KNOWN_25_FACTOR_KEYS)
    missing = expected - actual
    extra = actual - expected
    assert actual == expected, (
        f"FACTOR_REGISTRY key drift detected. Missing: {missing}; "
        f"Extra (renamed?): {extra}. Update KNOWN_25_FACTOR_KEYS in both "
        "this file AND the parallel frontend test."
    )


def test_all_factors_have_valid_category() -> None:
    """Every registry entry must be category 'potentie' or 'risico'."""
    for key, entry in FACTOR_REGISTRY.items():
        assert entry.category in ("potentie", "risico"), (
            f"Factor {key!r} has invalid category {entry.category!r}"
        )


def test_brk_factors_present() -> None:
    """Drift-canary: 3 M050/S03 BRK keys must be present.

    Most pointed alarm — direct failure if any BRK factor is renamed/removed.
    """
    assert BRK_FACTOR_KEYS <= set(FACTOR_REGISTRY.keys()), (
        f"BRK factors missing from FACTOR_REGISTRY: "
        f"{BRK_FACTOR_KEYS - set(FACTOR_REGISTRY.keys())}"
    )
    for key in BRK_FACTOR_KEYS:
        assert FACTOR_REGISTRY[key].category == "risico", (
            f"BRK factor {key!r} must be category 'risico'"
        )


def test_potentie_weights_sum_100() -> None:
    """Potentie default_weight sum-guard (registry invariant)."""
    total = sum(
        e.default_weight
        for e in FACTOR_REGISTRY.values()
        if e.category == "potentie"
    )
    assert total == 100, f"Potentie default_weight sum {total} != 100"


def test_risico_weights_sum_100() -> None:
    """Risico default_weight sum-guard (registry invariant, M050/S03 D2)."""
    total = sum(
        e.default_weight
        for e in FACTOR_REGISTRY.values()
        if e.category == "risico"
    )
    assert total == 100, f"Risico default_weight sum {total} != 100"
