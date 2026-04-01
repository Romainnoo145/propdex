"""Per-ruling AI analysis background job for ARQ worker.

Fetches ruling texts from RulingCache, extracts relevant sections,
sends to Claude in batches of 5, and stores per-ruling results
(ai_analysis, vergunningstype, datum_indiening, doorlooptijd_dagen)
back on RulingCache rows.
"""

import json
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.ai.claude_client import AIParsingError, create_claude_client
from app.ai.prompts import RECHTSGROND_CLASSIFICATIE_PROMPT, TEGENSTANDER_EXTRACTIE_PROMPT
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
            claude_client = create_claude_client()
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
                    ruling.rechtsgronden = ra.rechtsgronden or []
                    ruling.tegenstanders = ra.tegenstanders or []
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


# Valid rechtsgrond values for filtering AI responses
VALID_RECHTSGRONDEN = {
    "procedurefout",
    "motiveringsgebrek",
    "gelijkheidsbeginsel",
    "disproportioneel",
    "etfal_ruimtelijke_ordening",
}

# Backfill batch size (rulings per Claude API call)
BACKFILL_BATCH_SIZE = 5


async def rechtsgrond_backfill_job(ctx: dict) -> dict:
    """Background job: Classify rechtsgronden for already-analyzed rulings.

    Queries rulings with ai_analysis but no rechtsgronden, sends a lightweight
    rechtsgrond-only prompt to Claude in batches, stores results.

    Args:
        ctx: ARQ context

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
            # Find rulings with AI analysis but no rechtsgronden
            stmt = select(RulingCache).where(
                RulingCache.ai_analysis.isnot(None),
                RulingCache.rechtsgronden.is_(None),
                RulingCache.full_text.isnot(None),
            )
            result = await session.execute(stmt)
            rulings = result.scalars().all()

            if not rulings:
                logger.info("No rulings need rechtsgrond backfill")
                return {"status": "completed", "backfilled_count": 0}

            logger.info(
                "Starting rechtsgrond backfill for %d rulings", len(rulings)
            )

            claude_client = create_claude_client()
            backfilled_count = 0

            for i in range(0, len(rulings), BACKFILL_BATCH_SIZE):
                batch = rulings[i : i + BACKFILL_BATCH_SIZE]

                # Build lightweight input: just ECLI + text excerpt
                batch_input = []
                ruling_map: dict[str, RulingCache] = {}
                for r in batch:
                    ruling_map[r.ecli] = r
                    # Use first 10k chars -- enough for rechtsgrond classification
                    text = (r.full_text or "")[:10000]
                    batch_input.append({
                        "ecli": r.ecli,
                        "text": text,
                    })

                user_message = json.dumps(batch_input, ensure_ascii=False)

                try:
                    import time as _time
                    _t0 = _time.monotonic()
                    response = await claude_client.client.messages.create(
                        model=claude_client.model,
                        max_tokens=1000,
                        system=RECHTSGROND_CLASSIFICATIE_PROMPT,
                        messages=[
                            {"role": "user", "content": user_message},
                        ],
                    )
                    _duration_ms = int((_time.monotonic() - _t0) * 1000)

                    # Fire-and-forget usage logging
                    from app.ai.usage_logger import log_ai_usage
                    await log_ai_usage(
                        call_site="rechtsgrond_classification",
                        model=claude_client.model,
                        usage=response.usage,
                        duration_ms=_duration_ms,
                        db=session,
                    )

                    # Extract text
                    text_content = None
                    for block in response.content:
                        if block.type == "text":
                            text_content = block.text
                            break

                    if not text_content:
                        logger.warning("Empty response for backfill batch %d", i)
                        continue

                    # Strip markdown fences
                    json_text = text_content.strip()
                    if json_text.startswith("```json"):
                        json_text = json_text[7:]
                    if json_text.startswith("```"):
                        json_text = json_text[3:]
                    if json_text.endswith("```"):
                        json_text = json_text[:-3]
                    json_text = json_text.strip()

                    classifications = json.loads(json_text)

                    for item in classifications:
                        ecli = item.get("ecli", "")
                        gronden = item.get("rechtsgronden", [])
                        # Filter to valid values only
                        valid = [g for g in gronden if g in VALID_RECHTSGRONDEN]

                        ruling = ruling_map.get(ecli)
                        if ruling and valid:
                            ruling.rechtsgronden = valid
                            session.add(ruling)
                            backfilled_count += 1

                    await session.flush()
                    await session.commit()

                    logger.info(
                        "Backfill batch %d-%d: %d classified",
                        i,
                        i + len(batch),
                        backfilled_count,
                    )

                except (AIParsingError, json.JSONDecodeError) as e:
                    logger.error("Backfill batch %d failed: %s", i, e)
                    continue
                except Exception as e:
                    logger.error("Unexpected error in backfill batch %d: %s", i, e)
                    continue

            logger.info(
                "Rechtsgrond backfill complete: %d/%d classified",
                backfilled_count,
                len(rulings),
            )
            return {
                "status": "completed",
                "backfilled_count": backfilled_count,
                "total": len(rulings),
            }

    except Exception as e:
        logger.exception("Unexpected error in rechtsgrond_backfill_job: %s", e)
        return {"status": "error", "error": str(e)}
    finally:
        await engine.dispose()


async def tegenstander_backfill_job(ctx: dict) -> dict:
    """Background job: Extract opponent organizations from already-analyzed rulings.

    Queries rulings with full_text but no tegenstanders, sends a lightweight
    extraction prompt to Claude in batches, stores results.
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
            stmt = select(RulingCache).where(
                RulingCache.tegenstanders.is_(None),
                RulingCache.full_text.isnot(None),
            )
            result = await session.execute(stmt)
            rulings = result.scalars().all()

            if not rulings:
                logger.info("No rulings need tegenstander backfill")
                return {"status": "completed", "backfilled_count": 0}

            logger.info(
                "Starting tegenstander backfill for %d rulings", len(rulings)
            )

            claude_client = create_claude_client()
            backfilled_count = 0

            for i in range(0, len(rulings), BACKFILL_BATCH_SIZE):
                batch = rulings[i : i + BACKFILL_BATCH_SIZE]

                batch_input = []
                ruling_map: dict[str, RulingCache] = {}
                for r in batch:
                    ruling_map[r.ecli] = r
                    text_excerpt = (r.full_text or "")[:10000]
                    batch_input.append({
                        "ecli": r.ecli,
                        "text": text_excerpt,
                    })

                user_message = json.dumps(batch_input, ensure_ascii=False)

                try:
                    import time as _time
                    _t0 = _time.monotonic()
                    response = await claude_client.client.messages.create(
                        model=claude_client.model,
                        max_tokens=1000,
                        system=TEGENSTANDER_EXTRACTIE_PROMPT,
                        messages=[
                            {"role": "user", "content": user_message},
                        ],
                    )
                    _duration_ms = int((_time.monotonic() - _t0) * 1000)

                    # Fire-and-forget usage logging
                    from app.ai.usage_logger import log_ai_usage
                    await log_ai_usage(
                        call_site="tegenstander_extraction",
                        model=claude_client.model,
                        usage=response.usage,
                        duration_ms=_duration_ms,
                        db=session,
                    )

                    text_content = None
                    for block in response.content:
                        if block.type == "text":
                            text_content = block.text
                            break

                    if not text_content:
                        logger.warning("Empty response for tegenstander batch %d", i)
                        continue

                    json_text = text_content.strip()
                    if json_text.startswith("```json"):
                        json_text = json_text[7:]
                    if json_text.startswith("```"):
                        json_text = json_text[3:]
                    if json_text.endswith("```"):
                        json_text = json_text[:-3]
                    json_text = json_text.strip()

                    extractions = json.loads(json_text)

                    for item in extractions:
                        ecli = item.get("ecli", "")
                        opponents = item.get("tegenstanders", [])

                        ruling = ruling_map.get(ecli)
                        if ruling:
                            ruling.tegenstanders = opponents
                            # Also update ai_analysis to include tegenstanders
                            if ruling.ai_analysis and isinstance(ruling.ai_analysis, dict):
                                updated = {**ruling.ai_analysis, "tegenstanders": opponents}
                                ruling.ai_analysis = updated
                            session.add(ruling)
                            backfilled_count += 1

                    await session.flush()
                    await session.commit()

                    logger.info(
                        "Tegenstander batch %d-%d: %d extracted",
                        i, i + len(batch), backfilled_count,
                    )

                except (AIParsingError, json.JSONDecodeError) as e:
                    logger.error("Tegenstander batch %d failed: %s", i, e)
                    continue
                except Exception as e:
                    logger.error("Unexpected error in tegenstander batch %d: %s", i, e)
                    continue

            logger.info(
                "Tegenstander backfill complete: %d/%d extracted",
                backfilled_count, len(rulings),
            )
            return {
                "status": "completed",
                "backfilled_count": backfilled_count,
                "total": len(rulings),
            }

    except Exception as e:
        logger.exception("Unexpected error in tegenstander_backfill_job: %s", e)
        return {"status": "error", "error": str(e)}
    finally:
        await engine.dispose()
