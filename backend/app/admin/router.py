"""Admin API router for superuser-only endpoints."""

import logging
import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.eval_service import analyze_failing_prompts, evaluate_conversations
from app.auth.dependencies import get_current_superuser
from app.core.database import get_db
from app.models.ai_usage_log import AIUsageLog
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/ai-usage")
async def get_ai_usage(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    call_site: str | None = None,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    List AI usage log entries. Superuser-only.

    Args:
        skip: Number of records to skip for pagination.
        limit: Maximum number of records to return.
        call_site: Optional filter by call site name.
        current_user: Authenticated superuser (injected by dependency).
        db: Database session.

    Returns:
        List of AI usage log entries as dicts.
    """
    stmt = select(AIUsageLog).order_by(AIUsageLog.created_at.desc())

    if call_site is not None:
        stmt = stmt.where(AIUsageLog.call_site == call_site)

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return [
        {
            "id": str(log.id),
            "call_site": log.call_site,
            "model": log.model,
            "input_tokens": log.input_tokens,
            "output_tokens": log.output_tokens,
            "total_tokens": log.total_tokens,
            "estimated_cost_usd": float(log.estimated_cost_usd) if log.estimated_cost_usd is not None else None,
            "user_id": str(log.user_id) if log.user_id else None,
            "organization_id": str(log.organization_id) if log.organization_id else None,
            "duration_ms": log.duration_ms,
            "error": log.error,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.get("/ai-usage/summary")
async def get_ai_usage_summary(
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Aggregated AI usage cost data for the admin dashboard.

    Returns cost_by_day (last 30 days), cost_by_call_site, and cost_by_user.
    Superuser-only.
    """
    thirty_days_ago = date.today() - timedelta(days=30)

    # cost_by_day: GROUP BY date, last 30 days
    day_stmt = (
        select(
            cast(AIUsageLog.created_at, Date).label("date"),
            func.sum(AIUsageLog.estimated_cost_usd).label("total_cost"),
            func.count().label("total_calls"),
        )
        .where(cast(AIUsageLog.created_at, Date) >= thirty_days_ago)
        .group_by(cast(AIUsageLog.created_at, Date))
        .order_by(cast(AIUsageLog.created_at, Date))
    )
    day_result = await db.execute(day_stmt)
    cost_by_day = [
        {
            "date": str(row.date),
            "total_cost": float(row.total_cost),
            "total_calls": row.total_calls,
        }
        for row in day_result.all()
    ]

    # cost_by_call_site: GROUP BY call_site
    site_stmt = (
        select(
            AIUsageLog.call_site,
            func.sum(AIUsageLog.estimated_cost_usd).label("total_cost"),
            func.count().label("total_calls"),
        )
        .group_by(AIUsageLog.call_site)
        .order_by(func.sum(AIUsageLog.estimated_cost_usd).desc())
    )
    site_result = await db.execute(site_stmt)
    cost_by_call_site = [
        {
            "call_site": row.call_site,
            "total_cost": float(row.total_cost),
            "total_calls": row.total_calls,
        }
        for row in site_result.all()
    ]

    # cost_by_user: GROUP BY user_id with User join for email
    user_stmt = (
        select(
            AIUsageLog.user_id,
            User.email,
            func.sum(AIUsageLog.estimated_cost_usd).label("total_cost"),
            func.count().label("total_calls"),
        )
        .outerjoin(User, AIUsageLog.user_id == User.id)
        .where(AIUsageLog.user_id.is_not(None))
        .group_by(AIUsageLog.user_id, User.email)
        .order_by(func.sum(AIUsageLog.estimated_cost_usd).desc())
    )
    user_result = await db.execute(user_stmt)
    cost_by_user = [
        {
            "user_id": str(row.user_id),
            "email": row.email,
            "total_cost": float(row.total_cost),
            "total_calls": row.total_calls,
        }
        for row in user_result.all()
    ]

    return {
        "cost_by_day": cost_by_day,
        "cost_by_call_site": cost_by_call_site,
        "cost_by_user": cost_by_user,
    }


@router.get("/chat-conversations")
async def get_chat_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    user_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    List chat conversations with optional filters. Superuser-only.

    Args:
        skip: Number of records to skip for pagination.
        limit: Maximum number of records to return.
        user_id: Optional filter by user UUID.
        date_from: Optional filter — conversations started on or after this date.
        date_to: Optional filter — conversations started on or before this date.
        current_user: Authenticated superuser (injected by dependency).
        db: Database session.

    Returns:
        Paginated list of conversations ordered by last_message_at desc.
    """
    stmt = select(ChatConversation).order_by(ChatConversation.last_message_at.desc())

    if user_id is not None:
        stmt = stmt.where(ChatConversation.user_id == user_id)
    if date_from is not None:
        stmt = stmt.where(cast(ChatConversation.started_at, Date) >= date_from)
    if date_to is not None:
        stmt = stmt.where(cast(ChatConversation.started_at, Date) <= date_to)

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    conversations = result.scalars().all()

    return [
        {
            "id": str(conv.id),
            "user_id": str(conv.user_id) if conv.user_id else None,
            "started_at": conv.started_at.isoformat() if conv.started_at else None,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "message_count": conv.message_count,
            "metadata": conv.metadata_,
        }
        for conv in conversations
    ]


@router.get("/chat-conversations/{conversation_id}/messages")
async def get_chat_conversation_messages(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    List all messages for a specific conversation. Superuser-only.

    Args:
        conversation_id: UUID of the conversation.
        current_user: Authenticated superuser (injected by dependency).
        db: Database session.

    Returns:
        All messages for the conversation ordered by created_at asc.

    Raises:
        HTTPException 404: Conversation not found.
    """
    # Verify conversation exists
    conv_result = await db.execute(
        select(ChatConversation).where(ChatConversation.id == conversation_id)
    )
    conversation = conv_result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()

    return [
        {
            "id": str(msg.id),
            "conversation_id": str(msg.conversation_id),
            "role": msg.role,
            "content": msg.content,
            "intent": msg.intent,
            "params": msg.params,
            "response_data": msg.response_data,
            "tokens_used": msg.tokens_used,
            "duration_ms": msg.duration_ms,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        }
        for msg in messages
    ]


# ── DeepEval evaluation endpoints ───────────────────────────────────


@router.post("/eval-chats")
async def eval_chats(
    days_back: int = Query(7, ge=0, le=365),
    limit: int = Query(20, ge=0, le=50),
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Trigger DeepEval evaluation on recent chat conversations.

    Runs ConversationCompleteness, TurnRelevancy, and RoleAdherence
    metrics against conversations from the last `days_back` days.
    Superuser-only.

    Args:
        days_back: Number of days to look back (default 7, max 365).
        limit: Maximum conversations to evaluate (default 20, max 50).
        current_user: Authenticated superuser.
        db: Database session.

    Returns:
        Summary with total, passed, failed, errors, and per-conversation results.
    """
    logger.info(
        "Superuser %s triggered eval-chats: days_back=%d, limit=%d",
        current_user.email,
        days_back,
        limit,
    )
    try:
        results = await evaluate_conversations(db, days_back=days_back, limit=limit)
    except Exception:
        logger.exception("eval-chats failed")
        raise HTTPException(status_code=500, detail="Evaluation failed") from None
    return results


@router.get("/eval-results")
async def get_eval_results(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """
    Return conversations that have DeepEval evaluation scores.

    Filters to conversations where metadata_ contains 'eval_scores'.
    Paginated, superuser-only.
    """
    stmt = (
        select(ChatConversation)
        .where(ChatConversation.metadata_.has_key("eval_scores"))
        .order_by(ChatConversation.last_message_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    conversations = result.scalars().all()

    return [
        {
            "id": str(conv.id),
            "user_id": str(conv.user_id) if conv.user_id else None,
            "started_at": conv.started_at.isoformat() if conv.started_at else None,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "message_count": conv.message_count,
            "eval_scores": conv.metadata_.get("eval_scores") if conv.metadata_ else None,
            "eval_pass": conv.metadata_.get("eval_pass") if conv.metadata_ else None,
            "eval_at": conv.metadata_.get("eval_at") if conv.metadata_ else None,
        }
        for conv in conversations
    ]


# ── Prompt improvement endpoint ──────────────────────────────────────


@router.post("/improve-prompts")
async def improve_prompts(
    limit: int = Query(10, ge=1, le=20),
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Analyze failing conversations and suggest prompt improvements.

    Uses Claude to analyze conversations where eval_pass=false and generate
    concrete improvement suggestions for the CHAT_INTENT_CLASSIFIER_PROMPT.
    Superuser-only.

    Args:
        limit: Maximum failing conversations to analyze (default 10, max 20).
        current_user: Authenticated superuser.
        db: Database session.

    Returns:
        Dict with suggestions, analyzed_count, and prompt_analyzed.
    """
    logger.info(
        "Superuser %s triggered improve-prompts: limit=%d",
        current_user.email,
        limit,
    )
    try:
        results = await analyze_failing_prompts(db, limit=limit)
    except Exception:
        logger.exception("improve-prompts failed")
        raise HTTPException(status_code=500, detail="Prompt improvement analysis failed") from None
    return results


@router.post("/cascade-backfill")
async def run_cascade_backfill(
    gemeente: str = Query("GM0983", description="Gemeente code, e.g. GM0983"),
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Recompute score_breakdown for all scan_results in a gemeente using cached woonvisie payload.

    Zero Claude calls — reads payload from factor_extraction_cache and applies to all parcels.
    Superuser-only.
    """
    import uuid as _uuid
    from dataclasses import asdict

    from sqlalchemy import func
    from sqlalchemy.ext.asyncio import AsyncSession as _AS

    from app.ai.factors.woonvisie_match import WoonvisiePayload
    from app.models.area_scan import AreaScan
    from app.models.factor_extraction_cache import FactorExtractionCache
    from app.models.parcel_cache import ParcelCache
    from app.models.policy_document import PolicyDocument
    from app.models.scan_result import ScanResult
    from app.services.score_v3 import compute_score_v3

    logger.info("Admin %s triggered cascade-backfill gemeente=%s", current_user.email, gemeente)

    # 1. Load woonvisie document
    doc_stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "gemeente",
            PolicyDocument.entity_code == gemeente,
            PolicyDocument.source_key == "woonvisie",
            PolicyDocument.organization_id == current_user.organization_id,
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(PolicyDocument.version_number.desc())
        .limit(1)
    )
    doc = (await db.execute(doc_stmt)).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail=f"No woonvisie document found for {gemeente}")

    # 2. Get one cached payload (gemeente-level doc → same payload for all parcels)
    cache_stmt = (
        select(FactorExtractionCache)
        .where(
            FactorExtractionCache.policy_document_id == doc.id,
            FactorExtractionCache.factor_id == "woonvisie_match",
        )
        .limit(1)
    )
    cached = (await db.execute(cache_stmt)).scalar_one_or_none()
    if cached is None:
        raise HTTPException(status_code=404, detail="No cached woonvisie extraction found — upload and process document first")

    try:
        payload = WoonvisiePayload.model_validate(cached.extracted_payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse cached payload: {exc}") from exc

    cascade_payloads = {"woonvisie_match": payload}

    # 3. Batch update all scan_results for this gemeente
    updated = 0
    last_id: _uuid.UUID | None = None
    batch_size = 200

    while True:
        stmt = (
            select(
                ScanResult,
                ParcelCache,
                AreaScan.wijk_naam,
                func.ST_Perimeter(ParcelCache.geometry).label("perimeter_m"),
            )
            .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
            .join(AreaScan, AreaScan.id == ScanResult.scan_id)
            .where(ParcelCache.gemeente_code == gemeente)
            .order_by(ScanResult.id)
            .limit(batch_size)
        )
        if last_id is not None:
            stmt = stmt.where(ScanResult.id > last_id)

        rows = (await db.execute(stmt)).all()
        if not rows:
            break

        unique_scan_ids = {sr.scan_id for sr, _pc, _wn, _pm in rows}
        nbhd_rows = (await db.execute(
            select(AreaScan.id, AreaScan.neighborhood_metrics)
            .where(AreaScan.id.in_(unique_scan_ids))
        )).all()
        nbhd_map = {row[0]: row[1] for row in nbhd_rows if row[1] is not None}

        for sr, pc, wijk_naam, perimeter_m in rows:
            flags = dict(sr.flags) if sr.flags else {}
            parcel_data: dict = {
                "parcel_id": str(pc.parcel_id),
                "area_m2": pc.area_m2,
                "perimeter_m": float(perimeter_m) if perimeter_m is not None else None,
                "has_pand": pc.has_pand,
                "bouwjaar": pc.bouwjaar,
                "pand_status": pc.pand_status,
                "bestemmingen": pc.bestemmingen,
                "wijk_naam": wijk_naam,
                "vacancy_signal": flags.get("vacancy_signal"),
                "building_metrics": flags.get("building_metrics", {}),
                "market_signals": flags.get("market_signals"),
                "bodem": flags.get("bodem"),
                "bodemtype": flags.get("bodemtype"),
                "funderingsrisico": flags.get("funderingsrisico"),
                "energielabel": flags.get("energielabel"),
                "vergunningen": flags.get("vergunningen"),
                "natura2000": flags.get("natura2000"),
                "overstromingsrisico": flags.get("overstromingsrisico"),
                "geluid": flags.get("geluid"),
                "luchtkwaliteit": flags.get("luchtkwaliteit"),
                "woz": flags.get("woz"),
                "rijksmonument": flags.get("rijksmonument"),
            }
            v3_result = compute_score_v3(
                parcel_data, nbhd_map.get(sr.scan_id),
                project_type="onbepaald", cascade_payloads=cascade_payloads,
            )
            overall_clamped = max(0.0, min(100.0, v3_result.overall))
            flags["scores"] = {"potentie": v3_result.potentie_score, "risico": v3_result.risico_score, "overall": v3_result.overall}
            flags["score_breakdown"] = {name: asdict(f) for name, f in v3_result.score_breakdown.items()}
            flags["score_model_version"] = "score-v3.0"
            flags["category"] = v3_result.category
            sr.score = overall_clamped
            sr.flags = flags
            db.add(sr)
            updated += 1

        await db.flush()
        await db.commit()
        last_id = rows[-1][0].id

    logger.info("cascade-backfill complete: gemeente=%s updated=%d", gemeente, updated)
    return {"gemeente": gemeente, "updated": updated}


@router.delete("/cache/kadaster")
async def clear_kadaster_cache(
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
):
    """Clear all cached kadaster parcel responses. Forces fresh PDOK lookups."""
    from sqlalchemy import text as sql_text

    result = await db.execute(
        sql_text("DELETE FROM cached_api_responses WHERE cache_key LIKE 'kadaster:parcel:%'")
    )
    await db.commit()
    count = result.rowcount
    logger.info("Admin %s cleared %d kadaster cache entries", current_user.email, count)
    return {"deleted": count}
