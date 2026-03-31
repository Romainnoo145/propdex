"""Bulk query service: NL text → structured filters → parcel_cache results."""

import json
import logging
import time

from sqlalchemy import func, literal, select
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.schemas import BulkResult, ParsedQuery
from app.ai.claude_client import AIParsingError, create_chat_claude_client
from app.ai.prompts import BULK_QUERY_PARSING_PROMPT
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult

logger = logging.getLogger(__name__)

# Module-level cache: lowercased gemeente name → gemeente_code
_gemeente_lookup: dict[str, str] | None = None


async def _build_gemeente_lookup(db: AsyncSession) -> dict[str, str]:
    """Build a gemeente name→code lookup from parcel_cache addresses.

    Extracts the city name from addresses (format: "Straat 123, 1234AB Stad")
    by taking the last token after the postcode. Cached per-process.
    """
    global _gemeente_lookup
    if _gemeente_lookup is not None:
        return _gemeente_lookup

    result = await db.execute(
        select(
            ParcelCache.gemeente_code,
            ParcelCache.address,
        )
        .where(ParcelCache.gemeente_code.isnot(None))
        .where(ParcelCache.address.isnot(None))
        .distinct(ParcelCache.gemeente_code)
    )
    rows = result.all()

    lookup: dict[str, str] = {}
    for code, address in rows:
        if not address or not code:
            continue
        # Address format: "Straatnaam 123, 1234AB Venlo"
        # Extract city: split on comma, take last part, strip postcode prefix
        parts = address.split(",")
        if len(parts) >= 2:
            city_part = parts[-1].strip()
            # Remove postcode (4 digits + 2 letters) prefix if present
            tokens = city_part.split()
            if len(tokens) >= 2:
                # Last token(s) are the city name
                city = " ".join(tokens[1:])  # skip postcode token
            else:
                city = city_part
        else:
            city = address.split()[-1] if address.split() else ""

        if city:
            lookup[city.lower()] = code

    _gemeente_lookup = lookup
    logger.info("Built gemeente lookup: %d entries", len(lookup))
    return lookup


