"""ARQ worker configuration for PDF parsing jobs."""

from urllib.parse import urlparse

from arq.connections import RedisSettings

from app.core.config import settings
from app.jobs.area_scan import area_scan_job
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
    ARQ worker configuration for PDF parsing and area scan jobs.

    Run worker via: arq app.jobs.worker.WorkerSettings
    """

    functions = [pdf_parsing_job, area_scan_job]
    redis_settings = get_redis_settings()
    max_jobs = 5  # Max concurrent jobs
    job_timeout = 3600  # 1 hour for large area scans
    max_tries = 1  # No auto-retry per user decision
    allow_abort_jobs = True  # Enable job cancellation for area scans
    health_check_interval = 30  # Seconds between health checks
