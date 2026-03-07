"""Ruling cache ingestion background job for ARQ worker.

Populates the ruling_cache table with omgevingsrecht rulings for a gemeente's
court region plus national RVS (Raad van State) rulings. Uses the ECLI registry
to determine court codes, then fetches rulings via RechtspraakClient with
client-side court-code filtering. Geo-tags each ruling via GeoContextualizer.

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
from app.services.geo_contextualizer import extract_gemeente_from_text, extract_uitkomst

logger = logging.getLogger(__name__)


async def ruling_ingestion_job(
    ctx: dict,
    gemeente_naam: str,
) -> dict:
    """Background job: fetch and cache omgevingsrecht rulings for a gemeente.

    Looks up the gemeente's court codes (current + pre-2013), searches
    Rechtspraak API with client-side ECLI filtering, batch-fetches full
    documents, geo-tags via GeoContextualizer, and upserts into ruling_cache.
    Also fetches RVS (Raad van State) rulings and geo-tags them via text extraction.

    Args:
        ctx: ARQ context (contains redis connection, etc.)
        gemeente_naam: Municipality name (must match ECLI registry).

    Returns:
        dict with status, gemeente, cached count, fetched count, and rvs_fetched count.
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

        # Search Rechtspraak API with court-code filtering + RVS
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            # Pass 1: Rechtbank rulings for this gemeente's court region
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

            # Pass 2: RVS (Raad van State) rulings -- national, geo-tagged via text
            rvs_results = await rechtspraak_client.search_by_court(
                court_codes=["RVS"],
                client=http_client,
                max_results=50,
            )

            logger.info(
                "ruling_ingestion: found %d RVS results",
                len(rvs_results),
            )

            # Merge results, deduplicating by ECLI
            all_results = list(search_results)
            seen_eclis = {r["ecli"] for r in search_results}
            rvs_count = 0
            for rvs_entry in rvs_results:
                if rvs_entry["ecli"] not in seen_eclis:
                    all_results.append(rvs_entry)
                    seen_eclis.add(rvs_entry["ecli"])
                    rvs_count += 1

            if not all_results:
                return {
                    "status": "completed",
                    "gemeente": gemeente_naam,
                    "cached": 0,
                    "fetched": 0,
                    "rvs_fetched": 0,
                }

            # Batch fetch full documents with shared concurrency control
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

            tasks = [fetch_one(r["ecli"]) for r in all_results]
            docs = await asyncio.gather(*tasks)

        # Build lookup from all search results for title/summary
        search_lookup = {r["ecli"]: r for r in all_results}

        # Upsert into ruling_cache with geo-extraction
        cached_count = 0
        fetched_count = 0
        rvs_fetched = 0
        async with session_factory() as session:
            for doc in docs:
                if doc is None:
                    continue

                fetched_count += 1
                ecli = doc["ecli"]
                search_entry = search_lookup.get(ecli, {})
                court_code = extract_court_code(ecli) or ""

                # Track RVS documents
                if court_code == "RVS":
                    rvs_fetched += 1

                # Geo-extraction: extract gemeente and uitkomst from text
                full_text = doc.get("text", "")
                extracted_gemeente = extract_gemeente_from_text(full_text)
                uitkomst = extract_uitkomst(full_text, search_entry.get("summary", ""))

                # RVS rulings have no gemeente_query (national scope)
                ruling_gemeente_query = gemeente_naam if court_code != "RVS" else None

                # Check if already cached
                stmt = select(RulingCache).where(RulingCache.ecli == ecli)
                result = await session.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    # Update existing -- backfill geo data on re-fetch
                    existing.full_text = full_text
                    existing.extracted_gemeente = extracted_gemeente
                    existing.uitkomst = uitkomst
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
                        full_text=full_text,
                        gemeente_query=ruling_gemeente_query,
                        extracted_gemeente=extracted_gemeente,
                        uitkomst=uitkomst,
                        fetched_at=datetime.utcnow(),
                    )
                    session.add(entry)

                cached_count += 1

            await session.flush()
            await session.commit()

        logger.info(
            "ruling_ingestion: completed for %s (cached=%d, fetched=%d, rvs=%d)",
            gemeente_naam,
            cached_count,
            fetched_count,
            rvs_fetched,
        )

        return {
            "status": "completed",
            "gemeente": gemeente_naam,
            "cached": cached_count,
            "fetched": fetched_count,
            "rvs_fetched": rvs_fetched,
        }

    except Exception as e:
        logger.exception("ruling_ingestion: unexpected error for %s: %s", gemeente_naam, e)
        return {"status": "error", "error": str(e)}
    finally:
        await engine.dispose()
