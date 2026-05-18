"""REGRESSION-CRITICAL — M050/S03 risico-factor weights post-rebalance pin.

Pins all 16 risico-factor ``default_weight`` values after the largest-remainder
rebalance applied in Plan 03-02 Task 1.

Drift in EITHER direction (manual edit, accidental re-rebalance, factor
addition without re-pin) fails CI. Per MEMORY.md iron-rule pattern.

The 13 existing-risico values were computed once via
``_rebalance_risico_weights(current_weights, target_sum=80)`` and pinned here
verbatim. To re-rebalance for a future factor addition: update the helper
``target_sum`` + manually re-pin these values + bump the M050/S03 reference
in the docstring.
"""

from __future__ import annotations

from app.services.score_v3 import _REGISTRY_RISICO_SUM, FACTOR_REGISTRY

# Pinned weights after _rebalance_risico_weights(target_sum=80) — Plan 03-02 Task 1.
# Largest-remainder method, deterministic alphabetical tie-break.
EXPECTED_RISICO_WEIGHTS: dict[str, int] = {
    # --- 13 rebalanced existing factors (sum=80) ---
    "funderingsrisico": 13,
    "asbest": 6,
    "bodemverontreiniging": 6,
    "monument": 5,
    "bestemmingswijziging": 7,
    "constructieve_staat": 6,
    "juridisch_klimaat": 7,
    "criminaliteit": 6,
    "max_hoogte_bereikt": 5,
    "natura2000": 5,
    "overstromingsrisico": 5,
    "geluid": 5,
    "luchtkwaliteit": 4,
    # --- 3 new BRK factors (sum=20, M050/S03 D2) ---
    "hypotheek_risico": 10,
    "eigendoms_complexiteit": 6,
    "koopwaarde_trend": 4,
}


def test_risico_weights_post_s03_match_locked_table() -> None:
    """Every risico-factor default_weight matches the pinned post-rebalance value."""
    actual = {
        k: e.default_weight
        for k, e in FACTOR_REGISTRY.items()
        if e.category == "risico"
    }
    assert actual == EXPECTED_RISICO_WEIGHTS, (
        f"Risico weights drift detected:\n"
        f"expected={EXPECTED_RISICO_WEIGHTS}\nactual={actual}"
    )


def test_risico_weights_sum_equals_100() -> None:
    """Module-level _REGISTRY_RISICO_SUM guard mirror."""
    assert _REGISTRY_RISICO_SUM == 100


def test_existing_13_risico_sum_equals_80() -> None:
    """13 pre-existing risico factors sum to 80 post-rebalance (frees 20 for BRK)."""
    new_brk_keys = {"hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend"}
    existing = {
        k: v for k, v in EXPECTED_RISICO_WEIGHTS.items() if k not in new_brk_keys
    }
    assert sum(existing.values()) == 80, (
        f"13 existing-risico weights must sum to 80, got {sum(existing.values())}"
    )


def test_new_3_brk_weights_sum_equals_20() -> None:
    """3 new BRK factors sum to 20 (D2 weight allocation)."""
    assert (
        EXPECTED_RISICO_WEIGHTS["hypotheek_risico"]
        + EXPECTED_RISICO_WEIGHTS["eigendoms_complexiteit"]
        + EXPECTED_RISICO_WEIGHTS["koopwaarde_trend"]
    ) == 20
