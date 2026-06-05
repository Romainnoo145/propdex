"""SC#1 stub — every FACTOR_REGISTRY entry has a `bron` field (Phase 7 GROUP-01).

This test FAILS until Plan 03 adds `bron: Bron` field to FactorRegistryEntry
and assigns a value to all 22 entries.
"""
from typing import get_args

from app.services.score_v3 import FACTOR_REGISTRY, Bron, FactorRegistryEntry

# Derive from the Bron Literal so this never goes stale when new brons are added
# (e.g. "brk" in M050/S03). Previously hardcoded → drifted out of sync.
VALID_BRON_VALUES = set(get_args(Bron))


def test_factor_registry_entry_has_bron_field() -> None:
    """FactorRegistryEntry dataclass must declare a `bron` field."""
    fields = {f.name for f in FactorRegistryEntry.__dataclass_fields__.values()}
    assert "bron" in fields, (
        "FactorRegistryEntry must have a `bron` field (added in Phase 7 GROUP-01)"
    )


def test_every_registry_entry_has_valid_bron_value() -> None:
    """All 22 entries must assign a Literal value from the Bron enum."""
    missing: list[str] = []
    invalid: list[tuple[str, str]] = []
    for key, entry in FACTOR_REGISTRY.items():
        value = getattr(entry, "bron", None)
        if value is None:
            missing.append(key)
        elif value not in VALID_BRON_VALUES:
            invalid.append((key, str(value)))
    assert not missing, f"Entries missing bron: {missing}"
    assert not invalid, f"Entries with invalid bron: {invalid}"


def test_potentie_bron_distribution_matches_context() -> None:
    """Per CONTEXT decision 1: bestemming/vergunning_succeskans/woonvisie_match → gemeente_beleid;
    funda_frictie/demografie → markt; vrije_grond/optoppotentie/perceelgrootte/leegstand → fysiek.
    """
    expected = {
        "bestemming": "gemeente_beleid",
        "vergunning_succeskans": "gemeente_beleid",
        "woonvisie_match": "gemeente_beleid",
        "funda_frictie": "markt",
        "demografie": "markt",
        "vrije_grond": "fysiek",
        "optoppotentie": "fysiek",
        "perceelgrootte": "fysiek",
        "leegstand": "fysiek",
    }
    for key, want in expected.items():
        got = getattr(FACTOR_REGISTRY[key], "bron", None)
        assert got == want, f"{key}: expected bron={want}, got {got}"
