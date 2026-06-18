"""REGRESSION-CRITICAL — risico-factor weights post-rebalance pin.

Pins all 18 risico-factor ``default_weight`` values after the largest-remainder
rebalances applied in M050/S03 (Plan 03-02 Task 1), re-applied in M053/S12, and
re-applied again in M054/S02.

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
- M054/S02: the 16 core factors were re-rebalanced via largest-remainder from
  sum=93 to target_sum=86, freeing 7 more units for the new ``parkeerdruk`` factor
  (gemeente_beleid). Sub-sums after: 13 pre-M050 factors = 69, 3 BRK factors = 17,
  splitsingsrisico = 7, parkeerdruk = 7, total = 100.

To re-rebalance for a future factor addition: re-run the largest-remainder method
on the current core weights + manually re-pin these values + bump the docstring.
"""

from __future__ import annotations

from app.services.score_v3 import _REGISTRY_RISICO_SUM, FACTOR_REGISTRY

# Pinned weights after M054/S02 largest-remainder re-rebalance (core target_sum=86).
# Deterministic alphabetical tie-break. (M050/S03 pinned at 80+20; M053/S12 at 93+7.)
EXPECTED_RISICO_WEIGHTS: dict[str, int] = {
    # --- 13 re-rebalanced pre-M050 factors (sum=69) ---
    "funderingsrisico": 11,  # 13 (M050/S03) -> 12 (M053/S12) -> 11 (M054/S02)
    "asbest": 5,  # 6 -> 5 (M054/S02)
    "bodemverontreiniging": 5,  # 6 -> 5 (M054/S02)
    "monument": 5,
    "bestemmingswijziging": 5,  # 6 -> 5 (M054/S02)
    "constructieve_staat": 5,
    "juridisch_klimaat": 5,  # 6 -> 5 (M054/S02)
    "criminaliteit": 5,
    "max_hoogte_bereikt": 5,
    "natura2000": 5,
    "overstromingsrisico": 4,  # 5 -> 4 (M054/S02)
    "geluid": 5,
    "luchtkwaliteit": 4,
    # --- 3 BRK factors (sum=17 after M054/S02 re-rebalance) ---
    "hypotheek_risico": 8,  # 9 (M053/S12) -> 8 (M054/S02)
    "eigendoms_complexiteit": 5,
    "koopwaarde_trend": 4,
    # --- M053/S12 splitsingsrisico (gemeente_beleid) ---
    "splitsingsrisico": 7,
    # --- M054/S02 parkeerdruk (gemeente_beleid) ---
    "parkeerdruk": 7,
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


def test_existing_13_risico_sum_equals_69() -> None:
    """13 pre-M050 risico factors sum to 69 after M054/S02 re-rebalance.

    Was 80 (M050/S03), then 75 (M053/S12 target_sum=93); M054/S02 re-rebalanced the
    core to target_sum=86, so the 13 pre-M050 factors now sum to 69 to free weight
    for parkeerdruk (alongside splitsingsrisico).
    """
    non_pre_m050_keys = {
        "hypotheek_risico",
        "eigendoms_complexiteit",
        "koopwaarde_trend",
        "splitsingsrisico",
        "parkeerdruk",
    }
    existing = {
        k: v for k, v in EXPECTED_RISICO_WEIGHTS.items() if k not in non_pre_m050_keys
    }
    assert sum(existing.values()) == 69, (
        f"13 pre-M050 risico weights must sum to 69, got {sum(existing.values())}"
    )


def test_new_3_brk_weights_sum_equals_17() -> None:
    """3 BRK factors sum to 17 after M054/S02 re-rebalance (was 18 in M053/S12)."""
    assert (
        EXPECTED_RISICO_WEIGHTS["hypotheek_risico"]
        + EXPECTED_RISICO_WEIGHTS["eigendoms_complexiteit"]
        + EXPECTED_RISICO_WEIGHTS["koopwaarde_trend"]
    ) == 17


def test_cascade_gated_weights_equal_7_each_and_total_100() -> None:
    """M053/S12 splitsingsrisico + M054/S02 parkeerdruk pinned at 7 each; total 100."""
    assert EXPECTED_RISICO_WEIGHTS["splitsingsrisico"] == 7
    assert EXPECTED_RISICO_WEIGHTS["parkeerdruk"] == 7
    assert sum(EXPECTED_RISICO_WEIGHTS.values()) == 100
