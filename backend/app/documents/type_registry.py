"""Document type → dossier slot mapping. Single source of truth for all surfaces."""

from __future__ import annotations


def _build_reverse(mapping: dict[str, str]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for doc_type, slot in mapping.items():
        result.setdefault(slot, []).append(doc_type)
    return result


# Maps every document_type (dossier upload OR checklist-generated) to its
# canonical dossier slot key. Unknown types fall back to 'documenten'.
DOC_TYPE_TO_SLOT: dict[str, str] = {
    # dossier upload types — self-mapping
    "bestemmingscheck":   "bestemmingscheck",
    "perceeldata":        "perceeldata",
    "vergunninghistorie": "vergunninghistorie",
    "woz":                "woz",
    "quickscan":          "quickscan",
    "bodem":              "bodem",
    "fundering":          "fundering",
    "asbest":             "asbest",
    "bouwkundig":         "bouwkundig",
    "energielabel":       "energielabel",
    "bestemmingsplan":    "bestemmingsplan",
    "milieuzones":        "milieuzones",
    "geluid":             "geluid",
    "stikstof":           "stikstof",
    "kadaster":           "kadaster",
    "eigendom":           "eigendom",
    "erfpacht":           "erfpacht",
    "documenten":         "documenten",
    "correspondentie":    "correspondentie",
    "ideeen":             "ideeen",
    "checklist":          "documenten",
    # checklist-generated types — cross-mapping to dossier slot
    "vergunningen":       "vergunninghistorie",
    "haalbaarheid":       "bestemmingscheck",
    "wkb_precheck":       "bestemmingscheck",
    "risicoprofiel":      "quickscan",
    "monumenten":         "kadaster",
}

# Auto-generated reverse: slot → all doc_types that land there
SLOT_TO_DOC_TYPES: dict[str, list[str]] = _build_reverse(DOC_TYPE_TO_SLOT)

FALLBACK_SLOT = "documenten"


def slot_for_type(doc_type: str) -> str:
    """Return the canonical dossier slot for a document_type. Unknown → 'documenten'."""
    return DOC_TYPE_TO_SLOT.get(doc_type, FALLBACK_SLOT)


def types_for_slot(slot: str) -> list[str]:
    """Return all document_types that map to a given slot."""
    return SLOT_TO_DOC_TYPES.get(slot, [slot])
