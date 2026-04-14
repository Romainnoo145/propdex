"""Integration test for the weekly auto-ingest ARQ cron — M045/S06 T07.

Verifies that the cron entrypoint iterates KNOWN_GEMEENTES_FOR_AUTO_INGEST
and calls ingest_gemeente_policies once per entry with the correct kwargs.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from app.jobs.auto_ingest_job import weekly_policy_auto_ingest_job
from app.policy_documents.auto_ingest import KNOWN_GEMEENTES_FOR_AUTO_INGEST


async def test_weekly_job_calls_ingest_for_each_known_gemeente() -> None:
    """The cron iterates KNOWN_GEMEENTES_FOR_AUTO_INGEST and calls ingest once per entry."""
    fake_summary = {"omgevingsvisie": 1, "huisvestingsverordening": 1}

    with patch(
        "app.jobs.auto_ingest_job.ingest_gemeente_policies",
        new=AsyncMock(return_value=fake_summary),
    ) as mock_ingest:
        result = await weekly_policy_auto_ingest_job({})

    # Called once per known gemeente
    assert mock_ingest.call_count == len(KNOWN_GEMEENTES_FOR_AUTO_INGEST)

    # Each call had the expected kwargs (kwargs-only — gemeente_code + gemeente_naam + db)
    for entry, call in zip(KNOWN_GEMEENTES_FOR_AUTO_INGEST, mock_ingest.call_args_list, strict=True):
        kwargs = call.kwargs
        assert kwargs["gemeente_code"] == entry["gemeente_code"]
        assert kwargs["gemeente_naam"] == entry["gemeente_naam"]
        assert "db" in kwargs

    # Aggregate result shape
    assert result["gemeentes_processed"] == len(KNOWN_GEMEENTES_FOR_AUTO_INGEST)
    assert isinstance(result["results"], dict)
    assert len(result["results"]) == len(KNOWN_GEMEENTES_FOR_AUTO_INGEST)
    for entry in KNOWN_GEMEENTES_FOR_AUTO_INGEST:
        assert result["results"][entry["gemeente_code"]] == fake_summary
