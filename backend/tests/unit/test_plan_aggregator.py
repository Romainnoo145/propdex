"""Unit tests for get_cached_plan_only in plan_aggregator."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.ai.schemas import AIParsingSection, BestemmingsplanParsed
from app.services.plan_aggregator import get_cached_plan_only

PLAN_IDN = "NL.IMRO.0363.TestPlan-0001"


def _make_cached_response(plan_idn: str, age_seconds: int = 60, ttl_seconds: int = 86400):
    """Create a mock CachedAPIResponse with valid parsed data."""
    cached = MagicMock()
    cached.cache_key = f"ai_parsed:{plan_idn}"
    cached.fetched_at = datetime.utcnow() - timedelta(seconds=age_seconds)
    cached.ttl_seconds = ttl_seconds
    cached.response_data = {
        "plan_naam": "Testplan",
        "plan_idn": plan_idn,
        "regels": [],
        "overall_confidence": "HIGH",
        "disclaimers": [],
        "samenvatting": "Testsamenvatting",
    }
    return cached


def _make_active_job(plan_idn: str, status: str = "in_progress", job_id: str = "arq:abc123"):
    """Create a mock ParsingJob in active state."""
    job = MagicMock()
    job.plan_idn = plan_idn
    job.status = status
    job.job_id = job_id
    return job


def _make_failed_job(plan_idn: str, error_message: str = "PDFDownloadError: 404"):
    """Create a mock failed ParsingJob."""
    job = MagicMock()
    job.plan_idn = plan_idn
    job.status = "failed"
    job.error_message = error_message
    return job


class _FakeResult:
    """Minimal stand-in for SQLAlchemy result."""

    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        if isinstance(self._value, list):
            return self._value
        return [self._value] if self._value else []


@pytest.mark.asyncio
async def test_get_cached_plan_only_returns_cached_data():
    """Cache hit should return status='complete' with parsed data."""
    session = AsyncMock()
    cached = _make_cached_response(PLAN_IDN, age_seconds=60, ttl_seconds=86400)

    # First execute = cache query, second = active job query (not reached)
    session.execute = AsyncMock(return_value=_FakeResult(cached))

    result = await get_cached_plan_only(PLAN_IDN, session)

    assert result.status == "complete"
    assert result.parsed_plan is not None
    assert result.parsed_plan.plan_idn == PLAN_IDN


@pytest.mark.asyncio
async def test_get_cached_plan_only_returns_opt_in_required():
    """No cache, no active job, no download failure → opt_in_required."""
    session = AsyncMock()

    # Sequence: cache miss, no active job, no failed jobs
    call_count = 0

    async def _execute_side_effect(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _FakeResult(None)       # cache miss
        elif call_count == 2:
            return _FakeResult(None)       # no active job
        else:
            return _FakeResult([])         # no failed jobs

    session.execute = AsyncMock(side_effect=_execute_side_effect)

    result = await get_cached_plan_only(PLAN_IDN, session)

    assert result.status == "opt_in_required"
    assert result.parsed_plan is None
    assert result.job_id is None


@pytest.mark.asyncio
async def test_get_cached_plan_only_returns_active_job_status():
    """Active job exists → return its status and job_id."""
    session = AsyncMock()

    active_job = _make_active_job(PLAN_IDN, status="in_progress", job_id="arq:xyz789")

    call_count = 0

    async def _execute_side_effect(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _FakeResult(None)          # cache miss
        else:
            return _FakeResult(active_job)    # active job found

    session.execute = AsyncMock(side_effect=_execute_side_effect)

    result = await get_cached_plan_only(PLAN_IDN, session)

    assert result.status == "in_progress"
    assert result.job_id == "arq:xyz789"


@pytest.mark.asyncio
async def test_get_cached_plan_only_returns_pdf_not_found_on_download_failure():
    """Prior download failure → pdf_not_found with upload_required."""
    session = AsyncMock()

    failed_job = _make_failed_job(PLAN_IDN, error_message="PDFDownloadError: 404 Not Found")

    call_count = 0

    async def _execute_side_effect(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _FakeResult(None)            # cache miss
        elif call_count == 2:
            return _FakeResult(None)            # no active job
        else:
            return _FakeResult([failed_job])    # failed job with download error

    session.execute = AsyncMock(side_effect=_execute_side_effect)

    result = await get_cached_plan_only(PLAN_IDN, session)

    assert result.status == "pdf_not_found"
    assert result.upload_required is True


@pytest.mark.asyncio
async def test_get_cached_plan_only_expired_cache_falls_through():
    """Expired cache entry should not be returned — should fall through to later checks."""
    session = AsyncMock()

    # Cache entry that's expired (age > ttl)
    expired_cache = _make_cached_response(PLAN_IDN, age_seconds=90000, ttl_seconds=86400)

    call_count = 0

    async def _execute_side_effect(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _FakeResult(expired_cache)  # expired cache
        elif call_count == 2:
            return _FakeResult(None)           # no active job
        else:
            return _FakeResult([])             # no failed jobs

    session.execute = AsyncMock(side_effect=_execute_side_effect)

    result = await get_cached_plan_only(PLAN_IDN, session)

    assert result.status == "opt_in_required"
