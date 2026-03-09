"""Static BRO soil code prefix to grondsoort classification. Phase 87.

Maps BRO Bodemkaart soil code prefixes to four risk-relevant grondsoort
categories used for foundation risk assessment:
- veen (peat): highest foundation risk
- klei (clay): moderate-high risk
- zand (sand): low risk
- leem (loess/silt): moderate risk
- onbekend: no match or empty code

Source: BRO Catalogus Bodemkaart (docs.geostandaarden.nl/bro/SGM/)
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# BRO soil code prefix -> grondsoort category
# Lowercase prefixes are modifiers: p=polder, k=knipklei, c=cumulatief, etc.
SOIL_PREFIX_TO_GRONDSOORT: dict[str, str] = {
    # Veengronden (peat) — highest foundation risk
    "V": "veen",
    "aV": "veen",
    "hV": "veen",
    "pV": "veen",
    "kV": "veen",
    "iV": "veen",
    # Kleigronden (clay) — M=zeeklei, R=rivierklei
    "M": "klei",
    "R": "klei",
    "pM": "klei",
    "kM": "klei",
    # Zandgronden (sand) — Z=zand, Y=vaaggronden, H=podzolgronden
    "Z": "zand",
    "Y": "zand",
    "H": "zand",
    "cY": "zand",
    "Zd": "zand",
    # Leemgronden (loess/silt)
    "L": "leem",
    "BL": "leem",
}

# Dutch display labels for each grondsoort category
GRONDSOORT_LABELS: dict[str, str] = {
    "klei": "Kleigrond",
    "veen": "Veengrond",
    "zand": "Zandgrond",
    "leem": "Leemgrond",
    "onbekend": "Onbekend",
}


def classify_soil_code(code: str) -> str:
    """Classify BRO soilcode prefix to grondsoort category.

    Tries longest prefix first (2 chars), then 1 char. Returns "onbekend"
    if no match or empty code. Logs unrecognized codes as warnings.

    Args:
        code: BRO soil code (e.g., "cY23", "Mn25A", "Vk")

    Returns:
        Grondsoort category: "klei", "veen", "zand", "leem", or "onbekend"
    """
    if not code:
        return "onbekend"

    # Try longest prefix first (2 chars), then 1 char
    for length in (2, 1):
        prefix = code[:length]
        if prefix in SOIL_PREFIX_TO_GRONDSOORT:
            return SOIL_PREFIX_TO_GRONDSOORT[prefix]

    logger.warning("Unrecognized BRO soil code prefix: %s (full code: %s)", code[:2], code)
    return "onbekend"
