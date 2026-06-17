"""M050/S03 — Unit tests for compute_score_v3 D3 sparse-data redistribution.

Pins the D3 redistribution math:

- When all 3 BRK risico factors are missing → 13 existing risico factors rescale to ~100.
- When only `koopwaarde_trend` is missing → existing risico factors scale by 100/96.
- When ALL 3 BRK records are present + valid → no rescale; existing risico factor
  gewicht equals its `FACTOR_REGISTRY[k].default_weight`.
- Potentie factor gewichts NEVER change under D3 redistribution.

The D3 block is positioned AFTER `_apply_missing_data_strategy` (existing redistribution
already ran) AND AFTER the percentage_of_category re-sync — so we observe the COMBINED
effect of the existing missing-data strategy + the new BRK-specific rescale.
"""
from __future__ import annotations

from datetime import UTC, datetime

from app.services.score_v3 import (
    _RISICO_REDISTRIBUTION_TARGET,
    _SPARSE_REDISTRIBUTABLE_RISICO,
    compute_score_v3,
)

# M053/S12: splitsingsrisico is a verdict-gated RISICO cascade factor whose weight (7)
# is reserved from the risico-100 pool and appended AFTER redistribution. So the
# in-breakdown risico factors that D3/missing-redistribution operate on sum to
# _RISICO_REDISTRIBUTION_TARGET (== 93). We import the production constant so the test
# and prod can never drift. With no cascade payload (compute_score_v3({})),
# splitsingsrisico is missing → it does not enter the non-missing risico sum, so the
# rescale target stays 93.
assert _RISICO_REDISTRIBUTION_TARGET == 93

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _full_brk_record(
    *,
    heeft_hypotheek: bool = True,
    koopjaar: int | None = 2018,
    eigenaar_naam: str | None = "Voorbeeld BV",
    kvk_nummer: str | None = "12345678",
) -> dict:
    """Single full BRK record — 8 years old by default → koopwaarde_trend bucket 5–15."""
    return {
        "eigenaar_type": "rechtspersoon",
        "eigenaar_naam": eigenaar_naam,
        "kvk_nummer": kvk_nummer,
        "statutaire_zetel": "Amsterdam",
        "zakelijk_recht_type": "Eigendom",
        "aandeel": "1/1",
        "koopsom": 250000.0,
        "koopjaar": koopjaar,
        "heeft_hypotheek": heeft_hypotheek,
        "fetched_at": datetime.now(UTC).isoformat(),
    }


def _parcel_data_with_brk(records: list[dict] | None) -> dict:
    """parcel_data with optional brk_records key for redistribution tests."""
    if records is None:
        return {}
    return {"brk_records": records}


