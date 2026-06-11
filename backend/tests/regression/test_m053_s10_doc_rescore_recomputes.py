"""REGRESSION — M053/S10: document rescore recomputes cascade, not just re-weights.

Before, rescore_parcels_for_document only refreshed the cache + re-weighted the
existing breakdown, so a woonvisie update did NOT change cascade scores. After,
it recomputes via the shared service (recompute_gemeente_cascade).
"""
import inspect

from app.jobs import rescore_cascade_job


def test_doc_rescore_uses_recompute_service():
    src = inspect.getsource(rescore_cascade_job.rescore_parcels_for_document)
    assert "recompute_gemeente_cascade" in src, (
        "rescore_parcels_for_document must recompute via the shared service (M053/S10)"
    )
    # The old re-weight-only path must be gone.
    assert "_process_parcel" not in src, (
        "the re-weight-only _process_parcel path must be removed from the job"
    )
