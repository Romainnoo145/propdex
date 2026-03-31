"""Verkenner chat service: intent classification + handler dispatch."""

import json
import logging
import time
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.bulk_query_service import execute_bulk_query, resolve_gemeente_code
from app.agents.chat_schemas import (
    ChatRequest,
    ChatResponse,
    FavoriteSummary,
    ParcelDetailSummary,
    ReportSummary,
)
from app.agents.schemas import ParsedQuery
from app.ai.claude_client import AIParsingError, create_chat_claude_client
from app.ai.prompts import CHAT_INTENT_CLASSIFIER_PROMPT
from app.models.parcel_cache import ParcelCache
from app.models.parcel_favorite import ParcelFavorite
from app.models.report import SavedReport

logger = logging.getLogger(__name__)

# Count threshold — if a parcel search returns more than this, suggest refinement
COUNT_THRESHOLD = 2000

# Valid intents from the classifier
VALID_INTENTS = {"PARCEL_SEARCH", "PARCEL_DETAIL", "MY_FAVORITES", "MY_REPORTS", "UNSUPPORTED"}


# ── JSON extraction helper ───────────────────────────────────────────────

def _strip_code_fences(text: str) -> str:
    """Strip markdown code fences from Claude response text."""
    s = text.strip()
    if s.startswith("```json"):
        s = s[7:]
    if s.startswith("```"):
        s = s[3:]
    if s.endswith("```"):
        s = s[:-3]
    return s.strip()


# ── Intent classifier ────────────────────────────────────────────────────

