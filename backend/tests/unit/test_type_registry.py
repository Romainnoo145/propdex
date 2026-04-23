"""Unit tests for document type registry."""
from __future__ import annotations

from app.documents.type_registry import (
    DOC_TYPE_TO_SLOT,
    SLOT_TO_DOC_TYPES,
    FALLBACK_SLOT,
    slot_for_type,
    types_for_slot,
)


def test_all_dossier_slot_types_self_map():
    """Every dossier upload type maps to itself."""
    self_mapped = [
        "bestemmingscheck", "perceeldata", "vergunninghistorie", "woz", "quickscan",
        "bodem", "fundering", "asbest", "bouwkundig", "energielabel",
        "bestemmingsplan", "milieuzones", "geluid", "stikstof",
        "kadaster", "eigendom", "erfpacht", "documenten", "correspondentie", "ideeen",
    ]
    for t in self_mapped:
        assert DOC_TYPE_TO_SLOT[t] == t, f"{t} should self-map but maps to {DOC_TYPE_TO_SLOT[t]}"


def test_cross_mappings():
    """Checklist-generated types map to the correct dossier slot."""
    assert slot_for_type("vergunningen") == "vergunninghistorie"
    assert slot_for_type("haalbaarheid") == "bestemmingscheck"
    assert slot_for_type("wkb_precheck") == "bestemmingscheck"
    assert slot_for_type("risicoprofiel") == "quickscan"
    assert slot_for_type("monumenten") == "kadaster"
    assert slot_for_type("checklist") == "documenten"


def test_unknown_type_falls_back_to_documenten():
    assert slot_for_type("onbekend_type_xyz") == FALLBACK_SLOT


def test_reverse_map_covers_all_slots():
    """Every value in DOC_TYPE_TO_SLOT appears as a key in SLOT_TO_DOC_TYPES."""
    all_slots = set(DOC_TYPE_TO_SLOT.values())
    for slot in all_slots:
        assert slot in SLOT_TO_DOC_TYPES, f"slot '{slot}' missing from reverse map"


def test_reverse_map_includes_cross_types():
    """vergunninghistorie slot includes both 'vergunninghistorie' and 'vergunningen'."""
    types = types_for_slot("vergunninghistorie")
    assert "vergunninghistorie" in types
    assert "vergunningen" in types

    types = types_for_slot("bestemmingscheck")
    assert "bestemmingscheck" in types
    assert "haalbaarheid" in types
    assert "wkb_precheck" in types


def test_reverse_map_no_duplicates_per_slot():
    """No duplicate doc_types within a slot."""
    for slot, types in SLOT_TO_DOC_TYPES.items():
        assert len(types) == len(set(types)), f"duplicates in slot '{slot}': {types}"
