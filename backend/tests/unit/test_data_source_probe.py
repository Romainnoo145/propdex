"""Unit tests for the M049 type-B data-source liveness probe.

Iron rule: every type-B catalog source must have exactly one evidence rule, so a
newly-added API can never silently default to a wrong status in the demo panel.
"""

import pytest

from app.admin.data_source_probe import (
    FLAG_EVIDENCE,
    NO_SCAN_EVIDENCE,
    PARCEL_COL_EVIDENCE,
    assert_catalog_covered,
    classify,
)
from app.policy_documents.data_source_keys import get_entries_by_type


def test_every_type_b_source_has_exactly_one_evidence_rule() -> None:
    assert_catalog_covered()  # raises on drift

    keys = [e.key for e in get_entries_by_type("B")]
    rule_sets = [set(FLAG_EVIDENCE), set(PARCEL_COL_EVIDENCE), set(NO_SCAN_EVIDENCE)]
    for key in keys:
        hits = sum(key in s for s in rule_sets)
        assert hits == 1, f"{key} must have exactly one evidence rule, found {hits}"


def test_provable_sources_outnumber_unprovable() -> None:
    # 14 provable (flag + parcel-col), 3 honestly-missing — pins the honest split.
    provable = len(FLAG_EVIDENCE) + len(PARCEL_COL_EVIDENCE)
    assert provable == 14
    assert len(NO_SCAN_EVIDENCE) == 3


def test_classify_live_when_evidence_present() -> None:
    assert classify("bodemloket", evidence_present=True) == "live"
    assert classify("bodemloket", evidence_present=False) == "missing"


def test_classify_never_live_for_no_evidence_sources() -> None:
    # Even if a stray evidence flag were passed, no-evidence sources stay honest.
    for key in NO_SCAN_EVIDENCE:
        assert classify(key, evidence_present=True) == "missing"


@pytest.mark.parametrize("flag_key", sorted(set(FLAG_EVIDENCE.values())))
def test_flag_evidence_keys_are_real_scan_flag_names(flag_key: str) -> None:
    # Guard against regressing to guessed names (geluid_lden/overstroming were wrong).
    real_flag_names = {
        "building_metrics", "market_signals", "bodem", "funderingsrisico",
        "natura2000", "overstromingsrisico", "geluid", "luchtkwaliteit",
        "vergunningen", "energielabel",
    }
    assert flag_key in real_flag_names
