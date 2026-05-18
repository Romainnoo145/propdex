"""REGRESSION-CRITICAL — M050/S03 FACTOR_REGISTRY entries pin.

Pins existence + category + bron of the 3 new BRK risico-factor entries.
Per MEMORY.md iron-rule pattern.

Also pins _SPARSE_REDISTRIBUTABLE_RISICO membership and D3 non-membership in
_CRITICAL_RISK_FACTORS (no -10% penalty when missing).
"""

from __future__ import annotations

import pytest

from app.services.score_v3 import (
    _CRITICAL_RISK_FACTORS,
    _SPARSE_REDISTRIBUTABLE_RISICO,
    FACTOR_REGISTRY,
)

BRK_FACTOR_KEYS = ("hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend")


@pytest.mark.parametrize("key", BRK_FACTOR_KEYS)
def test_three_factors_in_registry(key: str) -> None:
    """Each BRK factor has category='risico' and bron='brk'."""
    assert key in FACTOR_REGISTRY, f"Missing FACTOR_REGISTRY entry: {key}"
    entry = FACTOR_REGISTRY[key]
    assert entry.category == "risico", (
        f"{key}.category must be 'risico', got '{entry.category}'"
    )
    assert entry.bron == "brk", (
        f"{key}.bron must be 'brk', got '{entry.bron}'"
    )


def test_sparse_redistributable_set_matches_3_brk_keys() -> None:
    """_SPARSE_REDISTRIBUTABLE_RISICO contains exactly the 3 BRK factor keys."""
    assert _SPARSE_REDISTRIBUTABLE_RISICO == frozenset(BRK_FACTOR_KEYS)


def test_brk_factors_not_in_critical_risk_factors() -> None:
    """3 BRK factors MUST NOT be in _CRITICAL_RISK_FACTORS (D3 no-penalty rule)."""
    for key in BRK_FACTOR_KEYS:
        assert key not in _CRITICAL_RISK_FACTORS, (
            f"{key} must NOT be in _CRITICAL_RISK_FACTORS — D3 explicit non-membership"
        )
