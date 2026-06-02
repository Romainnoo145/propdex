"""ARQ worker configuration for PDF parsing jobs.

Run worker via: python -m app.jobs.worker
"""

import asyncio
from urllib.parse import urlparse

from arq.connections import RedisSettings
from arq.cron import cron
from arq.worker import Worker, get_kwargs

from app.core.config import settings
from app.jobs.area_scan import area_scan_job
from app.jobs.auto_ingest_job import weekly_policy_auto_ingest_job
from app.jobs.brk_retention_cleanup_job import brk_retention_cleanup_job
from app.jobs.change_monitor import daily_change_monitor_job
from app.jobs.document_summary import document_summary_job
from app.jobs.funda_snapshot import funda_snapshot_job
from app.jobs.jurisprudence_analysis import (
    rechtsgrond_backfill_job,
    ruling_analysis_job,
    tegenstander_backfill_job,
)
from app.jobs.pdf_parsing import pdf_parsing_job
from app.jobs.rescore_cascade_job import rescore_parcel, rescore_parcels_for_document
from app.jobs.rescore_weights import rescore_weights_job
from app.jobs.ruling_ingestion import ruling_ingestion_job


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
        # Railway's private network (*.railway.internal, IPv6) only becomes
        # resolvable a few seconds after a container boots. arq's create_pool()
        # pings Redis immediately; its default ~5s retry window (conn_retries=5
        # x conn_retry_delay=1) lost that boot race and crash-looped the worker,
        # silently freezing the daily change-monitor cron. Wait up to ~40s so the
        # private network can come up instead. Regression: tests/unit/test_worker_redis_settings.py
        conn_retries=20,
        conn_retry_delay=2,
    )


class WorkerSettings:
    """
    ARQ worker configuration for PDF parsing and area scan jobs.

    Run worker via: arq app.jobs.worker.WorkerSettings
    """

    functions = [
        pdf_parsing_job,
        document_summary_job,
        area_scan_job,
        daily_change_monitor_job,
        funda_snapshot_job,
        rechtsgrond_backfill_job,
        ruling_analysis_job,
        ruling_ingestion_job,
        tegenstander_backfill_job,
        rescore_weights_job,
        rescore_parcels_for_document,
        rescore_parcel,  # M050/S03 — per-parcel rescore after BRK persist
        weekly_policy_auto_ingest_job,
        brk_retention_cleanup_job,  # M050/S01 — daily 03:00 UTC retention
    ]
    redis_settings = get_redis_settings()
    max_jobs = 5  # Max concurrent jobs
    job_timeout = 3600  # 1 hour for large area scans
    max_tries = 1  # No auto-retry per user decision
    allow_abort_jobs = True  # Enable job cancellation for area scans
    health_check_interval = 30  # Seconds between health checks
    cron_jobs = [
        cron(daily_change_monitor_job, hour=3, minute=0, unique=True),
        cron(
            weekly_policy_auto_ingest_job,
            weekday="mon",
            hour=4,
            minute=0,
            unique=True,
        ),
        cron(brk_retention_cleanup_job, hour=3, minute=0, unique=True),  # M050/S01 daily 03:00 UTC
    ]


if __name__ == "__main__":
    # Initialise Sentry early so worker errors are captured
    from app.core.sentry import init_sentry

    init_sentry()

    # Python 3.14 removed asyncio.get_event_loop() outside async context.
    # arq 0.27.0 calls it in Worker.__init__, so we create the worker inside
    # an async function where a loop exists, then run it.
    async def _run_worker() -> None:
        worker = Worker(**get_kwargs(WorkerSettings))
        await worker.async_run()

    asyncio.run(_run_worker())
