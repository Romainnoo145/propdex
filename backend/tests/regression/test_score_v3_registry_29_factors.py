"""REGRESSION-CRITICAL: pins backend FACTOR_REGISTRY shape (29 factors post-M054/S01+S02).

Drift-detector — if a future slice renames or removes a factor, this test fails
BEFORE the parallel frontend tests
(``frontend/src/components/map/panels/parcel/layers/__tests__/RisicoLayer.factor-coverage.test.tsx``
and ``PotentieLayer.factor-coverage.test.tsx``)
silently rot. Backend test is the canary: any rename here breaks CI immediately,
forcing the frontend KNOWN_*_FACTOR_KEYS lists + FACTOR_LABELS to be updated
in lockstep before merge.

Source of truth: ``backend/app/services/score_v3.py`` FACTOR_REGISTRY
(11 potentie + 13 pre-M050 risico + 3 M050/S03 BRK risico + 2 cascade risico).
beleidsalignement added in M053/S01 (potentie cascade — Omgevingsvisie).
splitsingsrisico added in M053/S12 (risico cascade — Huisvestingsverordening).
grondwaarde_fit added in M054/S01 (potentie cascade — Grondprijzenbrief).
parkeerdruk added in M054/S02 (risico cascade — Nota parkeernormen).

Iron-rule pattern (per MEMORY.md ``feedback_iron_rule_regression_pattern``):
encode 'X must not change' as a regression test, never as a comment.
"""
from __future__ import annotations

from app.services.score_v3 import FACTOR_REGISTRY

# Source of truth — keep in sync with the parallel frontend lists:
#   frontend/src/components/map/panels/parcel/layers/__tests__/RisicoLayer.factor-coverage.test.tsx
#   frontend/src/components/map/panels/parcel/layers/__tests__/PotentieLayer.factor-coverage.test.tsx
KNOWN_29_FACTOR_KEYS: frozenset[str] = frozenset({
    # Potentie (11)
    "vrije_grond", "optoppotentie", "bestemming", "leegstand", "funda_frictie",
    "perceelgrootte", "demografie", "vergunning_succeskans", "woonvisie_match",
    "beleidsalignement", "grondwaarde_fit",
    # Risico — pre-M050 (13)
    "funderingsrisico", "asbest", "bodemverontreiniging", "monument",
    "bestemmingswijziging", "constructieve_staat", "juridisch_klimaat",
    "criminaliteit", "max_hoogte_bereikt", "natura2000", "overstromingsrisico",
    "geluid", "luchtkwaliteit",
    # Risico — M050/S03 BRK (3)
    "hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend",
    # Risico — M053/S12 (1)
    "splitsingsrisico",
    # Risico — M054/S02 (1)
    "parkeerdruk",
})

BRK_FACTOR_KEYS: frozenset[str] = frozenset({
    "hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend",
})


def test_registry_count_is_29() -> None:
    """FACTOR_REGISTRY must contain exactly 29 factors."""
    assert len(FACTOR_REGISTRY) == 29, (
        f"Expected 29 factors in FACTOR_REGISTRY, got {len(FACTOR_REGISTRY)}. "
        "If you added/removed a factor, update KNOWN_29_FACTOR_KEYS in both "
        "this file AND the parallel frontend tests."
    )


def test_registry_keys_match_known_set() -> None:
    """FACTOR_REGISTRY keys must equal KNOWN_29_FACTOR_KEYS exactly."""
    actual = set(FACTOR_REGISTRY.keys())
    expected = set(KNOWN_29_FACTOR_KEYS)
    missing = expected - actual
    extra = actual - expected
    assert actual == expected, (
        f"FACTOR_REGISTRY key drift detected. Missing: {missing}; "
        f"Extra (renamed?): {extra}. Update KNOWN_29_FACTOR_KEYS in both "
        "this file AND the parallel frontend tests."
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


def test_grondwaarde_fit_present_as_potentie() -> None:
    """Drift-canary: M054/S01 grondwaarde_fit must be present as a potentie factor."""
    assert "grondwaarde_fit" in FACTOR_REGISTRY, (
        "grondwaarde_fit missing from FACTOR_REGISTRY"
    )
    assert FACTOR_REGISTRY["grondwaarde_fit"].category == "potentie"


def test_parkeerdruk_present_as_risico() -> None:
    """Drift-canary: M054/S02 parkeerdruk must be present as a risico factor."""
    assert "parkeerdruk" in FACTOR_REGISTRY, "parkeerdruk missing from FACTOR_REGISTRY"
    assert FACTOR_REGISTRY["parkeerdruk"].category == "risico"


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
