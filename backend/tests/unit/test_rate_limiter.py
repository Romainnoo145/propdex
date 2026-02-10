"""Tests for APIRateLimiter: semaphore concurrency control + token bucket throttling."""

import asyncio
import time

import pytest

from app.government_apis.rate_limiter import APIRateLimiter


class TestRateLimiter:
    @pytest.mark.asyncio
    async def test_semaphore_limits_concurrent(self):
        """Verify semaphore enforces max concurrent requests."""
        limiter = APIRateLimiter(max_concurrent=2, max_per_hour=9999)

        # Track concurrent executions
        concurrent_count = 0
        max_concurrent_seen = 0
        lock = asyncio.Lock()

        async def task():
            nonlocal concurrent_count, max_concurrent_seen
            async with limiter:
                # Increment counter on entry
                async with lock:
                    concurrent_count += 1
                    max_concurrent_seen = max(max_concurrent_seen, concurrent_count)

                # Hold the context manager for a short duration
                await asyncio.sleep(0.1)

                # Decrement counter on exit
                async with lock:
                    concurrent_count -= 1

        # Fire 5 concurrent tasks
        tasks = [task() for _ in range(5)]
        await asyncio.gather(*tasks)

        # Verify: at most 2 were running simultaneously
        assert max_concurrent_seen == 2

    @pytest.mark.asyncio
    async def test_token_bucket_initialized(self):
        """Verify token bucket limiter is initialized with correct parameters."""
        limiter = APIRateLimiter(max_concurrent=999, max_per_hour=100)

        # Verify limiter has the correct configuration
        assert limiter.max_per_hour == 100
        assert limiter._limiter is not None
        assert limiter._limiter.max_rate == 100
        assert limiter._limiter.time_period == 3600  # 1 hour in seconds

        # Verify limiter works (doesn't raise on acquire)
        async with limiter:
            pass

    @pytest.mark.asyncio
    async def test_disabled_mode_skips_limiting(self):
        """Verify disabled mode bypasses all rate limiting."""
        limiter = APIRateLimiter(max_concurrent=1, max_per_hour=1)
        limiter.enabled = False

        # Acquire 100 times - should complete near-instantly
        start_time = time.time()
        for _ in range(100):
            async with limiter:
                pass
        duration = time.time() - start_time

        # Should be very fast (no semaphore, no token bucket)
        assert duration < 0.5

    @pytest.mark.asyncio
    async def test_context_manager_releases_on_exception(self):
        """Verify semaphore is released even when exception occurs."""
        limiter = APIRateLimiter(max_concurrent=1, max_per_hour=9999)

        # Acquire and raise inside context manager
        with pytest.raises(ValueError):
            async with limiter:
                raise ValueError("Test exception")

        # Verify semaphore is released (next acquire succeeds immediately)
        start_time = time.time()
        async with limiter:
            pass
        duration = time.time() - start_time

        # Should be immediate (semaphore was released)
        assert duration < 0.1
