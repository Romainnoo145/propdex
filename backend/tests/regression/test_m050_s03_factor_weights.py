"""REGRESSION-CRITICAL — risico-factor weights post-rebalance pin.

Pins all 17 risico-factor ``default_weight`` values after the largest-remainder
rebalances applied in M050/S03 (Plan 03-02 Task 1) and re-applied in M053/S12.

Drift in EITHER direction (manual edit, accidental re-rebalance, factor
addition without re-pin) fails CI. Per MEMORY.md iron-rule pattern.

History:
- M050/S03: the 13 existing-risico values were computed once via
  ``_rebalance_risico_weights(current_weights, target_sum=80)`` and pinned,
  freeing 20 units for 3 new BRK factors (sum=20).
- M053/S12: the 16 then-existing factors were re-rebalanced via
  ``_rebalance_risico_weights(current_weights, target_sum=93)``, freeing 7 units
  for the new ``splitsingsrisico`` factor (gemeente_beleid). Sub-sums after:
  13 pre-M050 factors = 75, 3 BRK factors = 18, splitsingsrisico = 7, total = 100.

To re-rebalance for a future factor addition: update the helper ``target_sum``
+ manually re-pin these values + bump the reference in the docstring.
"""

from __future__ import annotations

from app.services.score_v3 import _REGISTRY_RISICO_SUM, FACTOR_REGISTRY

# Pinned weights after M053/S12 _rebalance_risico_weights(target_sum=93).
# Largest-remainder method, deterministic alphabetical tie-break.
# (M050/S03 originally pinned these at target_sum=80 + BRK sum=20; re-pinned here.)
EXPECTED_RISICO_WEIGHTS: dict[str, int] = {
    # --- 13 re-rebalanced pre-M050 factors (sum=75) ---
    "funderingsrisico": 12,  # was 13 (M050/S03)
    "asbest": 6,
    "bodemverontreiniging": 6,
    "monument": 5,
    "bestemmingswijziging": 6,  # was 7 (M050/S03)
    "constructieve_staat": 5,  # was 6 (M050/S03)
    "juridisch_klimaat": 6,  # was 7 (M050/S03)
    "criminaliteit": 5,  # was 6 (M050/S03)
    "max_hoogte_bereikt": 5,
    "natura2000": 5,
    "overstromingsrisico": 5,
    "geluid": 5,
    "luchtkwaliteit": 4,
    # --- 3 BRK factors (sum=18 after M053/S12 re-rebalance) ---
    "hypotheek_risico": 9,  # was 10 (M050/S03)
    "eigendoms_complexiteit": 5,  # was 6 (M050/S03)
    "koopwaarde_trend": 4,
    # --- M053/S12 splitsingsrisico (gemeente_beleid) ---
    "splitsingsrisico": 7,
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


def test_existing_13_risico_sum_equals_75() -> None:
    """13 pre-M050 risico factors sum to 75 after M053/S12 re-rebalance.

    Was 80 (M050/S03 target_sum=80); M053/S12 re-rebalanced to target_sum=93,
    so the 13 pre-M050 factors now sum to 75 to free weight for splitsingsrisico.
    """
    non_pre_m050_keys = {
        "hypotheek_risico",
        "eigendoms_complexiteit",
        "koopwaarde_trend",
        "splitsingsrisico",
    }
    existing = {
        k: v for k, v in EXPECTED_RISICO_WEIGHTS.items() if k not in non_pre_m050_keys
    }
    assert sum(existing.values()) == 75, (
        f"13 pre-M050 risico weights must sum to 75, got {sum(existing.values())}"
    )


def test_new_3_brk_weights_sum_equals_18() -> None:
    """3 BRK factors sum to 18 after M053/S12 re-rebalance (was 20 in M050/S03)."""
    assert (
        EXPECTED_RISICO_WEIGHTS["hypotheek_risico"]
        + EXPECTED_RISICO_WEIGHTS["eigendoms_complexiteit"]
        + EXPECTED_RISICO_WEIGHTS["koopwaarde_trend"]
    ) == 18


def test_splitsingsrisico_weight_equals_7_and_total_100() -> None:
    """M053/S12 splitsingsrisico pinned at 7; risico total still sums to 100."""
    assert EXPECTED_RISICO_WEIGHTS["splitsingsrisico"] == 7
    assert sum(EXPECTED_RISICO_WEIGHTS.values()) == 100
