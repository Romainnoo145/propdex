"""Unit tests for fetch_bodem_data() aggregator with 30-day cache (Phase 68)."""

import uuid
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app.services.bodem_aggregator import fetch_bodem_data
from app.schemas.bodem import BodemData


_BODEM_DICT = {
    "dossiers": [],
    "disclaimer": "Bodemloket bevat niet alle locaties in Nederland. Afwezigheid van een dossier is geen bodemkwaliteitsverklaring.",
    "queried_at": None,
}


@pytest.mark.asyncio
async def test_fetch_bodem_uses_rounded_cache_key():
    """Cache key must round coordinates to nearest meter."""
    org_id = uuid.uuid4()
    mock_session = AsyncMock()
    mock_client = AsyncMock()

    captured_key: list[str] = []

    async def fake_get_cached_or_fetch(
        cache_key: str, **kwargs: object
    ) -> object:
        captured_key.append(cache_key)
        # Return a CacheResult-like object
        result = MagicMock()
        result.data = _BODEM_DICT
        return result

    with patch(
        "app.services.bodem_aggregator.get_cached_or_fetch",
        side_effect=fake_get_cached_or_fetch,
    ):
        await fetch_bodem_data(
            x=121234.567,
            y=487654.321,
            client=mock_client,
            session=mock_session,
        )

    assert len(captured_key) == 1
    assert captured_key[0] == "bodemloket:rd:121235:487654"


@pytest.mark.asyncio
async def test_fetch_bodem_returns_bodemdata():
    """fetch_bodem_data must return a BodemData instance (parsed from cached dict)."""
    org_id = uuid.uuid4()
    mock_session = AsyncMock()
    mock_client = AsyncMock()

    async def fake_get_cached_or_fetch(**kwargs: object) -> object:
        result = MagicMock()
        result.data = _BODEM_DICT
        return result

    with patch(
        "app.services.bodem_aggregator.get_cached_or_fetch",
        side_effect=fake_get_cached_or_fetch,
    ):
        result = await fetch_bodem_data(
            x=208888.0,
            y=378594.0,
            client=mock_client,
            session=mock_session,
        )

    assert isinstance(result, BodemData)
    assert result.dossiers == []
    assert "Bodemloket" in result.disclaimer


@pytest.mark.asyncio
async def test_cache_hit_no_http_call():
    """When get_cached_or_fetch returns immediately (cache hit), query_by_point must NOT be called."""
    org_id = uuid.uuid4()
    mock_session = AsyncMock()
    mock_client = AsyncMock()

    async def fake_get_cached_or_fetch(**kwargs: object) -> object:
        # Simulate cache hit — fetch_fn never called
        result = MagicMock()
        result.data = _BODEM_DICT
        return result

    mock_query_by_point = AsyncMock()

    with (
        patch(
            "app.services.bodem_aggregator.get_cached_or_fetch",
            side_effect=fake_get_cached_or_fetch,
        ),
        patch(
            "app.services.bodem_aggregator.bodemloket_client.query_by_point",
            mock_query_by_point,
        ),
    ):
        await fetch_bodem_data(
            x=208888.0,
            y=378594.0,
            client=mock_client,
            session=mock_session,
        )

    # Cache hit means fetch_fn (and thus query_by_point) should NOT have been called
    mock_query_by_point.assert_not_called()
