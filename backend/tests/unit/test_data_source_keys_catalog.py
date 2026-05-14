"""Catalog completeness + Python↔TS sync tests for M049/S01 data-source catalog."""

import re
from pathlib import Path

from app.policy_documents.data_source_keys import (
    DATA_SOURCE_KEYS,
    DataSourceKeyEntry,
    get_entries_by_type,
    get_entry,
)

TS_CATALOG_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "src"
    / "lib"
    / "constants"
    / "dataSourceKeys.ts"
).resolve()


def test_catalog_has_at_least_27_entries() -> None:
    assert len(DATA_SOURCE_KEYS) >= 27, (
        f"Catalog has {len(DATA_SOURCE_KEYS)} entries; M049/S01 requires >=27"
    )


def test_catalog_covers_all_three_source_types() -> None:
    types_present = {e.source_type for e in DATA_SOURCE_KEYS}
    assert types_present == {"A", "B", "C"}, (
        f"Expected all 3 source_types A/B/C; found {types_present}"
    )


def test_catalog_has_no_duplicate_keys() -> None:
    keys = [e.key for e in DATA_SOURCE_KEYS]
    duplicates = [k for k in keys if keys.count(k) > 1]
    assert not duplicates, f"Duplicate keys found: {set(duplicates)}"


def test_all_labels_are_non_empty() -> None:
    empty = [
        e.key for e in DATA_SOURCE_KEYS if not (e.label_nl and e.label_nl.strip())
    ]
    assert not empty, f"Entries with empty label_nl: {empty}"


def test_all_keys_are_kebab_case() -> None:
    # Kebab-case: lowercase alnum tokens joined by hyphens. Leading digit allowed
    # (e.g. "3d-bag" is a canonical catalog key per CONTEXT §catalog files).
    pattern = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
    bad = [e.key for e in DATA_SOURCE_KEYS if not pattern.match(e.key)]
    assert not bad, f"Non-kebab-case keys: {bad}"


def test_python_ts_catalog_key_sets_match() -> None:
    assert TS_CATALOG_PATH.exists(), f"TS mirror missing: {TS_CATALOG_PATH}"
    ts_source = TS_CATALOG_PATH.read_text(encoding="utf-8")
    ts_keys = set(re.findall(r'key:\s*"([a-z0-9-]+)"', ts_source))
    py_keys = {e.key for e in DATA_SOURCE_KEYS}
    only_py = py_keys - ts_keys
    only_ts = ts_keys - py_keys
    assert py_keys == ts_keys, (
        f"Python<->TS catalog drift. Only in Python: {only_py}. Only in TS: {only_ts}"
    )


def test_lookup_helpers() -> None:
    entry = get_entry("woonvisie")
    assert entry is not None
    assert entry.source_type == "A"
    assert isinstance(entry, DataSourceKeyEntry)

    assert get_entry("nonexistent-key-xyz") is None

    type_a = get_entries_by_type("A")
    assert len(type_a) >= 10, f"Expected >=10 Type-A entries, got {len(type_a)}"
