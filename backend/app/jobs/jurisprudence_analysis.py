"""Jurisprudence AI analysis background job for ARQ worker."""

import hashlib
import logging
import uuid
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ai.claude_client import AIParsingError, ClaudeClient
from app.core.config import CACHE_TTL, settings
from app.government_apis.rechtspraak import rechtspraak_client
from app.models.cached_response import CachedAPIResponse
from app.models.jurisprudence_job import JuridischAnalyseJob

logger = logging.getLogger(__name__)


def _build_cache_key(organization_id: str, ecli_list: list[str]) -> str:
    """Build deterministic cache key from org ID and sorted ECLI list."""
    ecli_hash = hashlib.sha256(",".join(sorted(ecli_list)).encode()).hexdigest()[:16]
    return f"ai_juridisch:{organization_id}:{ecli_hash}"


async def jurisprudence_analysis_job(
    ctx: dict,
    job_record_id: str,
    organization_id: str,
) -> dict:
    """
    Background job: Fetch ruling texts, analyze with Claude, store results.

    Runs in ARQ worker process. Job state tracked in juridisch_analyse_jobs,
    analysis results stored in CachedAPIResponse.

    Args:
        ctx: ARQ context (contains redis connection, etc.)
        job_record_id: JuridischAnalyseJob UUID as string
        organization_id: Tenant UUID as string

    Returns:
        dict with status for ARQ result storage
    """
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

    org_id = uuid.UUID(organization_id)
    record_id = uuid.UUID(job_record_id)

    try:
        async with session_factory() as session:
            # Look up job record
            stmt = select(JuridischAnalyseJob).where(
                JuridischAnalyseJob.id == record_id,
                JuridischAnalyseJob.organization_id == org_id,
            )
            result = await session.execute(stmt)
            job = result.scalar_one_or_none()

            if not job:
                logger.error(
                    "JuridischAnalyseJob not found: id=%s, org=%s",
                    job_record_id,
                    organization_id,
                )
                return {"status": "error", "error": "Job not found"}

            # Update status to in_progress
            job.status = "in_progress"
            job.updated_at = datetime.utcnow()
            session.add(job)
            await session.flush()
            await session.commit()

            ecli_list: list[str] = job.ecli_list  # type: ignore[assignment]
            gemeente_naam: str = job.gemeente_naam

            logger.info(
                "Starting jurisprudence analysis for %s (%d ECLIs, org %s)",
                gemeente_naam,
                len(ecli_list),
                org_id,
            )

            # Fetch ruling texts from Rechtspraak
            rulings: list[dict] = []
            async with httpx.AsyncClient(timeout=60.0) as http_client:
                for ecli in ecli_list:
                    try:
                        doc = await rechtspraak_client.get_jurisprudence_document(
                            ecli=ecli,
                            client=http_client,
                        )
                        if doc is None:
                            logger.warning(
                                "Ruling not found for ECLI %s, skipping", ecli
                            )
                            continue
                        rulings.append(doc)
                    except Exception as e:
                        logger.warning(
                            "Failed to fetch ECLI %s: %s, skipping", ecli, e
                        )
                        continue

            if not rulings:
                job.status = "failed"
                job.error_message = "No ruling texts could be fetched"
                job.updated_at = datetime.utcnow()
                session.add(job)
                await session.flush()
                await session.commit()
                return {"status": "failed", "error": "No ruling texts available"}

            # Analyze with Claude
            try:
                claude_client = ClaudeClient(api_key=settings.ANTHROPIC_API_KEY)
                analysis_result = await claude_client.analyze_jurisprudence(
                    rulings, gemeente_naam
                )
                logger.info(
                    "Successfully analyzed %d rulings for %s",
                    len(analysis_result.ruling_analyses),
                    gemeente_naam,
                )
            except AIParsingError as e:
                logger.error(
                    "Claude analysis failed for %s: %s", gemeente_naam, e.message
                )
                job.status = "failed"
                job.error_message = f"AIParsingError: {e.message}"
                job.updated_at = datetime.utcnow()
                session.add(job)
                await session.flush()
                await session.commit()
                return {"status": "failed", "error": f"Analysis failed: {e.message}"}

            # Store result in cache
            cache_key = _build_cache_key(organization_id, ecli_list)
            ttl_seconds = CACHE_TTL["ai_juridisch"]

            # Upsert pattern
            stmt = select(CachedAPIResponse).where(
                CachedAPIResponse.organization_id == org_id,
                CachedAPIResponse.cache_key == cache_key,
            )
            result = await session.execute(stmt)
            cached_entry = result.scalar_one_or_none()

            if cached_entry:
                cached_entry.response_data = analysis_result.model_dump()
                cached_entry.fetched_at = datetime.utcnow()
                cached_entry.ttl_seconds = ttl_seconds
                cached_entry.updated_at = datetime.utcnow()
                session.add(cached_entry)
            else:
                cached_entry = CachedAPIResponse(
                    organization_id=org_id,
                    cache_key=cache_key,
                    source="ai_juridisch",
                    response_data=analysis_result.model_dump(),
                    fetched_at=datetime.utcnow(),
                    ttl_seconds=ttl_seconds,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                session.add(cached_entry)

            await session.flush()

            # Update job status to complete
            job.status = "complete"
            job.updated_at = datetime.utcnow()
            session.add(job)
            await session.flush()
            await session.commit()

            logger.info(
                "Completed jurisprudence analysis for %s", gemeente_naam
            )
            return {"status": "completed", "gemeente_naam": gemeente_naam}

    except Exception as e:
        logger.exception(
            "Unexpected error in jurisprudence_analysis_job: %s", e
        )
        # Try to update job status to failed
        try:
            async with session_factory() as session:
                stmt = select(JuridischAnalyseJob).where(
                    JuridischAnalyseJob.id == record_id,
                    JuridischAnalyseJob.organization_id == org_id,
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
            logger.error(
                "Failed to update job status after error: %s", update_error
            )

        return {"status": "error", "error": str(e)}
    finally:
        await engine.dispose()
