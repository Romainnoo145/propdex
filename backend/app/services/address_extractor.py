"""Dutch address extraction from SRU bekendmaking titles.

Provides standalone functions to extract structured address data from
Officiële Bekendmakingen (SRU) title strings. Uses a multi-strategy approach
to handle the many different title formats published by Dutch municipalities.

Exported functions:
    extract_address_from_title(title) -> dict | None
    extract_huisnummer(address_str) -> int | None
"""

import re

# ---------------------------------------------------------------------------
# Compiled patterns
# ---------------------------------------------------------------------------

# Dutch postcode: 4 digits + optional space + 2 uppercase letters
# Use word boundaries to avoid matching inside longer digit sequences
_POSTCODE_RE = re.compile(r"\b(\d{4})\s?([A-Z]{2})\b")

# Huisnummer: integer possibly followed by letter-suffix or dash-suffix
# Group 1 = digits, Group 2 = optional suffix (e.g., "a", "-A", "-bis")
_HUISNUMMER_RE = re.compile(r"\b(\d+)([A-Za-z]|-[A-Za-z0-9]+)?\b")

# Keywords that signal the address comes BEFORE them in the title
_ADDRESS_BEFORE_KEYWORDS = (
    ", aangevraagde ",
    ", verleende ",
    ", geweigerde ",
    ", ingetrokken ",
    ", buiten behandeling ",
)

# Plan types that contain no address — bail out immediately
_NO_ADDRESS_RE = re.compile(
    r"^(bestemmingsplan|wijzigingsplan|inpassingsplan|structuurvisie|"
    r"omgevingsvisie|beheersverordening|exploitatieplan)\b",
    re.IGNORECASE,
)

# Generic titles that shouldn't match as addresses even if they have a number
# (e.g., "Ingekomen bouwaanvragen week 8", "Ingekomen aanvragen week 12")
_GENERIC_TITLE_RE = re.compile(
    r"\b(week|bouwaanvragen|aanvragen|herziening|fase|deel|bijlage)\s+\d+",
    re.IGNORECASE,
)

# Single permit-type keywords (case-insensitive) that appear as lone words
# in the title — used to strip from the front of address candidates
_PERMIT_WORDS: frozenset[str] = frozenset(
    {
        "omgevingsvergunning",
        "bouwvergunning",
        "sloopvergunning",
        "aanvraag",
        "verleende",
        "verleend",
        "geweigerde",
        "geweigerd",
        "ingetrokken",
        "kennisgeving",
        "besluit",
        "vergunning",
        "bekendmaking",
        "beschikking",
        "reguliere",
        "regulier",
        "ontwerpbesluit",
        "ontwerp",
        "aangevraagde",
        "aangevraagd",
        "mededeling",
    }
)

# Multi-word lead phrases to strip from the front of a string before parsing
_STRIP_LEAD_PHRASES = re.compile(
    r"^(?:"
    r"ter\s+inzage\s+(?:legging\s+)?(?:van\s+(?:het|een|de)\s+)?|"
    r"reguliere\s+|"
    r"ontwerpbesluit\s+|"
    r"ontwerp\s+|"
    r"aanvraag\s+(?:om\s+een\s+|voor\s+(?:een\s+)?)?(?:omgevingsvergunning\s+|vergunning\s+)?(?:voor\s+\w+\s+(?:van\s+(?:een\s+|het\s+|de\s+)?\w+\s+)?,?\s*)?"
    r")",
    re.IGNORECASE,
)

