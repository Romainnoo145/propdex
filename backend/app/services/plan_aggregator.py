"""Plan aggregator service for cache-first lookup and job orchestration."""

import logging
from datetime import datetime

from arq import ArqRedis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas import AIParsingSection, BestemmingsplanParsed
from app.models.cached_response import CachedAPIResponse
from app.models.parsing_job import ParsingJob
from app.schemas.zoning import ZoningData

logger = logging.getLogger(__name__)


async def enqueue_parsing_job(
    plan_idn: str,
    session: AsyncSession,
    arq_pool: ArqRedis,
) -> ParsingJob:
    """
    Create ParsingJob record and enqueue ARQ background job.

    Reusable function callable from both get_or_parse_plan and upload endpoint.

    Args:
        plan_idn: IMRO plan identifier
        session: SQLAlchemy async session
        arq_pool: ARQ Redis pool for job enqueueing

    Returns:
        ParsingJob: Created job record with job_id
    """
    # Create ParsingJob record
    job = ParsingJob(
        plan_idn=plan_idn,
        status="queued",
        job_id="",  # Will be updated after enqueue
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(job)
    await session.flush()  # Get the id

    # Enqueue ARQ job
    arq_job = await arq_pool.enqueue_job(
        "pdf_parsing_job",
        plan_idn=plan_idn,
    )

    # Update ParsingJob with ARQ job_id
    job.job_id = arq_job.job_id
    session.add(job)
    await session.flush()
    await session.commit()

    logger.info(
        f"Enqueued parsing job {arq_job.job_id} for plan {plan_idn}"
    )

    return job


async def get_or_parse_plan(
    plan_idn: str,
    session: AsyncSession,
    arq_pool: ArqRedis,
) -> AIParsingSection:
    """
    Get cached AI-parsed plan data or enqueue new parsing job.

    Main orchestration function. Implements cache-first strategy:
    1. Check cache for previously parsed data
    2. Check for active parsing jobs
    3. Check for prior download failures (return pdf_not_found)
    4. Enqueue new parsing job

    Args:
        plan_idn: IMRO plan identifier
        session: SQLAlchemy async session
        arq_pool: ARQ Redis pool for job enqueueing

    Returns:
        AIParsingSection: Current state (complete/in_progress/queued/pdf_not_found)
    """
    # 1. Cache check
    cache_key = f"ai_parsed:{plan_idn}"
    stmt = select(CachedAPIResponse).where(
        CachedAPIResponse.cache_key == cache_key,
    )
    result = await session.execute(stmt)
    cached = result.scalar_one_or_none()

    if cached:
        # Check if expired
        age = (datetime.utcnow() - cached.fetched_at).total_seconds()
        if age < cached.ttl_seconds:
            logger.info(f"Cache hit for {plan_idn} (age: {age:.0f}s)")
            parsed_plan = BestemmingsplanParsed(**cached.response_data)
            return AIParsingSection(
                status="complete",
                parsed_plan=parsed_plan,
            )
        else:
            logger.info(f"Cache expired for {plan_idn} (age: {age:.0f}s)")

    # 2. Active job check
    stmt = select(ParsingJob).where(
        ParsingJob.plan_idn == plan_idn,
        ParsingJob.status.in_(["queued", "in_progress"]),
    )
    result = await session.execute(stmt)
    active_job = result.scalar_one_or_none()

    if active_job:
        logger.info(
            f"Active job {active_job.job_id} found for {plan_idn} (status: {active_job.status})"
        )
        return AIParsingSection(
            status=active_job.status,
            job_id=active_job.job_id,
        )

    # 3. Prior download failure check
    stmt = select(ParsingJob).where(
        ParsingJob.plan_idn == plan_idn,
        ParsingJob.status == "failed",
    )
    result = await session.execute(stmt)
    failed_jobs = result.scalars().all()

    for failed_job in failed_jobs:
        if failed_job.error_message and (
            "PDFDownloadError" in failed_job.error_message
            or "download" in failed_job.error_message.lower()
        ):
            logger.info(
                f"Prior download failure detected for {plan_idn}: {failed_job.error_message}"
            )
            return AIParsingSection(
                status="pdf_not_found",
                upload_required=True,
                error_message="Bestemmingsplan PDF niet automatisch beschikbaar. Upload het document handmatig.",
            )

    # 4. Enqueue new job
    logger.info(f"No cache or active job for {plan_idn}, enqueueing new job")
    job = await enqueue_parsing_job(plan_idn, session, arq_pool)
    return AIParsingSection(
        status="queued",
        job_id=job.job_id,
    )


def get_primary_plan_idn(zoning_data: ZoningData | None) -> str | None:
    """
    Extract most relevant plan identifier from DSO zoning data.

    Args:
        zoning_data: Zoning data from Phase 3 DSO API client

    Returns:
        str: Primary plan identifier (plan_id from first plan)
        None: If no zoning data or no plans
    """
    if not zoning_data:
        return None

    if not zoning_data.plans:
        return None

    # Return first plan's ID (DSO API already returns most relevant plan first)
    return zoning_data.plans[0].plan_id


async def get_job_status(
    job_id: str,
    session: AsyncSession,
    arq_pool: ArqRedis,
) -> AIParsingSection:
    """
    Check job status for polling endpoint.

    Args:
        job_id: ARQ job identifier
        session: SQLAlchemy async session
        arq_pool: ARQ Redis pool (for future job info queries)

    Returns:
        AIParsingSection: Current job status with parsed data if complete
    """
    # Query ParsingJob
    stmt = select(ParsingJob).where(
        ParsingJob.job_id == job_id,
    )
    result = await session.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        logger.warning(
            f"Job {job_id} not found"
        )
        return AIParsingSection(status="not_available")

    # If complete, fetch parsed data from cache
    if job.status == "complete":
        cache_key = f"ai_parsed:{job.plan_idn}"
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == cache_key,
        )
        result = await session.execute(stmt)
        cached = result.scalar_one_or_none()

        if cached:
            parsed_plan = BestemmingsplanParsed(**cached.response_data)
            return AIParsingSection(
                status="complete",
                parsed_plan=parsed_plan,
                job_id=job_id,
            )
        else:
            logger.error(
                f"Job {job_id} marked complete but no cache entry found for {job.plan_idn}"
            )
            return AIParsingSection(
                status="failed",
                error_message="Data not found after job completion",
                job_id=job_id,
            )

    # If failed, return error
    if job.status == "failed":
        return AIParsingSection(
            status="failed",
            error_message=job.error_message,
            job_id=job_id,
        )

    # Otherwise return current status (queued/in_progress)
    return AIParsingSection(
        status=job.status,
        job_id=job_id,
    )