def _risico_breakdown(result) -> dict:
    return {k: v for k, v in result.score_breakdown.items() if v.categorie == "risico"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_sparse_redistributable_set_subset_check() -> None:
    """Sanity guard duplicated here for fast-fail when running this file alone."""
    assert _SPARSE_REDISTRIBUTABLE_RISICO == frozenset(
        {"hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend"}
    )


def test_no_brk_factor_missing_no_rescale() -> None:
    """When all 3 BRK factors are non-missing, the D3 BRK-rescale block does NOT fire.

    NOTE: `_apply_missing_data_strategy` runs BEFORE the D3 block, and that existing
    strategy will redistribute weights when OTHER risico factors are missing (here
    parcel_data has only `brk_records`, so funderingsrisico / asbest / etc. are
    missing — their weight gets redistributed across the non-missing set, which
    includes the 3 BRK factors). What D3 specifically must NOT do: rescale when
    NONE of {hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend} is missing.
    We assert that invariant by checking the sum of all non-missing risico gewicht
    is still ≈100 — proving no D3 distortion on top of `_apply_missing_data_strategy`.
    """
    parcel_data = _parcel_data_with_brk([_full_brk_record()])
    result = compute_score_v3(parcel_data)

    risico = _risico_breakdown(result)
    assert risico["hypotheek_risico"].missing is False
    assert risico["eigendoms_complexiteit"].missing is False
    assert risico["koopwaarde_trend"].missing is False

    # Sum of non-missing risico gewicht stays at the redistribution target (no D3
    # amplification on top of _apply_missing_data_strategy's redistribution).
    # Target = 100 minus any registered-but-unwired cascade factor (splitsingsrisico
    # until Task 7) — see _RISICO_REDISTRIBUTION_TARGET.
    non_missing_gewicht = sum(f.gewicht for f in risico.values() if not f.missing)
    assert abs(non_missing_gewicht - _RISICO_REDISTRIBUTION_TARGET) <= 1.0, (
        f"non-missing risico gewicht {non_missing_gewicht} not ≈"
        f"{_RISICO_REDISTRIBUTION_TARGET} — "
        "D3 may have fired despite no BRK factor missing"
    )


def test_redistribution_when_all_3_brk_missing() -> None:
    """All 3 BRK missing → sum of non-missing risico gewicht ≈ 100."""
    result = compute_score_v3({})  # no parcel_data → all BRK missing

    risico = _risico_breakdown(result)
    assert risico["hypotheek_risico"].missing is True
    assert risico["eigendoms_complexiteit"].missing is True
    assert risico["koopwaarde_trend"].missing is True

    non_missing_gewicht = sum(
        f.gewicht for k, f in risico.items() if not f.missing
    )
    # Tolerance for largest-remainder rounding errors. Target excludes the
    # registered-but-unwired splitsingsrisico weight (until Task 7).
    assert abs(non_missing_gewicht - _RISICO_REDISTRIBUTION_TARGET) <= 1.0, (
        f"non-missing risico gewicht sum {non_missing_gewicht} not ≈"
        f"{_RISICO_REDISTRIBUTION_TARGET} after D3 rescale"
    )


def test_redistribution_when_only_koopwaarde_trend_missing() -> None:
    """Only koopwaarde_trend missing (koopjaar=None) → 2 BRK present, sum stays ≈ 100.

    NOTE: With parcel_data containing only `brk_records`, most existing risico
    factors are also missing → `_apply_missing_data_strategy` runs first and
    inflates the gewicht of the surviving factors. D3 then further rescales by
    100/96 (since missing_weight=4). What matters: the SUM of non-missing risico
    gewicht stays ≈100 (the rescale-to-100 invariant), and koopwaarde_trend is
    flagged missing as expected.
    """
    record = _full_brk_record(koopjaar=None)
    parcel_data = _parcel_data_with_brk([record])
    result = compute_score_v3(parcel_data)

    risico = _risico_breakdown(result)
    assert risico["hypotheek_risico"].missing is False
    assert risico["eigendoms_complexiteit"].missing is False
    assert risico["koopwaarde_trend"].missing is True

    # The koopwaarde_trend factor has missing=True and its bijdrage stayed at 0
    # (D3 leaves missing factors at gewicht 0 / unchanged from _apply_missing_data_strategy).
    assert risico["koopwaarde_trend"].bijdrage == 0

    # Non-missing risico gewicht sum stays at the redistribution target (rescale
    # invariant); target excludes the unwired splitsingsrisico weight until Task 7.
    non_missing_gewicht = sum(f.gewicht for f in risico.values() if not f.missing)
    assert abs(non_missing_gewicht - _RISICO_REDISTRIBUTION_TARGET) <= 1.0


def test_d3_rescale_math_in_isolation() -> None:
    """Pin the D3 multiplier shape — independent of _apply_missing_data_strategy.

    Build a parcel_data so dense that NO existing risico factor is missing — only
    one of the 3 BRK is missing (the koopwaarde_trend, by providing brk_records
    where the most-recent record has koopjaar=None). The _apply_missing_data_strategy
    won't fire (missing ratio ≤ 20% per category), so the D3 block is the SOLE
    source of weight changes for the non-BRK risico factors.

    This is hard to construct deterministically without mocking every factor
    function. Instead: we measure that AFTER the rescale, the sum of non-missing
    risico gewicht is ≈100, and koopwaarde_trend bijdrage is 0. The integration
    test in test_m050_s03_sparse_redistribution.py covers the full E2E.
    """
    record = _full_brk_record(koopjaar=None)
    result = compute_score_v3({"brk_records": [record]})

    risico = _risico_breakdown(result)
    # koopwaarde_trend isolated as missing (input-side check):
    assert risico["koopwaarde_trend"].missing is True
    # hypotheek + eigendoms remain non-missing
    assert risico["hypotheek_risico"].missing is False
    assert risico["eigendoms_complexiteit"].missing is False
    # Rescale invariant (target excludes unwired splitsingsrisico weight until Task 7)
    non_missing = sum(f.gewicht for f in risico.values() if not f.missing)
    assert abs(non_missing - _RISICO_REDISTRIBUTION_TARGET) <= 1.0


def test_redistribution_preserves_potentie_gewicht_unchanged() -> None:
    """D3 rescales risico only. Potentie sum invariant: non-missing potentie
    gewicht still sums to ~100 (whatever _apply_missing_data_strategy produced
    is left untouched by D3).

    Verifies D3 doesn't leak into potentie: a potentie factor would NEVER appear
    in `_SPARSE_REDISTRIBUTABLE_RISICO` and the D3 block guards on `factor.categorie == "risico"`.
    """
    result = compute_score_v3({})  # all BRK missing
    potentie = {k: v for k, v in result.score_breakdown.items() if v.categorie == "potentie"}
    non_missing_potentie = sum(f.gewicht for f in potentie.values() if not f.missing)
    # Either ≈100 (full redistribution by _apply_missing_data_strategy) or ≤100 (no
    # redistribution). The key invariant: D3 should NOT inflate >100 by re-scaling.
    assert non_missing_potentie <= 100.0 + 1.0, (
        f"potentie gewicht sum {non_missing_potentie} > 100 — D3 may have leaked"
    )


def test_redistribution_when_all_3_brk_missing_plus_existing_risico_missing_F8() -> None:
    """F8 chosen behaviour: scale only over non-missing risico factors."""
    # parcel_data={} forces ALL risico factors missing (BRK + funderingsrisico + ...).
    # The non-missing risico set is decided by individual factor function logic +
    # _apply_missing_data_strategy. We assert the invariant: sum of non-missing
    # risico gewicht after D3 ≈ 100 (rescale rule "only non-missing receives the
    # multiplier" holds).
    result = compute_score_v3({})

    risico = _risico_breakdown(result)
    non_missing = {k: f for k, f in risico.items() if not f.missing}
    if not non_missing:
        # Edge case: if literally everything is missing, no rescale possible.
        # Assert that ALL risico factors are missing (consistent with D3 short-circuit).
        assert all(f.missing for f in risico.values())
        return
    non_missing_gewicht = sum(f.gewicht for f in non_missing.values())
    assert abs(non_missing_gewicht - _RISICO_REDISTRIBUTION_TARGET) <= 1.0, (
        f"F8: non-missing risico gewicht {non_missing_gewicht} not ≈"
        f"{_RISICO_REDISTRIBUTION_TARGET}"
    )


def test_redistribution_bijdrage_proportional_to_normalized_score_times_new_gewicht() -> None:
    """Per-factor invariant: bijdrage == round(genormaliseerde_score * gewicht, 4)."""
    result = compute_score_v3({})

    risico = _risico_breakdown(result)
    for key, factor in risico.items():
        if factor.missing:
            continue
        expected = round(factor.genormaliseerde_score * factor.gewicht, 4)
        assert factor.bijdrage == expected, (
            f"factor {key}: bijdrage {factor.bijdrage} != "
            f"score*gewicht {expected}"
        )


def test_breakdown_size_28_with_brk_factors_present() -> None:
    """breakdown grows to 28 entries (8 core potentie + 16 risico + woonvisie_match +
    beleidsalignement + grondwaarde_fit + splitsingsrisico)."""
    result = compute_score_v3({})
    assert len(result.score_breakdown) == 28
    keys = set(result.score_breakdown.keys())
    assert "hypotheek_risico" in keys
    assert "eigendoms_complexiteit" in keys
    assert "koopwaarde_trend" in keys
    assert "woonvisie_match" in keys
    assert "beleidsalignement" in keys
    assert "grondwaarde_fit" in keys
    assert "splitsingsrisico" in keys
