"""Unit tests for the AI usage logger."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.ai.usage_logger import _compute_cost, log_ai_usage


# ── Cost computation ─────────────────────────────────────────────────────

class TestComputeCost:
    def test_known_model_pricing(self):
        """Verify cost calculation for claude-sonnet-4-5-20250929."""
        cost = _compute_cost(
            model="claude-sonnet-4-5-20250929",
            input_tokens=1_000_000,
            output_tokens=1_000_000,
            cache_creation_input_tokens=0,
            cache_read_input_tokens=0,
        )
        # $3/M input + $15/M output = $18
        assert cost == 18.0

    def test_known_model_with_cache(self):
        """Verify cache token pricing."""
        cost = _compute_cost(
            model="claude-sonnet-4-5-20250929",
            input_tokens=0,
            output_tokens=0,
            cache_creation_input_tokens=1_000_000,
            cache_read_input_tokens=1_000_000,
        )
        # $3.75/M creation + $0.30/M read = $4.05
        assert cost == 4.05

    def test_unknown_model_returns_zero(self):
        """Unknown models get zero cost."""
        cost = _compute_cost(
            model="some-unknown-model",
            input_tokens=500_000,
            output_tokens=500_000,
            cache_creation_input_tokens=0,
            cache_read_input_tokens=0,
        )
        assert cost == 0.0

    def test_zero_tokens(self):
        """Zero tokens → zero cost."""
        cost = _compute_cost(
            model="claude-sonnet-4-5-20250929",
            input_tokens=0,
            output_tokens=0,
            cache_creation_input_tokens=0,
            cache_read_input_tokens=0,
        )
        assert cost == 0.0


# ── log_ai_usage with DB session ────────────────────────────────────────

@pytest.mark.asyncio
async def test_log_ai_usage_creates_row():
    """log_ai_usage with a mock session adds a row and flushes."""
    usage = SimpleNamespace(
        input_tokens=100,
        output_tokens=50,
        cache_creation_input_tokens=0,
        cache_read_input_tokens=0,
    )
    mock_db = AsyncMock()

    await log_ai_usage(
        call_site="test_site",
        model="claude-sonnet-4-5-20250929",
        usage=usage,
        duration_ms=123,
        db=mock_db,
    )

    # Should have called db.add(row) and db.flush()
    mock_db.add.assert_called_once()
    mock_db.flush.assert_awaited_once()

    # Verify the row fields
    row = mock_db.add.call_args[0][0]
    assert row.call_site == "test_site"
    assert row.input_tokens == 100
    assert row.output_tokens == 50
    assert row.total_tokens == 150
    assert row.duration_ms == 123
    assert row.estimated_cost_usd > 0


@pytest.mark.asyncio
async def test_log_ai_usage_computes_cost_correctly():
    """Verify cost computation for known token counts."""
    usage = SimpleNamespace(
        input_tokens=1000,
        output_tokens=500,
        cache_creation_input_tokens=200,
        cache_read_input_tokens=300,
    )
    mock_db = AsyncMock()

    await log_ai_usage(
        call_site="test_cost",
        model="claude-sonnet-4-5-20250929",
        usage=usage,
        db=mock_db,
    )

    row = mock_db.add.call_args[0][0]
    # (1000/1M)*3 + (500/1M)*15 + (300/1M)*0.30 + (200/1M)*3.75
    expected = (1000 * 3 + 500 * 15 + 300 * 0.30 + 200 * 3.75) / 1_000_000
    assert abs(row.estimated_cost_usd - expected) < 1e-9


@pytest.mark.asyncio
async def test_log_ai_usage_handles_exception_gracefully():
    """DB error during logging should not raise."""
    usage = SimpleNamespace(
        input_tokens=100,
        output_tokens=50,
        cache_creation_input_tokens=None,
        cache_read_input_tokens=None,
    )
    mock_db = AsyncMock()
    mock_db.flush.side_effect = RuntimeError("connection closed")

    # Should NOT raise
    await log_ai_usage(
        call_site="test_error",
        model="claude-sonnet-4-5-20250929",
        usage=usage,
        db=mock_db,
    )


@pytest.mark.asyncio
async def test_log_ai_usage_standalone_session():
    """When db=None, creates a standalone session via async_session_factory."""
    usage = SimpleNamespace(
        input_tokens=100,
        output_tokens=50,
        cache_creation_input_tokens=0,
        cache_read_input_tokens=0,
    )

    mock_session = AsyncMock()
    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)

    with patch("app.core.database.async_session_factory", return_value=mock_ctx):
        await log_ai_usage(
            call_site="test_standalone",
            model="claude-sonnet-4-5-20250929",
            usage=usage,
            # db=None (default)
        )

    mock_session.add.assert_called_once()
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_log_ai_usage_missing_usage_fields():
    """Usage object with missing cache fields defaults to 0."""
    usage = SimpleNamespace(
        input_tokens=100,
        output_tokens=50,
        # No cache_creation_input_tokens or cache_read_input_tokens
    )
    mock_db = AsyncMock()

    await log_ai_usage(
        call_site="test_missing_fields",
        model="claude-sonnet-4-5-20250929",
        usage=usage,
        db=mock_db,
    )

    row = mock_db.add.call_args[0][0]
    assert row.cache_creation_input_tokens is None
    assert row.cache_read_input_tokens is None
    assert row.total_tokens == 150
