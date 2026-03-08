"""Per-ruling AI analysis background job for ARQ worker.

Fetches ruling texts from RulingCache, extracts relevant sections,
sends to Claude in batches of 5, and stores per-ruling results
(ai_analysis, vergunningstype, datum_indiening, doorlooptijd_dagen)
back on RulingCache rows.
"""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ai.claude_client import AIParsingError, ClaudeClient
from app.core.config import settings
from app.models.ruling_cache import RulingCache
from app.services.doorlooptijd import (
    compute_doorlooptijd,
    extract_filing_date,
)

logger = logging.getLogger(__name__)

# Max rulings per Claude API call (token budget control)
BATCH_SIZE = 5


async def ruling_analysis_job(
    ctx: dict,
    gemeente_naam: str,
    ecli_list: list[str],
) -> dict:
    """Background job: Analyze rulings with Claude and store per-ruling results.

    Runs in ARQ worker process. Reads full_text from RulingCache,
    extracts relevant sections, batches for Claude, stores results
    back on each RulingCache row.

    Args:
        ctx: ARQ context (contains redis connection, etc.)
        gemeente_naam: Municipality name for analysis context
        ecli_list: List of ECLI identifiers to analyze

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

    try:
        async with session_factory() as session:
            # Fetch ruling texts from RulingCache
            stmt = select(RulingCache).where(
                RulingCache.ecli.in_(ecli_list),
                RulingCache.full_text.isnot(None),
            )
            result = await session.execute(stmt)
            rulings = result.scalars().all()

            if not rulings:
                logger.warning(
                    "No rulings with text found for %s (%d ECLIs)",
                    gemeente_naam,
                    len(ecli_list),
                )
                return {"status": "failed", "error": "No ruling texts available"}

            logger.info(
                "Starting ruling analysis for %s (%d rulings)",
                gemeente_naam,
                len(rulings),
            )

            # Build ruling dicts for Claude
            ruling_dicts = []
            ruling_map: dict[str, RulingCache] = {}
            for r in rulings:
                ruling_map[r.ecli] = r
                ruling_dicts.append({
                    "ecli": r.ecli,
                    "instantie": r.instantie or "",
                    "datum_uitspraak": r.datum_uitspraak or "",
                    "text": r.full_text or "",
                })

            # Process in batches of BATCH_SIZE
            claude_client = ClaudeClient(api_key=settings.ANTHROPIC_API_KEY)
            analyzed_count = 0

            for i in range(0, len(ruling_dicts), BATCH_SIZE):
                batch = ruling_dicts[i : i + BATCH_SIZE]

                try:
                    analysis_result = await claude_client.analyze_jurisprudence(
                        batch, gemeente_naam
                    )
                except AIParsingError as e:
                    logger.error(
                        "Claude analysis failed for batch %d-%d of %s: %s",
                        i,
                        i + len(batch),
                        gemeente_naam,
                        e.message,
                    )
                    continue

                # Store per-ruling results on RulingCache rows
                for ra in analysis_result.ruling_analyses:
                    ruling = ruling_map.get(ra.ecli)
                    if not ruling:
                        logger.warning(
                            "ECLI %s from Claude response not found in batch",
                            ra.ecli,
                        )
                        continue

                    # Store AI analysis as JSONB
                    ruling.ai_analysis = ra.model_dump()
                    ruling.vergunningstype = ra.vergunningstype
                    ruling.ai_analyzed_at = datetime.utcnow()

                    # Extract filing date and compute doorlooptijd
                    if ruling.full_text:
                        filing_date = extract_filing_date(ruling.full_text)
                        if filing_date:
                            ruling.datum_indiening = filing_date
                            if ruling.datum_uitspraak:
                                ruling.doorlooptijd_dagen = compute_doorlooptijd(
                                    ruling.datum_uitspraak, filing_date
                                )

                    session.add(ruling)
                    analyzed_count += 1

                await session.flush()
                await session.commit()

                logger.info(
                    "Processed batch %d-%d for %s (%d analyzed)",
                    i,
                    i + len(batch),
                    gemeente_naam,
                    analyzed_count,
                )

            logger.info(
                "Completed ruling analysis for %s: %d/%d analyzed",
                gemeente_naam,
                analyzed_count,
                len(rulings),
            )
            return {
                "status": "completed",
                "gemeente_naam": gemeente_naam,
                "analyzed_count": analyzed_count,
            }

    except Exception as e:
        logger.exception(
            "Unexpected error in ruling_analysis_job for %s: %s",
            gemeente_naam,
            e,
        )
        return {"status": "error", "error": str(e)}
    finally:
        await engine.dispose()