async def resolve_gemeente_code(name: str, db: AsyncSession) -> str | None:
    """Resolve a gemeente name to its CBS code.

    Tries the cached lookup first, then falls back to an ILIKE search on
    the address column for gemeenten not yet in the cache.
    """
    lookup = await _build_gemeente_lookup(db)
    code = lookup.get(name.lower())
    if code:
        return code

    # Fallback: ILIKE search on address column
    result = await db.execute(
        select(ParcelCache.gemeente_code)
        .where(ParcelCache.address.ilike(f"%{name}%"))
        .where(ParcelCache.gemeente_code.isnot(None))
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row:
        # Cache for future calls
        lookup[name.lower()] = row
        logger.info("Gemeente '%s' resolved via ILIKE fallback → %s", name, row)
    return row


async def parse_nl_query(query_text: str) -> tuple[ParsedQuery | None, str | None]:
    """Parse a natural-language query into structured filters via Claude.

    Returns:
        (ParsedQuery, None) on success
        (None, reason) when the query is unsupported
    Raises:
        AIParsingError on Claude or JSON parsing failures
    """
    logger.info("Parsing bulk query: %s", query_text[:100])
    t0 = time.monotonic()

    try:
        client = create_chat_claude_client()
        response = await client.client.messages.create(
            model=client.model,
            max_tokens=500,
            system=BULK_QUERY_PARSING_PROMPT,
            messages=[{"role": "user", "content": query_text}],
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

        # Strip markdown code fences
        json_text = text_content.strip()
        if json_text.startswith("```json"):
            json_text = json_text[7:]
        if json_text.startswith("```"):
            json_text = json_text[3:]
        if json_text.endswith("```"):
            json_text = json_text[:-3]
        json_text = json_text.strip()

        data = json.loads(json_text)

        elapsed = time.monotonic() - t0

        # Check for unsupported signal
        if data.get("unsupported"):
            reason = data.get("reason", "Query asks for unavailable data dimensions")
            logger.warning("Unsupported bulk query (%.1fs): %s — %s", elapsed, query_text[:80], reason)
            return None, reason

        parsed = ParsedQuery.model_validate(data)
        logger.info("Bulk query parsed (%.1fs): %s", elapsed, parsed.model_dump(exclude_none=True))
        return parsed, None

    except json.JSONDecodeError as e:
        logger.error("Claude returned invalid JSON: %s", e)
        raise AIParsingError(f"Claude returned invalid JSON: {e}", retriable=False) from e


async def execute_bulk_query(
    parsed: ParsedQuery, db: AsyncSession
) -> tuple[list[BulkResult], int]:
    """Build and execute a SQLAlchemy query from parsed filters.

    Returns (results, total_count). Results are capped at 500 rows.

    Raises:
        ValueError if all filter fields are None (empty query).
    """
    # Guard against unfiltered queries
    active_filters = {k: v for k, v in parsed.model_dump().items() if v is not None}
    if not active_filters:
        raise ValueError("At least one filter must be specified — refusing to scan entire table")

    t0 = time.monotonic()
    base = select(ParcelCache)
    count_q = select(func.count()).select_from(ParcelCache)

    filters = []

    # Municipality filter
    if parsed.municipality:
        code = await resolve_gemeente_code(parsed.municipality, db)
        if code:
            filters.append(ParcelCache.gemeente_code == code)
        else:
            logger.warning("Gemeente '%s' not found in DB, skipping filter", parsed.municipality)

    # Build year range
    if parsed.build_year_min is not None:
        filters.append(ParcelCache.bouwjaar >= parsed.build_year_min)
    if parsed.build_year_max is not None:
        filters.append(ParcelCache.bouwjaar <= parsed.build_year_max)

    # Area range
    if parsed.area_min is not None:
        filters.append(ParcelCache.area_m2 >= parsed.area_min)
    if parsed.area_max is not None:
        filters.append(ParcelCache.area_m2 <= parsed.area_max)

    # Bestemming: JSONB containment — bestemmingen @> [{"type": "wonen"}]
    # Note: type values in DB are lowercase (e.g. "wonen", "bedrijf")
    if parsed.bestemming:
        target = json.dumps([{"type": parsed.bestemming.lower()}])
        filters.append(
            ParcelCache.bestemmingen.op("@>")(func.cast(literal(target), PG_JSONB))
        )

    # Bestemming exclusion: NOT @> [{"type": "wonen"}]
    if parsed.bestemming_exclude:
        target = json.dumps([{"type": parsed.bestemming_exclude.lower()}])
        filters.append(
            ~ParcelCache.bestemmingen.op("@>")(func.cast(literal(target), PG_JSONB))
        )

    # Pand status: exact match
    if parsed.pand_status:
        filters.append(ParcelCache.pand_status == parsed.pand_status)

    # Wijk filter: join through ScanResult→AreaScan (must precede WHERE clauses)
    if parsed.wijk:
        base = base.join(ScanResult, ScanResult.parcel_id == ParcelCache.id)
        base = base.join(AreaScan, AreaScan.id == ScanResult.scan_id)
        base = base.where(func.lower(AreaScan.wijk_naam).contains(parsed.wijk.lower()))
        count_q = count_q.join(ScanResult, ScanResult.parcel_id == ParcelCache.id)
        count_q = count_q.join(AreaScan, AreaScan.id == ScanResult.scan_id)
        count_q = count_q.where(func.lower(AreaScan.wijk_naam).contains(parsed.wijk.lower()))

    # Apply filters
    for f in filters:
        base = base.where(f)
        count_q = count_q.where(f)

    # Execute count
    total = (await db.execute(count_q)).scalar_one()

    # Execute main query with limit
    rows = (
        await db.execute(
            base.order_by(ParcelCache.address).limit(500)
        )
    ).scalars().all()

    elapsed = time.monotonic() - t0
    logger.info("Bulk query executed (%.2fs): %d total, %d returned", elapsed, total, len(rows))

    results = [
        BulkResult(
            parcel_id=p.parcel_id,
            address=p.address,
            municipality=None,  # We have gemeente_code, not name — leave null for now
            build_year=p.bouwjaar,
            area_m2=p.area_m2,
            bestemming=(
                p.bestemmingen[0].get("naam") or p.bestemmingen[0].get("type")
                if p.bestemmingen and len(p.bestemmingen) > 0 and isinstance(p.bestemmingen[0], dict)
                else None
            ),
            pand_status=p.pand_status,
        )
        for p in rows
    ]

    return results, total
