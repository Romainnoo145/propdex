"""Category classifier for SRU bekendmakingen titles.

Maps raw SRU title strings to human-readable Dutch category labels based on
keyword matching. Used to make the meldingen feed scannable at a glance.
"""


def classify_bekendmaking(title: str, change_type: str) -> str:
    """Return a human-readable Dutch category label for a bekendmaking.

    Args:
        title: The raw SRU title string (e.g. "Verleende omgevingsvergunning -
            reguliere procedure - Dorpsstraat 12").
        change_type: Either "permit" or "zoning".

    Returns:
        A Dutch label string describing the category of the change.
    """
    lower = title.lower()

    if change_type == "permit":
        return _classify_permit(lower)

    if change_type == "zoning":
        return _classify_zoning(lower)

    # Unknown change_type — return generic fallback
    return "Wijziging"


def _classify_permit(lower: str) -> str:
    """Classify a permit bekendmaking by keyword matching on the lowercased title."""
    # Most specific patterns first

    if "buiten behandeling" in lower:
        return "Buiten behandeling gesteld"

    if "bezwaarschrift" in lower or "bezwaar" in lower:
        return "Bezwaar ingediend"

    if "ingetrokken" in lower:
        return "Omgevingsvergunning ingetrokken"

    if "geweigerde" in lower or "geweigerd" in lower:
        return "Omgevingsvergunning geweigerd"

    if "ontwerpbesluit" in lower or "ter inzage" in lower:
        return "Ontwerpbesluit ter inzage"

    if "verleende" in lower or "verleend" in lower or "vergunning verleend" in lower:
        return "Omgevingsvergunning verleend"

    if "aangevraagde" in lower or "aanvraag" in lower:
        return "Omgevingsvergunning aangevraagd"

    if "reguliere" in lower:
        return "Reguliere omgevingsvergunning"

    if "melding" in lower and ("sloop" in lower or "brandveilig" in lower):
        return "Sloop-/brandveiligheidmelding"

    if "kapvergunning" in lower or "kappen" in lower:
        return "Kapvergunning"

    return "Omgevingsvergunning"


def _classify_zoning(lower: str) -> str:
    """Classify a zoning bekendmaking by keyword matching on the lowercased title."""
    # Most specific patterns first

    if "vastgesteld" in lower:
        return "Bestemmingsplan vastgesteld"

    if "gewijzigd" in lower or "plan gewijzigd" in lower:
        return "Bestemmingsplan gewijzigd"

    if "ontwerp" in lower:
        return "Ontwerpbestemmingsplan"

    if "nieuw plan" in lower:
        return "Nieuw bestemmingsplan"

    return "Bestemmingsplanwijziging"
