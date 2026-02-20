"""Dutch postcode extraction from free-text strings.

Extracts postcodes matching the Dutch format (4 digits + 2 uppercase letters)
from bekendmaking titles, addresses, and other text. Normalizes to "1234AB" format.
"""

import re

# Dutch postcode: 4 digits + optional space + 2 uppercase letters
POSTCODE_PATTERN = re.compile(r"\b(\d{4})\s?([A-Z]{2})\b")


def extract_postcodes(text: str) -> list[str]:
    """Extract Dutch postcodes from text, normalized to '1234AB' format.

    Args:
        text: Free-text string (e.g., bekendmaking title)

    Returns:
        List of unique postcodes found, normalized without spaces.

    Example:
        >>> extract_postcodes("Omgevingsvergunning 5935 BG Steyl")
        ['5935BG']
        >>> extract_postcodes("No postcode here")
        []
    """
    matches = POSTCODE_PATTERN.findall(text.upper())
    # Deduplicate while preserving order
    seen: set[str] = set()
    result: list[str] = []
    for digits, letters in matches:
        pc = f"{digits}{letters}"
        if pc not in seen:
            seen.add(pc)
            result.append(pc)
    return result
