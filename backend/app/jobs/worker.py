"""ARQ worker configuration for PDF parsing jobs."""

from urllib.parse import urlparse

from arq.connections import RedisSettings

from app.core.config import settings
from app.jobs.pdf_parsing import pdf_parsing_job


def get_redis_settings() -> RedisSettings:
    """
    Parse REDIS_URL into ARQ RedisSettings.

    Parses redis://host:port/db format from settings.REDIS_URL.

    Returns:
        RedisSettings: ARQ Redis connection settings
    """
    parsed = urlparse(settings.REDIS_URL)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or "0"),
        password=parsed.password,
    )


class WorkerSettings:
    """
    ARQ worker configuration for PDF parsing jobs.

    Run worker via: arq app.jobs.worker.WorkerSettings
    """

    functions = [pdf_parsing_job]
    redis_settings = get_redis_settings()
    max_jobs = 5  # Max concurrent parsing jobs (limited by Claude API rate)
    job_timeout = 300  # 5 minutes for download + parse + store
    max_tries = 1  # No auto-retry per user decision
    health_check_interval = 30  # Seconds between health checks
