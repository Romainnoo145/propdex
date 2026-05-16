"""Unit tests for ACTION_ITEMS_CATALOG (M049/S06 Plan 06-01)."""
from __future__ import annotations

from app.policy_documents.data_source_keys import DATA_SOURCE_KEYS
from app.services.action_items_catalog import (
    ACTION_ITEMS_CATALOG,
    INFRASTRUCTURE_ACTION_ITEMS,
    ActionItemEntry,
    _validate_catalog,
)

VALID_CATEGORIES = {"api-config", "extern-contact", "roadmap", "bugfix"}
VALID_PRIORITIES = {"hoog", "middel", "laag"}


def test_python_action_item_keys_match_data_source_keys() -> None:
    """Every catalog key MUST correspond to an entry in DATA_SOURCE_KEYS."""
    catalog_keys = {e.key for e in DATA_SOURCE_KEYS}
    offenders = [k for k in ACTION_ITEMS_CATALOG if k not in catalog_keys]
    assert not offenders, (
        f"ACTION_ITEMS_CATALOG keys not in DATA_SOURCE_KEYS: {offenders}"
    )
    # Module-load self-check must also pass
    _validate_catalog()


def test_all_action_item_entries_have_required_fields() -> None:
    """Every entry — catalog and infrastructure — has non-empty id/title/description
    and valid category/priority Literals."""
    all_entries: list[ActionItemEntry] = list(ACTION_ITEMS_CATALOG.values()) + list(
        INFRASTRUCTURE_ACTION_ITEMS
    )
    for e in all_entries:
        assert e.id, f"Empty id: {e!r}"
        assert e.title, f"Empty title for {e.id}"
        assert e.description, f"Empty description for {e.id}"
        assert e.category in VALID_CATEGORIES, f"Bad category {e.category!r} on {e.id}"
        assert e.priority in VALID_PRIORITIES, f"Bad priority {e.priority!r} on {e.id}"


def test_infrastructure_items_are_non_empty() -> None:
    """INFRASTRUCTURE_ACTION_ITEMS must hold at least 5 entries
    (mail-server, google-oauth, stripe, chat-model-upgrade, raadsinformatie-cache)."""
    assert len(INFRASTRUCTURE_ACTION_ITEMS) >= 5
    required = {
        "mail-server",
        "google-oauth",
        "stripe",
        "chat-model-upgrade",
        "raadsinformatie-cache",
    }
    ids = {item.id for item in INFRASTRUCTURE_ACTION_ITEMS}
    missing = required - ids
    assert not missing, f"Missing required infra items: {missing}"


def test_action_item_keys_are_unique() -> None:
    """No id collisions between ACTION_ITEMS_CATALOG and INFRASTRUCTURE_ACTION_ITEMS."""
    catalog_ids = set(ACTION_ITEMS_CATALOG.keys())
    infra_ids = {item.id for item in INFRASTRUCTURE_ACTION_ITEMS}
    overlap = catalog_ids & infra_ids
    assert not overlap, f"id appears in both catalog and infrastructure: {overlap}"


def test_done_items_are_marked_correctly() -> None:
    """Shipped items (welstandsnota, omgevingsvisie) MUST have done=True."""
    if "welstandsnota" in ACTION_ITEMS_CATALOG:
        assert ACTION_ITEMS_CATALOG["welstandsnota"].done is True
    if "omgevingsvisie" in ACTION_ITEMS_CATALOG:
        assert ACTION_ITEMS_CATALOG["omgevingsvisie"].done is True
