"""Every type-A catalog entry must declare a level; B/C are implicitly gemeente."""
from app.policy_documents.data_source_keys import (
    get_entries_by_type,
)

VALID_LEVELS = {"landelijk", "provincie", "gemeente"}


def test_every_type_a_entry_has_valid_level() -> None:
    for e in get_entries_by_type("A"):
        assert getattr(e, "level", None) in VALID_LEVELS, f"{e.key} missing/invalid level"


def test_b_and_c_entries_are_gemeente_level() -> None:
    for e in [*get_entries_by_type("B"), *get_entries_by_type("C")]:
        assert e.level == "gemeente"


def test_each_level_has_at_least_one_type_a_entry() -> None:
    levels = {e.level for e in get_entries_by_type("A")}
    assert {"landelijk", "provincie", "gemeente"}.issubset(levels)
