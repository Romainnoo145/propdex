"""Integration tests for cache manager: CRUD, TTL, shared access."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.core.config import CACHE_TTL
from app.models.cached_response import CachedAPIResponse
from app.services.cache_manager import get_cached_or_fetch, invalidate_cache


class TestCacheMiss:
    async def test_calls_fetch_fn(self, test_db):
        mock_fetch = AsyncMock(return_value={"key": "value"})

        result = await get_cached_or_fetch(
            cache_key="bag:test:1",
            source="bag",
            fetch_fn=mock_fetch,
            session=test_db,
        )

        assert result.is_cached is False
        mock_fetch.assert_called_once()

    async def test_stores_in_database(self, test_db):
        mock_fetch = AsyncMock(return_value={"data": "stored"})

        await get_cached_or_fetch(
            cache_key="bag:test:2",
            source="bag",
            fetch_fn=mock_fetch,
            session=test_db,
        )

        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == "bag:test:2",
        )
        row = (await test_db.execute(stmt)).scalar_one()
        assert row.response_data == {"data": "stored"}
        assert row.source == "bag"

    async def test_stores_complex_jsonb(self, test_db):
        complex_data = {
            "nested": {"list": [1, 2, None, "str"], "empty": {}},
            "null_val": None,
            "numbers": [1.5, -3, 0],
        }
        mock_fetch = AsyncMock(return_value=complex_data)

        result = await get_cached_or_fetch(
            cache_key="bag:complex",
            source="bag",
            fetch_fn=mock_fetch,
            session=test_db,
        )

        assert result.data == complex_data


class TestCacheHit:
    async def test_returns_cached_data(self, test_db):
        mock_fetch = AsyncMock(return_value={"cached": "data"})

        await get_cached_or_fetch(
            cache_key="bag:hit:1", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )
        result = await get_cached_or_fetch(
            cache_key="bag:hit:1", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )

        assert result.is_cached is True
        assert result.data == {"cached": "data"}

    async def test_does_not_call_fetch_fn(self, test_db):
        mock_fetch = AsyncMock(return_value={"val": 1})

        await get_cached_or_fetch(
            cache_key="bag:hit:2", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )
        await get_cached_or_fetch(
            cache_key="bag:hit:2", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )

        assert mock_fetch.call_count == 1

    async def test_metadata(self, test_db):
        mock_fetch = AsyncMock(return_value={"meta": True})

        await get_cached_or_fetch(
            cache_key="bag:meta", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )
        result = await get_cached_or_fetch(
            cache_key="bag:meta", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )

        assert result.age_seconds >= 0
        assert result.cached_at.endswith("Z")


class TestTTLExpiration:
    async def test_stale_cache_refetches(self, test_db):
        mock_fetch = AsyncMock(side_effect=[{"v": 1}, {"v": 2}])

        await get_cached_or_fetch(
            cache_key="bag:ttl:1", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )

        # Manually expire the entry
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == "bag:ttl:1",
        )
        entry = (await test_db.execute(stmt)).scalar_one()
        entry.fetched_at = datetime.utcnow() - timedelta(seconds=entry.ttl_seconds + 100)
        await test_db.flush()
        await test_db.commit()

        result = await get_cached_or_fetch(
            cache_key="bag:ttl:1", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )

        assert result.is_cached is False
        assert result.data == {"v": 2}

    async def test_fresh_cache_within_ttl(self, test_db):
        mock_fetch = AsyncMock(return_value={"fresh": True})

        await get_cached_or_fetch(
            cache_key="bag:ttl:2", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )
        result = await get_cached_or_fetch(
            cache_key="bag:ttl:2", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )

        assert result.is_cached is True


class TestForceRefresh:
    async def test_bypasses_fresh_cache(self, test_db):
        mock_fetch = AsyncMock(side_effect=[{"v": 1}, {"v": 2}])

        await get_cached_or_fetch(
            cache_key="bag:force:1", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )
        result = await get_cached_or_fetch(
            cache_key="bag:force:1", source="bag",
            fetch_fn=mock_fetch, session=test_db,
            force_refresh=True,
        )

        assert result.is_cached is False
        assert result.data == {"v": 2}
        assert mock_fetch.call_count == 2

    async def test_updates_entry(self, test_db):
        mock_fetch = AsyncMock(side_effect=[{"v": 1}, {"v": 2}])

        await get_cached_or_fetch(
            cache_key="bag:force:2", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )
        await get_cached_or_fetch(
            cache_key="bag:force:2", source="bag",
            fetch_fn=mock_fetch, session=test_db,
            force_refresh=True,
        )

        # Only 1 row (upsert)
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == "bag:force:2",
        )
        rows = (await test_db.execute(stmt)).scalars().all()
        assert len(rows) == 1
        assert rows[0].response_data == {"v": 2}


class TestInvalidation:
    async def test_deletes_entry(self, test_db):
        mock_fetch = AsyncMock(return_value={"to_delete": True})

        await get_cached_or_fetch(
            cache_key="bag:inv:1", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )
        await invalidate_cache("bag:inv:1", test_db)

        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == "bag:inv:1",
        )
        result = (await test_db.execute(stmt)).scalar_one_or_none()
        assert result is None

    async def test_nonexistent_no_error(self, test_db):
        # Should not raise
        await invalidate_cache("nonexistent-key", test_db)

    async def test_then_fetch_is_cache_miss(self, test_db):
        mock_fetch = AsyncMock(side_effect=[{"v": 1}, {"v": 2}])

        await get_cached_or_fetch(
            cache_key="bag:inv:3", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )
        await invalidate_cache("bag:inv:3", test_db)
        result = await get_cached_or_fetch(
            cache_key="bag:inv:3", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )

        assert result.is_cached is False
        assert result.data == {"v": 2}
        assert mock_fetch.call_count == 2


class TestSharedAccess:
    """Cache is shared across all users — no org isolation."""

    async def test_same_key_returns_same_data(self, test_db):
        """Two fetches with same key return same data (shared catalog)."""
        fetch_first = AsyncMock(return_value={"data": "shared"})
        fetch_second = AsyncMock(return_value={"data": "should_not_be_called"})

        result_1 = await get_cached_or_fetch(
            cache_key="shared:key:1", source="bag",
            fetch_fn=fetch_first, session=test_db,
        )
        result_2 = await get_cached_or_fetch(
            cache_key="shared:key:1", source="bag",
            fetch_fn=fetch_second, session=test_db,
        )

        # Second call gets cached data from first call
        assert result_1.data == {"data": "shared"}
        assert result_2.data == {"data": "shared"}
        assert result_2.is_cached is True
        fetch_first.assert_called_once()
        fetch_second.assert_not_called()

    async def test_different_keys_independent(self, test_db):
        """Different cache keys store independent data."""
        fetch_a = AsyncMock(return_value={"key": "A"})
        fetch_b = AsyncMock(return_value={"key": "B"})

        result_a = await get_cached_or_fetch(
            cache_key="shared:a", source="bag",
            fetch_fn=fetch_a, session=test_db,
        )
        result_b = await get_cached_or_fetch(
            cache_key="shared:b", source="bag",
            fetch_fn=fetch_b, session=test_db,
        )

        assert result_a.data == {"key": "A"}
        assert result_b.data == {"key": "B"}
        fetch_a.assert_called_once()
        fetch_b.assert_called_once()


class TestEdgeCases:
    async def test_unknown_source_raises_key_error(self, test_db):
        with pytest.raises(KeyError):
            await get_cached_or_fetch(
                cache_key="test:key", source="nonexistent",
                fetch_fn=AsyncMock(), session=test_db,
            )

    async def test_ttl_matches_config(self, test_db):
        mock_fetch = AsyncMock(return_value={"ttl": True})

        await get_cached_or_fetch(
            cache_key="bag:ttl_cfg", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )

        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == "bag:ttl_cfg",
        )
        entry = (await test_db.execute(stmt)).scalar_one()
        assert entry.ttl_seconds == CACHE_TTL["bag"]

    async def test_fetch_fn_exception_propagates(self, test_db):
        mock_fetch = AsyncMock(side_effect=RuntimeError("API down"))

        with pytest.raises(RuntimeError, match="API down"):
            await get_cached_or_fetch(
                cache_key="bag:err", source="bag",
                fetch_fn=mock_fetch, session=test_db,
            )

        # No cache entry created
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == "bag:err",
        )
        result = (await test_db.execute(stmt)).scalar_one_or_none()
        assert result is None

    async def test_upsert_no_duplicate(self, test_db):
        mock_fetch = AsyncMock(side_effect=[{"v": 1}, {"v": 2}])

        await get_cached_or_fetch(
            cache_key="bag:upsert", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )

        # Expire and refetch
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == "bag:upsert",
        )
        entry = (await test_db.execute(stmt)).scalar_one()
        entry.fetched_at = datetime.utcnow() - timedelta(seconds=entry.ttl_seconds + 100)
        await test_db.flush()
        await test_db.commit()

        await get_cached_or_fetch(
            cache_key="bag:upsert", source="bag",
            fetch_fn=mock_fetch, session=test_db,
        )

        # Still only 1 row
        rows = (await test_db.execute(stmt)).scalars().all()
        assert len(rows) == 1
        assert rows[0].response_data == {"v": 2}
