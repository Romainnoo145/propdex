"""DoorlooptijdService -- filing date extraction, procedure duration, and aggregation.

Extracts filing dates (datum indiening) from Dutch legal text,
computes doorlooptijd (procedure duration in days), and provides
aggregated statistics per vergunningstype for a gemeente.
"""

import logging
import re
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ruling_cache import RulingCache

logger = logging.getLogger(__name__)

# Dutch month names → integer mapping
DUTCH_MONTHS: dict[str, int] = {
    "januari": 1,
    "februari": 2,
    "maart": 3,
    "april": 4,
    "mei": 5,
    "juni": 6,
    "juli": 7,
    "augustus": 8,
    "september": 9,
    "oktober": 10,
    "november": 11,
    "december": 12,
}

# Compiled regex patterns for extracting filing dates from Dutch legal text
_FILING_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"beroepschrift\s+(?:is\s+)?ingediend\s+(?:op\s+)?(\d{1,2})\s+(\w+)\s+(\d{4})",
        re.IGNORECASE,
    ),
    re.compile(
        r"bezwaarschrift\s+van\s+(\d{1,2})\s+(\w+)\s+(\d{4})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:ingekomen|ontvangen)\s+op\s+(\d{1,2})[-/](\d{1,2})[-/](\d{4})",
        re.IGNORECASE,
    ),
]

# Section markers in Dutch legal text (uppercase)
_SECTION_MARKERS = [
    "OVERWEGINGEN",
    "BEOORDELING",
    "HET GESCHIL",
    "DE BEOORDELING",
    "OVERWEGINGEN VAN DE RECHTBANK",
    "BEOORDELING VAN HET GESCHIL",
]


def extract_filing_date(text: str) -> str | None:
    """Extract filing date from Dutch legal text.

    Searches the first 3000 characters for filing date patterns
    using Dutch month names or numeric date formats.

    Args:
        text: Full text of the court ruling.

    Returns:
        ISO date string (YYYY-MM-DD) or None if not found.
    """
    search_text = text[:3000]

    for pattern in _FILING_PATTERNS:
        match = pattern.search(search_text)
        if not match:
            continue

        groups = match.groups()
        day = int(groups[0])

        # Determine month: Dutch name or numeric
        month_str = groups[1].lower()
        if month_str in DUTCH_MONTHS:
            month = DUTCH_MONTHS[month_str]
        elif month_str.isdigit():
            month = int(month_str)
        else:
            continue

        year = int(groups[2])

        # Validate date
        try:
            d = date(year, month, day)
            return d.isoformat()
        except ValueError:
            continue

    return None


def compute_doorlooptijd(datum_uitspraak: str, datum_indiening: str) -> int | None:
    """Compute procedure duration in days.

    Args:
        datum_uitspraak: Ruling date as ISO string (YYYY-MM-DD).
        datum_indiening: Filing date as ISO string (YYYY-MM-DD).

    Returns:
        Duration in days if positive, else None.
    """
    try:
        uitspraak = date.fromisoformat(datum_uitspraak[:10])
        indiening = date.fromisoformat(datum_indiening[:10])
        diff = (uitspraak - indiening).days
        return diff if diff > 0 else None
    except (ValueError, TypeError):
        return None


def extract_relevant_sections(full_text: str, max_chars: int = 15000) -> str:
    """Extract the most relevant sections from a court ruling for AI analysis.

    Looks for OVERWEGINGEN/BEOORDELING/HET GESCHIL section markers and returns
    text from that point, capped at max_chars. Falls back to the last 60% of
    the text if no marker is found.

    Args:
        full_text: Complete ruling text.
        max_chars: Maximum characters to return.

    Returns:
        Extracted relevant section text.
    """
    if not full_text:
        return ""

    if len(full_text) <= max_chars:
        return full_text

    upper_text = full_text.upper()

    # Find the earliest section marker
    earliest_pos = len(full_text)
    for marker in _SECTION_MARKERS:
        pos = upper_text.find(marker)
        if pos != -1 and pos < earliest_pos:
            earliest_pos = pos

    if earliest_pos < len(full_text):
        # Found a marker -- return text from that point
        return full_text[earliest_pos : earliest_pos + max_chars]

    # Fallback: last 60% of text (reasoning/conclusion is typically at the end)
    start = int(len(full_text) * 0.4)
    return full_text[start : start + max_chars]


async def get_doorlooptijd_stats(
    db: AsyncSession, gemeente_naam: str
) -> dict:
    """Aggregate doorlooptijd statistics per vergunningstype for a gemeente.

    Groups by vergunningstype where doorlooptijd_dagen IS NOT NULL.
    Returns avg/min/max per type with a minimum sample size of 3;
    below that returns insufficient_data: true.

    Args:
        db: Async database session.
        gemeente_naam: Municipality name.

    Returns:
        Dict with per-vergunningstype stats and overall summary.
    """
    stmt = (
        select(
            RulingCache.vergunningstype,
            func.count(RulingCache.doorlooptijd_dagen).label("count"),
            func.avg(RulingCache.doorlooptijd_dagen).label("avg_dagen"),
            func.min(RulingCache.doorlooptijd_dagen).label("min_dagen"),
            func.max(RulingCache.doorlooptijd_dagen).label("max_dagen"),
        )
        .where(
            (RulingCache.gemeente_query == gemeente_naam)
            | (RulingCache.extracted_gemeente == gemeente_naam),
            RulingCache.doorlooptijd_dagen.isnot(None),
            RulingCache.vergunningstype.isnot(None),
        )
        .group_by(RulingCache.vergunningstype)
    )

    result = await db.execute(stmt)
    rows = result.all()

    stats: dict[str, dict] = {}
    total_count = 0
    total_sum = 0

    for row in rows:
        vtype = row.vergunningstype
        count = row.count
        total_count += count

        if count < 3:
            stats[vtype] = {
                "vergunningstype": vtype,
                "count": count,
                "avg_dagen": None,
                "min_dagen": None,
                "max_dagen": None,
                "insufficient_data": True,
            }
        else:
            avg_val = round(float(row.avg_dagen))
            total_sum += avg_val * count
            stats[vtype] = {
                "vergunningstype": vtype,
                "count": count,
                "avg_dagen": avg_val,
                "min_dagen": row.min_dagen,
                "max_dagen": row.max_dagen,
                "insufficient_data": False,
            }

    overall_avg = round(total_sum / total_count) if total_count > 0 else None

    return {
        "gemeente_naam": gemeente_naam,
        "stats": stats,
        "total_count": total_count,
        "overall_avg_dagen": overall_avg,
    }
