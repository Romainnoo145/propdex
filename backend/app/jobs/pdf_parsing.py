"""PDF parsing background job for ARQ worker."""

import logging
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ai.claude_client import AIParsingError, create_claude_client
from app.core.config import CACHE_TTL, settings
from app.models.cached_response import CachedAPIResponse
from app.models.parsing_job import ParsingJob
from app.services.pdf_downloader import (
    PDFDownloadError,
    download_and_store_pdf,
    get_stored_pdf,
)

logger = logging.getLogger(__name__)


async def pdf_parsing_job(
    ctx: dict,
    plan_idn: str,
    organization_id: str | None = None,  # kept for backward compat with queued jobs
    pdf_url: str | None = None,
) -> dict:
    """
    Background job: Download bestemmingsplan PDF, parse with Claude, store results.

    Runs in ARQ worker process. Job state tracked in Redis,
    parsed results stored in PostgreSQL CachedAPIResponse.

    Args:
        ctx: ARQ context (contains redis connection, etc.)
        plan_idn: IMRO plan identifier
        organization_id: Deprecated — kept for backward compat with already-queued jobs
        pdf_url: Optional explicit PDF URL (None = construct from plan_idn)

    Returns:
        dict with plan_idn and status for ARQ result storage
    """
    # Create a new database session (worker runs outside FastAPI)
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        echo=False,
    )
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    try:
        async with session_factory() as session:
            # Update ParsingJob status to "in_progress"
            stmt = select(ParsingJob).where(
                ParsingJob.plan_idn == plan_idn,
            )
            result = await session.execute(stmt)
            job = result.scalar_one_or_none()

            if not job:
                logger.error(
                    f"ParsingJob not found for plan_idn={plan_idn}"
                )
                return {"plan_idn": plan_idn, "status": "error", "error": "Job not found"}

            job.status = "in_progress"
            job.updated_at = datetime.utcnow()
            session.add(job)
            await session.flush()
            await session.commit()

            logger.info(f"Starting PDF parsing for {plan_idn}")

            # Get or download PDF
            pdf_doc = await get_stored_pdf(plan_idn, session)
            if not pdf_doc:
                # Need to download
                try:
                    async with httpx.AsyncClient(timeout=60.0) as http_client:
                        pdf_doc = await download_and_store_pdf(
                            plan_idn, session, http_client
                        )
                except PDFDownloadError as e:
                    logger.error(f"PDF download failed for {plan_idn}: {e}")
                    job.status = "failed"
                    job.error_message = f"PDFDownloadError: {str(e)}"
                    job.updated_at = datetime.utcnow()
                    session.add(job)
                    await session.flush()
                    await session.commit()
                    return {
                        "plan_idn": plan_idn,
                        "status": "failed",
                        "error": f"Download failed: {e}",
                    }

            # Parse with Claude
            try:
                claude_client = create_claude_client()
                parsed_result = await claude_client.parse_bestemmingsplan(
                    pdf_doc.file_data, plan_idn
                )
                logger.info(
                    f"Successfully parsed {plan_idn}: {len(parsed_result.regels)} rules"
                )
            except AIParsingError as e:
                logger.error(f"Claude parsing failed for {plan_idn}: {e.message}")
                job.status = "failed"
                job.error_message = f"AIParsingError: {e.message}"
                job.updated_at = datetime.utcnow()
                session.add(job)
                await session.flush()
                await session.commit()
                return {
                    "plan_idn": plan_idn,
                    "status": "failed",
                    "error": f"Parsing failed: {e.message}",
                }

            # Store parsed results in cache
            cache_key = f"ai_parsed:{plan_idn}"
            ttl_seconds = CACHE_TTL["ai_parsed"]

            # Check if cache entry exists (upsert pattern)
            stmt = select(CachedAPIResponse).where(
                CachedAPIResponse.cache_key == cache_key,
            )
            result = await session.execute(stmt)
            cached_entry = result.scalar_one_or_none()

            if cached_entry:
                # Update existing
                cached_entry.response_data = parsed_result.model_dump()
                cached_entry.fetched_at = datetime.utcnow()
                cached_entry.ttl_seconds = ttl_seconds
                cached_entry.updated_at = datetime.utcnow()
                session.add(cached_entry)
            else:
                # Create new
                cached_entry = CachedAPIResponse(
                    cache_key=cache_key,
                    source="ai_parsed",
                    response_data=parsed_result.model_dump(),
                    fetched_at=datetime.utcnow(),
                    ttl_seconds=ttl_seconds,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                session.add(cached_entry)

            await session.flush()

            # Update ParsingJob status to "complete"
            job.status = "complete"
            job.updated_at = datetime.utcnow()
            session.add(job)
            await session.flush()
            await session.commit()

            logger.info(f"Successfully completed parsing job for {plan_idn}")

            return {"plan_idn": plan_idn, "status": "completed"}

    except Exception as e:
        logger.exception(f"Unexpected error in pdf_parsing_job for {plan_idn}: {e}")
        # Try to update job status to failed
        try:
            async with session_factory() as session:
                stmt = select(ParsingJob).where(
                    ParsingJob.plan_idn == plan_idn,
                )
                result = await session.execute(stmt)
                job = result.scalar_one_or_none()
                if job:
                    job.status = "failed"
                    job.error_message = f"Unexpected error: {str(e)}"
                    job.updated_at = datetime.utcnow()
                    session.add(job)
                    await session.flush()
                    await session.commit()
        except Exception as update_error:
            logger.error(f"Failed to update job status after error: {update_error}")

        return {"plan_idn": plan_idn, "status": "error", "error": str(e)}
    finally:
        # Clean up engine
        await engine.dispose()