async def classify_intent(
    message: str,
    previous_intent: str | None = None,
    previous_params: dict[str, Any] | None = None,
) -> tuple[str, dict[str, Any]]:
    """Classify a user message into an intent with structured params.

    Returns:
        (intent, params) — intent is one of VALID_INTENTS, params is a dict.
    Raises:
        AIParsingError on Claude or JSON failures.
    """
    t0 = time.monotonic()

    # Build user message with optional refinement context
    user_content = message
    if previous_intent and previous_params:
        ctx = json.dumps(previous_params, ensure_ascii=False)
        user_content = (
            f"{message}\n\n"
            f"(vorige: {previous_intent}, params: {ctx})"
        )

    client = create_chat_claude_client()
    response = await client.client.messages.create(
        model=client.model,
        max_tokens=300,
        system=CHAT_INTENT_CLASSIFIER_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    if not response.content:
        raise AIParsingError("Claude returned empty response", retriable=True)

    text_content = None
    for block in response.content:
        if block.type == "text":
            text_content = block.text
            break

    if not text_content:
        raise AIParsingError("No text content in Claude response", retriable=True)

    json_text = _strip_code_fences(text_content)

    try:
        data = json.loads(json_text)
    except json.JSONDecodeError as e:
        logger.error("Classifier returned invalid JSON: %s — raw: %s", e, json_text[:200])
        raise AIParsingError(f"Classifier returned invalid JSON: {e}", retriable=False) from e

    intent = data.get("intent", "UNSUPPORTED")
    params = data.get("params", {})

    # Validate intent
    if intent not in VALID_INTENTS:
        logger.warning("Classifier returned unknown intent '%s', falling back to UNSUPPORTED", intent)
        intent = "UNSUPPORTED"
        params = {"reason": f"Onbekende intent: {intent}"}

    elapsed = time.monotonic() - t0
    logger.info("Intent classified (%.1fs): %s → %s, params=%s", elapsed, message[:60], intent, params)

    return intent, params


# ── Refinement suggestions ───────────────────────────────────────────────

def _build_suggestions(parsed: ParsedQuery) -> list[str]:
    """Generate refinement suggestions based on which filters are missing."""
    suggestions: list[str] = []
    present = parsed.model_dump(exclude_none=True)

    if "municipality" not in present:
        suggestions.append("Filter op gemeente, bijv. 'in Venlo'")
    if "wijk" not in present and "municipality" in present:
        suggestions.append("Filter op wijk, bijv. 'in Blerick'")
    if "build_year_min" not in present and "build_year_max" not in present:
        suggestions.append("Voeg een bouwjaarfilter toe, bijv. 'voor 1980' of 'na 2000'")
    if "area_min" not in present and "area_max" not in present:
        suggestions.append("Filter op oppervlakte, bijv. 'groter dan 200m²'")
    if "bestemming" not in present and "bestemming_exclude" not in present:
        suggestions.append("Filter op bestemming, bijv. 'bedrijfspanden' of 'niet wonen'")

    # Always offer the escape hatch
    if not suggestions:
        suggestions.append("Zeg 'toon resultaten' om alle resultaten te laden")

    return suggestions[:3]  # max 3 suggestions


# ── PARCEL_SEARCH handler ────────────────────────────────────────────────

async def handle_parcel_search(
    params: dict[str, Any],
    db: AsyncSession,
    user_id: str,
    *,
    force_results: bool = False,
    query_text: str = "",
) -> ChatResponse:
    """Handle PARCEL_SEARCH intent: count-first with optional refinement."""

    # Build ParsedQuery from classifier params (only known fields)
    parsed_fields = {}
    for key in ParsedQuery.model_fields:
        if key in params and params[key] is not None:
            parsed_fields[key] = params[key]

    if not parsed_fields:
        return ChatResponse(
            intent="UNSUPPORTED",
            params=params,
            message="Geef ten minste één filter op — bijv. een gemeente, bouwjaar of bestemming.",
        )

    parsed = ParsedQuery(**parsed_fields)

    # Resolve gemeente code if municipality name given
    if parsed.municipality:
        code = await resolve_gemeente_code(parsed.municipality, db)
        if not code:
            return ChatResponse(
                intent="UNSUPPORTED",
                params=params,
                message=f"Gemeente '{parsed.municipality}' niet gevonden in de database. Controleer de spelling.",
            )

    # Run count query
    count_q, base_q, filters_applied = await _build_count_query(parsed, db)
    total = (await db.execute(count_q)).scalar_one()

    # Early check: if wijk is set but no results, return helpful message
    if total == 0 and parsed.wijk:
        return ChatResponse(
            intent="PARCEL_SEARCH",
            params=parsed.model_dump(exclude_none=True),
            count=0,
            message=f"Wijk '{parsed.wijk}' niet gevonden in gescande data. Controleer de spelling of scan eerst deze wijk.",
        )

    # Count-first: if above threshold and not forced, return preview
    if total > COUNT_THRESHOLD and not force_results:
        return ChatResponse(
            intent="COUNT_PREVIEW",
            params=parsed.model_dump(exclude_none=True),
            count=total,
            suggestions=_build_suggestions(parsed),
            message=f"{total:,.0f} resultaten gevonden. Wil je de zoekopdracht verfijnen?".replace(",", "."),
        )

    # Execute full query and persist
    results, total = await execute_bulk_query(parsed, db)

    # Persist BulkQuery record so /resultaten?query_id= can fetch it
    import uuid as _uuid

    from app.models.bulk_query import BulkQuery

    record = BulkQuery(
        user_id=_uuid.UUID(user_id),
        query_text=query_text or str(parsed.model_dump(exclude_none=True)),
        parsed_query=parsed.model_dump(),
        result_count=total,
        status="completed",
        results=[r.model_dump() for r in results],
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return ChatResponse(
        intent="PARCEL_SEARCH",
        params=parsed.model_dump(exclude_none=True),
        data=[r.model_dump() for r in results],
        count=total,
        query_id=str(record.id),
    )


async def _build_count_query(parsed: ParsedQuery, db: AsyncSession):
    """Build a COUNT-only query from parsed filters. Returns (count_select, base_select, n_filters)."""
    import json as _json

    from sqlalchemy import func as sqlfunc
    from sqlalchemy import literal
    from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB

    count_q = select(sqlfunc.count()).select_from(ParcelCache)
    filters = []
    n_filters = 0

    if parsed.municipality:
        code = await resolve_gemeente_code(parsed.municipality, db)
        if code:
            filters.append(ParcelCache.gemeente_code == code)
            n_filters += 1

    if parsed.build_year_min is not None:
        filters.append(ParcelCache.bouwjaar >= parsed.build_year_min)
        n_filters += 1
    if parsed.build_year_max is not None:
        filters.append(ParcelCache.bouwjaar <= parsed.build_year_max)
        n_filters += 1
    if parsed.area_min is not None:
        filters.append(ParcelCache.area_m2 >= parsed.area_min)
        n_filters += 1
    if parsed.area_max is not None:
        filters.append(ParcelCache.area_m2 <= parsed.area_max)
        n_filters += 1
    if parsed.bestemming:
        target = _json.dumps([{"type": parsed.bestemming.lower()}])
        filters.append(
            ParcelCache.bestemmingen.op("@>")(func.cast(literal(target), PG_JSONB))
        )
        n_filters += 1
    if parsed.bestemming_exclude:
        target = _json.dumps([{"type": parsed.bestemming_exclude.lower()}])
        filters.append(
            ~ParcelCache.bestemmingen.op("@>")(func.cast(literal(target), PG_JSONB))
        )
        n_filters += 1
    if parsed.pand_status:
        filters.append(ParcelCache.pand_status == parsed.pand_status)
        n_filters += 1

    # Wijk filter: join through ScanResult→AreaScan
    if parsed.wijk:
        from app.models.area_scan import AreaScan
        from app.models.scan_result import ScanResult

        count_q = count_q.join(ScanResult, ScanResult.parcel_id == ParcelCache.id)
        count_q = count_q.join(AreaScan, AreaScan.id == ScanResult.scan_id)
        count_q = count_q.where(sqlfunc.lower(AreaScan.wijk_naam).contains(parsed.wijk.lower()))
        n_filters += 1

    for f in filters:
        count_q = count_q.where(f)

    return count_q, None, n_filters


# ── PARCEL_DETAIL handler ────────────────────────────────────────────────

async def handle_parcel_detail(
    params: dict[str, Any],
    db: AsyncSession,
) -> ChatResponse:
    """Handle PARCEL_DETAIL: resolve address → return cached parcel data."""
    address = params.get("address")
    if not address:
        return ChatResponse(
            intent="UNSUPPORTED",
            params=params,
            message="Geen adres opgegeven. Geef een straatnaam en huisnummer op.",
        )

    # Strategy 1: ILIKE search on parcel_cache.address
    result = await db.execute(
        select(ParcelCache)
        .where(ParcelCache.address.ilike(f"%{address}%"))
        .order_by(ParcelCache.address)
        .limit(1)
    )
    parcel = result.scalar_one_or_none()

    if parcel is None:
        # Strategy 2: Try partial match on individual address components
        # Split "Leutherweg 139, Venlo" into parts and search
        parts = [p.strip() for p in address.replace(",", " ").split() if len(p.strip()) > 2]
        if len(parts) >= 2:
            # Search for rows matching all significant parts
            query = select(ParcelCache)
            for part in parts[:3]:  # max 3 terms to avoid over-filtering
                query = query.where(ParcelCache.address.ilike(f"%{part}%"))
            result = await db.execute(query.order_by(ParcelCache.address).limit(1))
            parcel = result.scalar_one_or_none()

    if parcel is None:
        return ChatResponse(
            intent="PARCEL_DETAIL",
            params=params,
            message=f"Geen perceel gevonden voor '{address}'. Het adres moet voorkomen in een eerder gescande wijk.",
        )

    # Check if user has a report for this parcel
    # (We don't have user_id here — that's injected by the router. Skip report lookup for now.)
    summary = ParcelDetailSummary(
        parcel_id=parcel.parcel_id,
        parcel_code=parcel.parcel_code,
        address=parcel.address,
        municipality=None,  # gemeente_code available, not name
        gemeente_code=parcel.gemeente_code,
        bouwjaar=parcel.bouwjaar,
        area_m2=parcel.area_m2,
        bestemming=(
            parcel.bestemmingen[0].get("naam") or parcel.bestemmingen[0].get("type")
            if parcel.bestemmingen and len(parcel.bestemmingen) > 0
            and isinstance(parcel.bestemmingen[0], dict)
            else None
        ),
        pand_status=parcel.pand_status,
    )

    # Try to get WOZ/energielabel from enrichment_data if cached
    ed = parcel.enrichment_data or {}
    if "woz" in ed and ed["woz"]:
        woz_data = ed["woz"]
        if isinstance(woz_data, dict) and "woz_waarde" in woz_data:
            summary.woz_waarde = woz_data["woz_waarde"]
    if "energy_label" in ed and ed["energy_label"]:
        el_data = ed["energy_label"]
        if isinstance(el_data, dict) and "label" in el_data:
            summary.energielabel = el_data["label"]

    return ChatResponse(
        intent="PARCEL_DETAIL",
        params=params,
        data=summary.model_dump(),
    )


# ── MY_FAVORITES handler ────────────────────────────────────────────────

async def handle_my_favorites(
    params: dict[str, Any],
    db: AsyncSession,
    user_id: str,
) -> ChatResponse:
    """Handle MY_FAVORITES: query user's pipeline with optional filters."""
    import uuid as _uuid

    query = select(ParcelFavorite).where(
        ParcelFavorite.user_id == _uuid.UUID(user_id)
    )

    stage = params.get("stage")
    if stage:
        query = query.where(ParcelFavorite.pipeline_stage == stage)

    gemeente = params.get("gemeente")
    if gemeente:
        query = query.where(ParcelFavorite.gemeente_naam.ilike(f"%{gemeente}%"))

    query = query.order_by(ParcelFavorite.created_at.desc()).limit(50)

    result = await db.execute(query)
    rows = result.scalars().all()

    favorites = [
        FavoriteSummary(
            parcel_id=f.parcel_id,
            address=f.address,
            gemeente_naam=f.gemeente_naam,
            wijk_naam=f.wijk_naam,
            pipeline_stage=f.pipeline_stage,
        ).model_dump()
        for f in rows
    ]

    msg = None
    if not rows:
        if stage:
            msg = f"Geen opgeslagen percelen gevonden met status '{stage}'."
        elif gemeente:
            msg = f"Geen opgeslagen percelen gevonden in {gemeente}."
        else:
            msg = "Je hebt nog geen percelen opgeslagen."

    return ChatResponse(
        intent="MY_FAVORITES",
        params=params,
        data=favorites,
        count=len(favorites),
        message=msg,
    )


# ── MY_REPORTS handler ──────────────────────────────────────────────────

async def handle_my_reports(
    params: dict[str, Any],
    db: AsyncSession,
    user_id: str,
) -> ChatResponse:
    """Handle MY_REPORTS: query user's saved reports with optional sorting/ranking."""
    import uuid as _uuid

    query = (
        select(SavedReport)
        .where(
            SavedReport.user_id == _uuid.UUID(user_id),
            SavedReport.deleted_at.is_(None),
        )
    )

    city = params.get("city")
    if city:
        query = query.where(SavedReport.city.ilike(f"%{city}%"))

    query = query.order_by(SavedReport.created_at.desc()).limit(50)

    result = await db.execute(query)
    rows = result.scalars().all()

    reports = []
    for r in rows:
        rd = r.report_data or {}
        scores = rd.get("scores_v3") or {}
        building = rd.get("building") or {}
        zoning = rd.get("zoning") or {}
        energy = rd.get("energy_label") or {}
        asbest = rd.get("asbest_indicator") or {}
        frp = rd.get("fysiek_risico_profiel") or {}
        monuments = rd.get("monuments") or {}
        gebruiksdoel_raw = building.get("gebruiksdoel")
        if isinstance(gebruiksdoel_raw, list):
            gebruiksdoel = ", ".join(gebruiksdoel_raw)
        else:
            gebruiksdoel = gebruiksdoel_raw

        reports.append(
            ReportSummary(
                id=str(r.id),
                report_name=r.report_name,
                city=r.city if r.city else None,
                created_at=r.created_at.isoformat(),
                potentie=scores.get("potentie"),
                risico=scores.get("risico"),
                bouwjaar=building.get("bouwjaar"),
                oppervlakte=building.get("oppervlakte"),
                gebruiksdoel=gebruiksdoel,
                bestemming=zoning.get("primary_bestemming"),
                energielabel=energy.get("energieklasse"),
                asbest_risk=asbest.get("risk"),
                fysiek_risk=frp.get("overall_risk"),
                is_monument=monuments.get("is_monument"),
            ).model_dump()
        )

    # Sort/rank if requested
    sort_by = params.get("sort_by")
    sort_order = params.get("sort_order", "desc")
    max_risico = params.get("max_risico")
    min_potentie = params.get("min_potentie")
    min_oppervlakte = params.get("min_oppervlakte")

    # Numeric filters
    if max_risico is not None and reports:
        reports = [r for r in reports if r.get("risico") is not None and r["risico"] <= max_risico]
    if min_potentie is not None and reports:
        reports = [r for r in reports if r.get("potentie") is not None and r["potentie"] >= min_potentie]
    if min_oppervlakte is not None and reports:
        reports = [r for r in reports if r.get("oppervlakte") is not None and r["oppervlakte"] >= min_oppervlakte]

    if sort_by and reports:
        sort_key_map = {
            "potentie": "potentie",
            "risico": "risico",
            "bouwjaar": "bouwjaar",
            "oppervlakte": "oppervlakte",
        }
        key = sort_key_map.get(sort_by)
        if key:
            reports.sort(
                key=lambda r: r.get(key) if r.get(key) is not None else -999,
                reverse=(sort_order == "desc"),
            )

    msg = None
    if not rows:
        if city:
            msg = f"Geen rapporten gevonden voor {city}."
        else:
            msg = "Je hebt nog geen rapporten gegenereerd."
    elif sort_by:
        label = {"potentie": "potentiescore", "risico": "risicoscore", "bouwjaar": "bouwjaar", "oppervlakte": "oppervlakte"}.get(sort_by, sort_by)
        direction = "hoogste" if sort_order == "desc" else "laagste"
        top = reports[0]
        filters = []
        if max_risico is not None:
            filters.append(f"risico ≤ {max_risico}")
        if min_potentie is not None:
            filters.append(f"potentie ≥ {min_potentie}")
        if min_oppervlakte is not None:
            filters.append(f"oppervlakte ≥ {min_oppervlakte}m²")
        filter_str = f" ({', '.join(filters)})" if filters else ""
        msg = f"{len(reports)} rapporten{filter_str} gesorteerd op {direction} {label}. Top: {top.get('report_name')} ({label}: {top.get(sort_by, '?')})."
    elif max_risico is not None or min_potentie is not None or min_oppervlakte is not None:
        filters = []
        if max_risico is not None:
            filters.append(f"risico ≤ {max_risico}")
        if min_potentie is not None:
            filters.append(f"potentie ≥ {min_potentie}")
        if min_oppervlakte is not None:
            filters.append(f"oppervlakte ≥ {min_oppervlakte}m²")
        msg = f"{len(reports)} rapporten gevonden ({', '.join(filters)})." if reports else f"Geen rapporten gevonden ({', '.join(filters)})."

    return ChatResponse(
        intent="MY_REPORTS",
        params=params,
        data=reports,
        count=len(reports),
        message=msg,
    )


# ── Dispatcher ───────────────────────────────────────────────────────────

_RECOVERY_SUGGESTIONS = [
    "Zoek percelen in een gemeente",
    "Bekijk mijn opgeslagen percelen",
    "Laat mijn rapporten zien",
]


async def dispatch_chat(
    request: ChatRequest,
    db: AsyncSession,
    user_id: str,
) -> ChatResponse:
    """Classify intent and dispatch to the appropriate handler."""
    t0 = time.monotonic()

    # ── Deterministic forceResults bypass ─────────────────────────────
    # When the user clicks "Toon resultaten" after a COUNT_PREVIEW, skip
    # the classifier entirely and call handle_parcel_search directly.
    if (
        request.force_results
        and request.previous_intent == "COUNT_PREVIEW"
        and request.previous_params
    ):
        logger.info("forceResults bypass: skipping classifier, using previous params")
        try:
            response = await handle_parcel_search(
                request.previous_params, db, user_id,
                force_results=True,
                query_text=request.message,
            )
        except Exception as e:
            logger.exception("Handler error for forceResults bypass: %s", e)
            response = ChatResponse(
                intent="UNSUPPORTED",
                params=request.previous_params,
                message="Er ging iets mis. Probeer het opnieuw.",
                suggestions=_RECOVERY_SUGGESTIONS,
            )
        response.context_intent = "PARCEL_SEARCH"
        elapsed = time.monotonic() - t0
        logger.info("Chat dispatch (%.2fs): forceResults bypass → %s (count=%s)", elapsed, response.intent, response.count)
        return response

    # ── Classify intent ──────────────────────────────────────────────
    try:
        intent, params = await classify_intent(
            request.message,
            previous_intent=request.previous_intent,
            previous_params=request.previous_params,
        )
    except AIParsingError as e:
        logger.error("Intent classification failed: %s", e.message)
        return ChatResponse(
            intent="UNSUPPORTED",
            params={},
            message="Sorry, ik kon je vraag niet verwerken. Probeer het opnieuw of stel je vraag anders.",
            suggestions=_RECOVERY_SUGGESTIONS,
        )

    # ── Deterministic param merging on refinement ────────────────────
    # When the user refines a previous query and the classifier returns
    # the same intent, merge: keep old filters, override with new non-None.
    if request.previous_params and intent == request.previous_intent:
        params = {**request.previous_params, **{k: v for k, v in params.items() if v is not None}}

    # ── Dispatch to handler ──────────────────────────────────────────
    try:
        if intent == "PARCEL_SEARCH":
            response = await handle_parcel_search(
                params, db, user_id,
                force_results=request.force_results,
                query_text=request.message,
            )
        elif intent == "PARCEL_DETAIL":
            response = await handle_parcel_detail(params, db)
        elif intent == "MY_FAVORITES":
            response = await handle_my_favorites(params, db, user_id)
        elif intent == "MY_REPORTS":
            response = await handle_my_reports(params, db, user_id)
        elif intent == "UNSUPPORTED":
            response = ChatResponse(
                intent="UNSUPPORTED",
                params=params,
                message=params.get("reason", "Deze vraag kan niet worden beantwoord."),
            )
        else:
            response = ChatResponse(
                intent="UNSUPPORTED",
                params=params,
                message=f"Onbekende intent: {intent}",
            )
    except Exception as e:
        logger.exception("Handler error for intent %s: %s", intent, e)
        response = ChatResponse(
            intent="UNSUPPORTED",
            params=params,
            message="Er ging iets mis. Probeer het opnieuw.",
            suggestions=_RECOVERY_SUGGESTIONS,
        )

    # ── Normalize context_intent (never expose COUNT_PREVIEW) ────────
    response.context_intent = response.intent if response.intent != "COUNT_PREVIEW" else "PARCEL_SEARCH"

    elapsed = time.monotonic() - t0
    logger.info(
        "Chat dispatch (%.2fs): %s → %s (count=%s)",
        elapsed, intent, response.intent, response.count,
    )
    return response