# Street + number pattern — must start at a capital letter that begins a WORD
# (i.e., preceded by start-of-string or a non-word character)
# This pattern finds the LAST valid street+number in a cleaned segment.
_LAST_STREET_NUMBER_RE = re.compile(
    r"(?:^|(?<=,\s)|(?<=\s))"          # Start, after ", " or after space
    r"([A-Z][a-zA-Zéèëïöüñ\-\.']+)"   # First word must start UPPERCASE (A-Z)
    r"(?:\s+(?:[a-z]{1,3}\s+)?[A-Za-zéèëïöüñ\-\.']+)*"  # optional lower connectors + more words
    r"\s+(\d+)([A-Za-z]|-[A-Za-z0-9]+)?"  # number + optional suffix
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def extract_huisnummer(address_str: str) -> int | None:
    """Extract the huisnummer (house number) from an address string.

    Handles number-only, letter-suffix (15a), and dash-suffix (123-A) forms.

    Args:
        address_str: Address string like "Kerkstraat 42" or "Laan van Meerdervoort 123-A"

    Returns:
        Integer house number, or None if not found.

    Examples:
        >>> extract_huisnummer("Kerkstraat 42")
        42
        >>> extract_huisnummer("Laan van Meerdervoort 123-A")
        123
        >>> extract_huisnummer("No number here")
        None
    """
    if not address_str or not address_str.strip():
        return None

    matches = list(_HUISNUMMER_RE.finditer(address_str))
    if not matches:
        return None

    # Return the last number that does NOT look like a year
    for m in reversed(matches):
        num = int(m.group(1))
        if 1900 <= num <= 2100:
            continue
        return num

    return None


def extract_address_from_title(title: str) -> dict | None:
    """Extract a structured Dutch address from an SRU bekendmaking title.

    Uses a multi-strategy approach:
    1. Skip titles that never contain addresses (bestemmingsplan etc.)
    2. Skip generic week/number titles ("Ingekomen bouwaanvragen week 8")
    3. Try keyword-before-address extraction (", aangevraagde ..." etc.)
    4. Try postcode-anchored extraction (most reliable when postcode present)
    5. Try dash-separator extraction ("Gemeente X - ..." or "Type - Address")
    6. Try bare street+number fallback (no postcode)

    Args:
        title: SRU bekendmaking title string

    Returns:
        dict with keys: street, huisnummer, huisnummer_toevoeging, postcode,
        city, full_address — or None if no address could be extracted.

    Examples:
        >>> extract_address_from_title(
        ...     "Kerkstraat 42, 1234AB Venlo, aangevraagde Omgevingsvergunning"
        ... )
        {'street': 'Kerkstraat', 'huisnummer': 42, 'huisnummer_toevoeging': None,
         'postcode': '1234AB', 'city': 'Venlo', 'full_address': 'Kerkstraat 42, 1234AB Venlo'}
    """
    if not title or not title.strip():
        return None

    title = title.strip()

    # Guard 1: Plan-type titles never have individual addresses
    if _NO_ADDRESS_RE.match(title):
        return None

    # Guard 2: Generic "week N" / "aanvragen week 8" style titles
    if _GENERIC_TITLE_RE.search(title):
        return None

    # Strategy 1: keyword-before-address
    # Titles like "Kerkstraat 42, 1234AB Venlo, aangevraagde Omgevingsvergunning"
    for keyword in _ADDRESS_BEFORE_KEYWORDS:
        idx = title.lower().find(keyword)
        if idx != -1:
            candidate = title[:idx].strip()
            result = _parse_address_segment(candidate)
            if result is not None:
                return result

    # Strategy 2: postcode-anchored extraction
    pc_match = _POSTCODE_RE.search(title.upper())
    if pc_match:
        result = _extract_by_postcode(title, pc_match)
        if result is not None:
            return result

    # Strategy 3: dash-separator extraction
    # "Gemeente Venlo - Omgevingsvergunning, Straat N, PCCC" — after dash
    # Also "Verleende ... - Straat N, PCCC"
    if " - " in title:
        parts = title.split(" - ", 1)
        candidate = parts[1].strip()
        result = _parse_address_segment(candidate)
        if result is not None:
            return result

    # Strategy 4: bare street+number fallback
    result = _try_bare_street_fallback(title)
    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_address_segment(segment: str) -> dict | None:
    """Parse a string that should contain a street address.

    Tries to extract street, number, suffix, postcode, and city.
    Returns structured dict or None if no valid address found.
    """
    if not segment or not segment.strip():
        return None

    segment = segment.strip().strip(",")

    # Check for postcode within this segment
    pc_match = _POSTCODE_RE.search(segment.upper())
    if pc_match:
        return _extract_by_postcode(segment, pc_match)

    # No postcode — try bare street+number
    return _try_bare_street_fallback(segment)


def _extract_by_postcode(text: str, pc_match: re.Match) -> dict | None:
    """Extract address components using postcode as anchor.

    The postcode divides the string: street+number appear BEFORE the postcode,
    city appears AFTER the postcode.

    Returns structured address dict or None.
    """
    postcode = f"{pc_match.group(1)}{pc_match.group(2)}"

    # Find actual position in original text (pc_match was on .upper())
    pc_pos = _find_postcode_position(text, postcode)
    if pc_pos is None:
        return None
    pc_start, pc_end = pc_pos

    # Segment before postcode: may contain keywords + street + number
    before = text[:pc_start].rstrip(", ")

    # Segment after postcode: city
    after = text[pc_end:].strip().strip(",")
    city_raw = after.split(",")[0].strip()
    city = city_raw if city_raw else None

    # Strip leading permit-keyword prefix from "before" to isolate street
    cleaned_before = _strip_permit_prefix(before)

    # Find street + number in cleaned segment
    street_match = _find_street_and_number(cleaned_before)
    if street_match is None:
        return None

    street, huisnummer, toevoeging = street_match

    full_address = _build_full_address(street, huisnummer, toevoeging, postcode, city)
    return {
        "street": street,
        "huisnummer": huisnummer,
        "huisnummer_toevoeging": toevoeging,
        "postcode": postcode,
        "city": city,
        "full_address": full_address,
    }


def _strip_permit_prefix(text: str) -> str:
    """Remove leading permit-type keyword phrases from address candidate.

    Examples:
        "Reguliere omgevingsvergunning Laan van Meerdervoort 123-A"
        -> "Laan van Meerdervoort 123-A"

        "Ontwerpbesluit omgevingsvergunning Stationsweg 5"
        -> "Stationsweg 5"

        "Ter inzage omgevingsvergunning Prins Bernhardlaan 3"
        -> "Prins Bernhardlaan 3"
    """
    # First try multi-word lead phrase patterns
    stripped = _STRIP_LEAD_PHRASES.sub("", text).strip()
    if stripped != text.strip():
        # Also strip any remaining single permit words at the start
        return _strip_single_permit_words(stripped)

    # Then strip individual permit words from the start
    return _strip_single_permit_words(text.strip())


def _strip_single_permit_words(text: str) -> str:
    """Strip leading single permit-type words from text."""
    words = text.split()
    while words and words[0].lower().rstrip(",") in _PERMIT_WORDS:
        words = words[1:]
    return " ".join(words)


def _find_postcode_position(text: str, postcode_normalized: str) -> tuple[int, int] | None:
    """Find start/end position of postcode in text (handles spaces in original).

    Returns (start, end) positions in the original text, or None.
    """
    digits = postcode_normalized[:4]
    letters = postcode_normalized[4:]
    pc_re = re.compile(rf"\b{re.escape(digits)}\s?{re.escape(letters)}\b", re.IGNORECASE)
    m = pc_re.search(text)
    if m:
        return m.start(), m.end()
    return None


def _find_street_and_number(segment: str) -> tuple[str, int, str | None] | None:
    """Find street name, house number, and optional suffix in a cleaned segment.

    Finds the LAST valid "CapWord(s) Number[suffix]" pattern.
    Returns (street, huisnummer, toevoeging) or None.
    """
    if not segment or not segment.strip():
        return None

    best: re.Match | None = None
    for m in _LAST_STREET_NUMBER_RE.finditer(segment):
        num = int(m.group(2))
        # Skip year-like numbers
        if 1900 <= num <= 2100:
            continue
        best = m

    if best is None:
        return None

    # Extract the full matched text and parse into components
    full_match = best.group(0).strip()
    huisnummer = int(best.group(2))
    suffix_raw = best.group(3)

    # Street name is everything before the house number in the match
    # Find position of the house number in the match text
    num_pos = full_match.rfind(str(best.group(2)) + (suffix_raw or ""))
    if num_pos == -1:
        # Fallback: find by number alone
        num_str = str(huisnummer)
        num_pos = full_match.rfind(num_str)
    street = full_match[:num_pos].strip().rstrip(",").strip()

    if not street or not street[0].isupper():
        return None

    # Normalize toevoeging
    toevoeging: str | None = None
    if suffix_raw:
        toevoeging = suffix_raw.lstrip("-").strip() or None

    return street, huisnummer, toevoeging


def _try_bare_street_fallback(text: str) -> dict | None:
    """Last-resort: find "Straatnaam Number" with no postcode context.

    Strips leading permit keywords, then looks for a capital-starting
    street name followed by a house number.
    """
    if not text or len(text.strip()) < 5:
        return None

    cleaned = _strip_permit_prefix(text)
    if not cleaned:
        return None

    street_match = _find_street_and_number(cleaned)
    if street_match is None:
        return None

    street, huisnummer, toevoeging = street_match

    # Require street to start with uppercase
    if not street or not street[0].isupper():
        return None

    full_address = _build_full_address(street, huisnummer, toevoeging, None, None)
    return {
        "street": street,
        "huisnummer": huisnummer,
        "huisnummer_toevoeging": toevoeging,
        "postcode": None,
        "city": None,
        "full_address": full_address,
    }


def _build_full_address(
    street: str,
    huisnummer: int,
    toevoeging: str | None,
    postcode: str | None,
    city: str | None,
) -> str:
    """Build a human-readable full address string."""
    addr = f"{street} {huisnummer}"
    if toevoeging:
        if toevoeging[0].isdigit():
            addr += f"-{toevoeging}"
        else:
            addr += toevoeging
    if postcode and city:
        addr += f", {postcode} {city}"
    elif postcode:
        addr += f", {postcode}"
    elif city:
        addr += f", {city}"
    return addr
