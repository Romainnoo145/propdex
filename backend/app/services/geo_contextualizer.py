"""GeoContextualizer: extract gemeente and uitkomst from Dutch court ruling text.

Provides two extraction functions used during ruling ingestion to persist
geo-relevance data on RulingCache entries. Gemeente names are validated
against the known CBS/ECLI registry (342 gemeenten).

Phase 83 -- Geo Contextualization Feed.
"""

import re

from app.government_apis.ecli_registry import GEMEENTE_TO_RECHTBANK

# Build known gemeenten set from the ECLI registry (342 entries)
KNOWN_GEMEENTEN: set[str] = set(GEMEENTE_TO_RECHTBANK.keys())

# Also build a lowercase lookup for case-insensitive matching
_GEMEENTE_LOWER: dict[str, str] = {g.lower(): g for g in KNOWN_GEMEENTEN}

# Compiled regex patterns in priority order (most specific first).
# Each pattern captures the candidate gemeente name in group 1.
_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"college van burgemeester en wethouders van (?:de gemeente )?([A-Z][\w\s\-'()\.]+)",
        re.IGNORECASE,
    ),
    re.compile(
        r"raad van de gemeente ([A-Z][\w\s\-'()\.]+)",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bgemeente ([A-Z][\w\s\-'()\.]+)",
        re.IGNORECASE,
    ),
    re.compile(
        r"gelegen (?:in|te) ([A-Z][\w\s\-'()\.]+)",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bte ([A-Z][\w\s\-'()\.]+)",
        re.IGNORECASE,
    ),
]


def _validate_gemeente(candidate: str) -> str | None:
    """Validate candidate against KNOWN_GEMEENTEN. Returns canonical name or None."""
    cleaned = candidate.strip().rstrip(".,;:")
    if not cleaned:
        return None
    # Exact match
    if cleaned in KNOWN_GEMEENTEN:
        return cleaned
    # Title-case attempt
    titled = cleaned.title()
    if titled in KNOWN_GEMEENTEN:
        return titled
    # Case-insensitive lookup
    lower = cleaned.lower()
    if lower in _GEMEENTE_LOWER:
        return _GEMEENTE_LOWER[lower]
    return None


def _extract_gemeente_from_match(raw: str) -> str | None:
    """Try progressively shorter word-prefix substrings of raw against known gemeenten.

    E.g., 'Amsterdam heeft besloten' tries:
    - 'Amsterdam heeft besloten' -> no match
    - 'Amsterdam heeft' -> no match
    - 'Amsterdam' -> match!
    """
    words = raw.strip().rstrip(".,;:").split()
    # Try from longest to shortest prefix
    for end in range(len(words), 0, -1):
        candidate = " ".join(words[:end])
        validated = _validate_gemeente(candidate)
        if validated:
            return validated
    return None


def extract_gemeente_from_text(text: str) -> str | None:
    """Extract the most likely gemeente name from Dutch legal text.

    Uses regex patterns matched against known gemeenten from the ECLI registry.
    Filters out anonymized addresses ([adres], [locatie]).

    Args:
        text: Full ruling text or summary.

    Returns:
        Canonical gemeente name or None if no match found.
    """
    if not text:
        return None

    for pattern in _PATTERNS:
        for match in pattern.finditer(text):
            raw = match.group(1)
            # Skip anonymized addresses
            if "[adres]" in raw.lower() or "[locatie]" in raw.lower():
                continue
            validated = _extract_gemeente_from_match(raw)
            if validated:
                return validated

    return None


def extract_uitkomst(text: str, summary: str) -> str:
    """Extract ruling outcome from text using keyword matching.

    Combines summary + first 2000 chars of text for analysis.
    This is lightweight keyword matching; Phase 84 AI will improve accuracy.

    Args:
        text: Full ruling text.
        summary: Ruling summary/abstract.

    Returns:
        One of: "toegewezen", "afgewezen", "gedeeltelijk", "onbekend".
    """
    combined = (summary + " " + text[:2000]).lower()

    # Check keywords in order (most specific first)
    if "gedeeltelijk gegrond" in combined:
        return "gedeeltelijk"
    if "niet-ontvankelijk" in combined:
        return "afgewezen"
    if "beroep gegrond" in combined:
        return "toegewezen"
    if "beroep ongegrond" in combined:
        return "afgewezen"
    # "gegrond" but NOT "ongegrond" in same text
    if "gegrond" in combined and "ongegrond" not in combined:
        return "toegewezen"
    if "ongegrond" in combined:
        return "afgewezen"

    return "onbekend"
