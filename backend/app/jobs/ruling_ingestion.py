"""Ruling cache ingestion background job for ARQ worker.

Populates the ruling_cache table with omgevingsrecht rulings for a gemeente's
court region. Uses the ECLI registry to determine court codes, then fetches
rulings via RechtspraakClient with client-side court-code filtering.

This job is org-agnostic -- court rulings are public data shared across tenants.
"""

import asyncio
import logging
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.government_apis.ecli_registry import extract_court_code, get_court_codes_for_gemeente
from app.government_apis.rechtspraak import rechtspraak_client
from app.models.ruling_cache import RulingCache

logger = logging.getLogger(__name__)


async def ruling_ingestion_job(
    ctx: dict,
    gemeente_naam: str,
) -> dict:
    """Background job: fetch and cache omgevingsrecht rulings for a gemeente.

    Looks up the gemeente's court codes (current + pre-2013), searches
    Rechtspraak API with client-side ECLI filtering, batch-fetches full
    documents, and upserts into ruling_cache.

    Args:
        ctx: ARQ context (contains redis connection, etc.)
        gemeente_naam: Municipality name (must match ECLI registry).

    Returns:
        dict with status, gemeente, cached count, and fetched count.
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

    try:
        # Look up court codes for this gemeente
        court_codes = get_court_codes_for_gemeente(gemeente_naam)
        if not court_codes:
            logger.warning("ruling_ingestion: unknown gemeente '%s'", gemeente_naam)
            return {"status": "error", "error": "Unknown gemeente"}

        logger.info(
            "ruling_ingestion: starting for %s (court codes: %s)",
            gemeente_naam,
            court_codes,
        )

        # Search Rechtspraak API with court-code filtering
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            search_results = await rechtspraak_client.search_by_court(
                court_codes=court_codes,
                client=http_client,
                max_results=100,
            )

            logger.info(
                "ruling_ingestion: found %d court-filtered results for %s",
                len(search_results),
                gemeente_naam,
            )

            if not search_results:
                return {
                    "status": "completed",
                    "gemeente": gemeente_naam,
                    "cached": 0,
                    "fetched": 0,
                }

            # Batch fetch full documents with concurrency control
            sem = asyncio.Semaphore(5)

            async def fetch_one(ecli: str) -> dict | None:
                async with sem:
                    try:
                        return await rechtspraak_client.get_jurisprudence_document(
                            ecli=ecli, client=http_client
                        )
                    except Exception as e:
                        logger.warning("Failed to fetch %s: %s", ecli, e)
                        return None

            tasks = [fetch_one(r["ecli"]) for r in search_results]
            docs = await asyncio.gather(*tasks)

        # Build lookup from search results for title/summary
        search_lookup = {r["ecli"]: r for r in search_results}

        # Upsert into ruling_cache
        cached_count = 0
        fetched_count = 0
        async with session_factory() as session:
            for doc in docs:
                if doc is None:
                    continue

                fetched_count += 1
                ecli = doc["ecli"]
                search_entry = search_lookup.get(ecli, {})
                court_code = extract_court_code(ecli) or ""

                # Check if already cached
                stmt = select(RulingCache).where(RulingCache.ecli == ecli)
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    # Update existing
                    existing.full_text = doc.get("text", "")
                    existing.fetched_at = datetime.utcnow()
                    existing.updated_at = datetime.utcnow()
                    session.add(existing)
                else:
                    # Create new
                    entry = RulingCache(
                        ecli=ecli,
                        court_code=court_code,
                        instantie=doc.get("instantie", ""),
                        datum_uitspraak=doc.get("datum_uitspraak", ""),
                        title=search_entry.get("title", ""),
                        summary=search_entry.get("summary", ""),
                        full_text=doc.get("text", ""),
                        gemeente_query=gemeente_naam,
                        fetched_at=datetime.utcnow(),
                    )
                    session.add(entry)

                cached_count += 1

            await session.flush()
            await session.commit()

        logger.info(
            "ruling_ingestion: completed for %s (cached=%d, fetched=%d)",
            gemeente_naam,
            cached_count,
            fetched_count,
        )

        return {
            "status": "completed",
            "gemeente": gemeente_naam,
            "cached": cached_count,
            "fetched": fetched_count,
        }

    except Exception as e:
        logger.exception("ruling_ingestion: unexpected error for %s: %s", gemeente_naam, e)
        return {"status": "error", "error": str(e)}
    finally:
        await engine.dispose()
