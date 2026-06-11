"""REGRESSION — M053/S10: scan Phase 6 computes cascade via gemeente payload load.

Before the fix, parcel_data never had parcel_id set, so the per-parcel
get_cascade_payloads block never ran and scans produced no cascade scores.
After: the scan loads cascade payloads ONCE per gemeente and feeds them to
compute_score_v3 for every parcel.
"""
import inspect

from app.jobs import area_scan


def test_scan_uses_gemeente_payload_load_not_dead_per_parcel_fetch():
    src = inspect.getsource(area_scan)
    assert "load_gemeente_cascade_payloads" in src, (
        "scan Phase 6 must load cascade payloads once per gemeente (M053/S10)"
    )
    assert "_parcel_id_str" not in src, (
        "the dead per-parcel cascade branch (_parcel_id_str) must be removed"
    )
