"""Integration tests for cache manager: CRUD, TTL, multi-tenant isolation."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.core.config import CACHE_TTL
from app.models.cached_response import CachedAPIResponse
from app.models.organization import Organization
from app.services.cache_manager import get_cached_or_fetch, invalidate_cache


@pytest.fixture
async def org_id(test_db):
    """Create a test organization and return its ID."""
    org = Organization(name="Cache Test Org")
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org.id


@pytest.fixture
async def two_orgs(test_db):
    """Create two organizations for multi-tenant isolation tests."""
    org_a = Organization(name="Org A")
    org_b = Organization(name="Org B")
    test_db.add(org_a)
    test_db.add(org_b)
    await test_db.flush()
    await test_db.commit()
    return org_a.id, org_b.id


class TestCacheMiss:
    async def test_calls_fetch_fn(self, test_db, org_id):
        mock_fetch = AsyncMock(return_value={"key": "value"})

        result = await get_cached_or_fetch(
            cache_key="bag:test:1",
            source="bag",
            organization_id=org_id,
            fetch_fn=mock_fetch,
            session=test_db,
        )

        assert result.is_cached is False
        mock_fetch.assert_called_once()

    async def test_stores_in_database(self, test_db, org_id):
        mock_fetch = AsyncMock(return_value={"data": "stored"})

        await get_cached_or_fetch(
            cache_key="bag:test:2",
            source="bag",
            organization_id=org_id,
            fetch_fn=mock_fetch,
            session=test_db,
        )

        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == org_id,
            CachedAPIResponse.cache_key == "bag:test:2",
        )
        row = (await test_db.execute(stmt)).scalar_one()
        assert row.response_data == {"data": "stored"}
        assert row.source == "bag"

    async def test_stores_complex_jsonb(self, test_db, org_id):
        complex_data = {
            "nested": {"list": [1, 2, None, "str"], "empty": {}},
            "null_val": None,
            "numbers": [1.5, -3, 0],
        }
        mock_fetch = AsyncMock(return_value=complex_data)

        result = await get_cached_or_fetch(
            cache_key="bag:complex",
            source="bag",
            organization_id=org_id,
            fetch_fn=mock_fetch,
            session=test_db,
        )

        assert result.data == complex_data


class TestCacheHit:
    async def test_returns_cached_data(self, test_db, org_id):
        mock_fetch = AsyncMock(return_value={"cached": "data"})

        await get_cached_or_fetch(
            cache_key="bag:hit:1", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )
        result = await get_cached_or_fetch(
            cache_key="bag:hit:1", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )

        assert result.is_cached is True
        assert result.data == {"cached": "data"}

    async def test_does_not_call_fetch_fn(self, test_db, org_id):
        mock_fetch = AsyncMock(return_value={"val": 1})

        await get_cached_or_fetch(
            cache_key="bag:hit:2", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )
        await get_cached_or_fetch(
            cache_key="bag:hit:2", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )

        assert mock_fetch.call_count == 1

    async def test_metadata(self, test_db, org_id):
        mock_fetch = AsyncMock(return_value={"meta": True})

        await get_cached_or_fetch(
            cache_key="bag:meta", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )
        result = await get_cached_or_fetch(
            cache_key="bag:meta", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )

        assert result.age_seconds >= 0
        assert result.cached_at.endswith("Z")


class TestTTLExpiration:
    async def test_stale_cache_refetches(self, test_db, org_id):
        mock_fetch = AsyncMock(side_effect=[{"v": 1}, {"v": 2}])

        await get_cached_or_fetch(
            cache_key="bag:ttl:1", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )

        # Manually expire the entry
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == org_id,
            CachedAPIResponse.cache_key == "bag:ttl:1",
        )
        entry = (await test_db.execute(stmt)).scalar_one()
        entry.fetched_at = datetime.utcnow() - timedelta(seconds=entry.ttl_seconds + 100)
        await test_db.flush()
        await test_db.commit()

        result = await get_cached_or_fetch(
            cache_key="bag:ttl:1", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )

        assert result.is_cached is False
        assert result.data == {"v": 2}

    async def test_fresh_cache_within_ttl(self, test_db, org_id):
        mock_fetch = AsyncMock(return_value={"fresh": True})

        await get_cached_or_fetch(
            cache_key="bag:ttl:2", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )
        result = await get_cached_or_fetch(
            cache_key="bag:ttl:2", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )

        assert result.is_cached is True


class TestForceRefresh:
    async def test_bypasses_fresh_cache(self, test_db, org_id):
        mock_fetch = AsyncMock(side_effect=[{"v": 1}, {"v": 2}])

        await get_cached_or_fetch(
            cache_key="bag:force:1", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )
        result = await get_cached_or_fetch(
            cache_key="bag:force:1", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
            force_refresh=True,
        )

        assert result.is_cached is False
        assert result.data == {"v": 2}
        assert mock_fetch.call_count == 2

    async def test_updates_entry(self, test_db, org_id):
        mock_fetch = AsyncMock(side_effect=[{"v": 1}, {"v": 2}])

        await get_cached_or_fetch(
            cache_key="bag:force:2", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )
        await get_cached_or_fetch(
            cache_key="bag:force:2", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
            force_refresh=True,
        )

        # Only 1 row (upsert)
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == org_id,
            CachedAPIResponse.cache_key == "bag:force:2",
        )
        rows = (await test_db.execute(stmt)).scalars().all()
        assert len(rows) == 1
        assert rows[0].response_data == {"v": 2}


class TestInvalidation:
    async def test_deletes_entry(self, test_db, org_id):
        mock_fetch = AsyncMock(return_value={"to_delete": True})

        await get_cached_or_fetch(
            cache_key="bag:inv:1", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )
        await invalidate_cache("bag:inv:1", org_id, test_db)

        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == org_id,
            CachedAPIResponse.cache_key == "bag:inv:1",
        )
        result = (await test_db.execute(stmt)).scalar_one_or_none()
        assert result is None

    async def test_nonexistent_no_error(self, test_db, org_id):
        # Should not raise
        await invalidate_cache("nonexistent-key", org_id, test_db)

    async def test_then_fetch_is_cache_miss(self, test_db, org_id):
        mock_fetch = AsyncMock(side_effect=[{"v": 1}, {"v": 2}])

        await get_cached_or_fetch(
            cache_key="bag:inv:3", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )
        await invalidate_cache("bag:inv:3", org_id, test_db)
        result = await get_cached_or_fetch(
            cache_key="bag:inv:3", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )

        assert result.is_cached is False
        assert result.data == {"v": 2}
        assert mock_fetch.call_count == 2


class TestMultiTenantIsolation:
    async def test_different_orgs_same_key_independent(self, test_db, two_orgs):
        org_a, org_b = two_orgs
        fetch_a = AsyncMock(return_value={"org": "A"})
        fetch_b = AsyncMock(return_value={"org": "B"})

        result_a = await get_cached_or_fetch(
            cache_key="shared:key", source="bag", organization_id=org_a,
            fetch_fn=fetch_a, session=test_db,
        )
        result_b = await get_cached_or_fetch(
            cache_key="shared:key", source="bag", organization_id=org_b,
            fetch_fn=fetch_b, session=test_db,
        )

        assert result_a.data == {"org": "A"}
        assert result_b.data == {"org": "B"}
        fetch_a.assert_called_once()
        fetch_b.assert_called_once()

    async def test_invalidate_one_org_preserves_other(self, test_db, two_orgs):
        org_a, org_b = two_orgs

        await get_cached_or_fetch(
            cache_key="shared:inv", source="bag", organization_id=org_a,
            fetch_fn=AsyncMock(return_value={"org": "A"}), session=test_db,
        )
        await get_cached_or_fetch(
            cache_key="shared:inv", source="bag", organization_id=org_b,
            fetch_fn=AsyncMock(return_value={"org": "B"}), session=test_db,
        )

        await invalidate_cache("shared:inv", org_a, test_db)

        # Org B still cached
        mock_b = AsyncMock(return_value={"org": "B-new"})
        result_b = await get_cached_or_fetch(
            cache_key="shared:inv", source="bag", organization_id=org_b,
            fetch_fn=mock_b, session=test_db,
        )
        assert result_b.is_cached is True
        assert result_b.data == {"org": "B"}
        mock_b.assert_not_called()

    async def test_cache_miss_for_different_org(self, test_db, two_orgs):
        org_a, org_b = two_orgs
        fetch_a = AsyncMock(return_value={"org": "A"})
        fetch_b = AsyncMock(return_value={"org": "B"})

        # Cache for org_a
        await get_cached_or_fetch(
            cache_key="shared:miss", source="bag", organization_id=org_a,
            fetch_fn=fetch_a, session=test_db,
        )

        # Org B should be a miss
        result_b = await get_cached_or_fetch(
            cache_key="shared:miss", source="bag", organization_id=org_b,
            fetch_fn=fetch_b, session=test_db,
        )
        assert result_b.is_cached is False
        fetch_b.assert_called_once()


class TestEdgeCases:
    async def test_unknown_source_raises_key_error(self, test_db, org_id):
        with pytest.raises(KeyError):
            await get_cached_or_fetch(
                cache_key="test:key", source="nonexistent",
                organization_id=org_id, fetch_fn=AsyncMock(), session=test_db,
            )

    async def test_ttl_matches_config(self, test_db, org_id):
        mock_fetch = AsyncMock(return_value={"ttl": True})

        await get_cached_or_fetch(
            cache_key="bag:ttl_cfg", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )

        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == "bag:ttl_cfg",
        )
        entry = (await test_db.execute(stmt)).scalar_one()
        assert entry.ttl_seconds == CACHE_TTL["bag"]

    async def test_fetch_fn_exception_propagates(self, test_db, org_id):
        mock_fetch = AsyncMock(side_effect=RuntimeError("API down"))

        with pytest.raises(RuntimeError, match="API down"):
            await get_cached_or_fetch(
                cache_key="bag:err", source="bag", organization_id=org_id,
                fetch_fn=mock_fetch, session=test_db,
            )

        # No cache entry created
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == "bag:err",
        )
        result = (await test_db.execute(stmt)).scalar_one_or_none()
        assert result is None

    async def test_upsert_no_duplicate(self, test_db, org_id):
        mock_fetch = AsyncMock(side_effect=[{"v": 1}, {"v": 2}])

        await get_cached_or_fetch(
            cache_key="bag:upsert", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )

        # Expire and refetch
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == org_id,
            CachedAPIResponse.cache_key == "bag:upsert",
        )
        entry = (await test_db.execute(stmt)).scalar_one()
        entry.fetched_at = datetime.utcnow() - timedelta(seconds=entry.ttl_seconds + 100)
        await test_db.flush()
        await test_db.commit()

        await get_cached_or_fetch(
            cache_key="bag:upsert", source="bag", organization_id=org_id,
            fetch_fn=mock_fetch, session=test_db,
        )

        # Still only 1 row
        rows = (await test_db.execute(stmt)).scalars().all()
        assert len(rows) == 1
        assert rows[0].response_data == {"v": 2}
