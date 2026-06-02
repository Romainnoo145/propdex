"""Regression: ARQ worker must tolerate Railway's slow private-network init.

Iron rule (do not relax without ops sign-off):
On Railway, `*.railway.internal` DNS is only resolvable a few seconds after a
container boots. arq's create_pool() pings Redis immediately and gives up after
`conn_retries * conn_retry_delay` seconds. arq defaults to ~5s, which lost the
boot race on the `worker` service and crash-looped it — silently freezing the
daily change-monitor cron (prod data stale April → June 2026).

These tests pin a generous retry window so the worker waits for the private
network instead of crashing. Regression guard for the 2026-06-02 fix.
"""

from app.jobs.worker import get_redis_settings

# Minimum window the worker must wait for redis.railway.internal to resolve.
MIN_REDIS_BOOT_WAIT_SECONDS = 30


def test_redis_settings_tolerate_railway_private_network_boot_race() -> None:
    settings = get_redis_settings()

    total_wait = settings.conn_retries * settings.conn_retry_delay
    assert total_wait >= MIN_REDIS_BOOT_WAIT_SECONDS, (
        f"ARQ Redis retry window is {total_wait}s — too short for Railway's "
        f"private-network init. Worker will crash-loop on boot. "
        f"Need conn_retries * conn_retry_delay >= {MIN_REDIS_BOOT_WAIT_SECONDS}s."
    )


def test_redis_settings_preserve_connection_target() -> None:
    """The retry tuning must not disturb host/port/db parsing from REDIS_URL."""
    settings = get_redis_settings()

    assert settings.host
    assert settings.port
    assert settings.database is not None
