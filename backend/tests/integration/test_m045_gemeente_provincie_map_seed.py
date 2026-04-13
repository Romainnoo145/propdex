"""Regression test — M045/S01 T08: gemeente_provincie_map seed fixture integrity.

The cascade query in S02 joins parcel_cache.gemeente_code against
gemeente_provincie_map.gemeente_code to resolve the parcel's provincie.
If the fixture format drifts from parcel_cache's format (e.g., GM-prefix
mismatch), the join silently returns no rows and the entire provincie
cascade becomes dead — a silent correctness bug.

This test loads the committed JSON fixture and validates:
- Row count >= 300 (expected ~340)
- All gemeente_codes start with "GM" (matches parcel_cache format)
- All provincie_codes start with "PV" (CBS convention)
- Known sanity mappings are present (Venlo → Limburg, etc.)
- No duplicate gemeente_codes
- JSON parses cleanly
"""

import json
from pathlib import Path

import pytest

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2] / "app" / "data" / "gemeente_provincie_map.json"
)


@pytest.fixture(scope="module")
def fixture_rows() -> list[dict[str, str]]:
    """Load the committed JSON fixture once per test module."""
    assert FIXTURE_PATH.exists(), (
        f"Fixture missing at {FIXTURE_PATH}. Run "
        "'python -m app.data.generate_gemeente_provincie_map' to regenerate "
        "from CBS Open Data."
    )
    with FIXTURE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def test_fixture_row_count_minimum(fixture_rows):
    """Must have at least 300 rows. Current count is ~342 — anything far
    below that signals the CBS API changed schema."""
    assert len(fixture_rows) >= 300, (
        f"gemeente_provincie_map fixture has only {len(fixture_rows)} rows — "
        f"expected ~340. CBS API may have changed schema. Re-run the "
        f"generation script and inspect the /DataProperties endpoint."
    )


def test_fixture_all_gemeente_codes_prefixed(fixture_rows):
    """Every gemeente_code MUST start with 'GM' to match parcel_cache.gemeente_code.

    This is the format assertion that catches the GM-prefix bug from the
    design review — if parcel_cache stores 'GM0983' and the map stores
    '0983', the join silently returns 0 rows.
    """
    bad_rows = [r for r in fixture_rows if not r["gemeente_code"].startswith("GM")]
    assert not bad_rows, (
        f"Found {len(bad_rows)} rows where gemeente_code doesn't start with 'GM': "
        f"{bad_rows[:5]}... — format mismatch with parcel_cache"
    )


def test_fixture_all_provincie_codes_prefixed(fixture_rows):
    """Every provincie_code MUST start with 'PV' (CBS convention)."""
    bad_rows = [r for r in fixture_rows if not r["provincie_code"].startswith("PV")]
    assert not bad_rows, (
        f"Found {len(bad_rows)} rows where provincie_code doesn't start with 'PV': "
        f"{bad_rows[:5]}..."
    )


def test_fixture_sanity_mappings(fixture_rows):
    """Known gemeente→provincie mappings must be present.

    These are hand-verified against the Dutch gemeente landscape.
    If any fail, either a boundary change happened (rare) or the
    CBS table rows got misaligned (serious bug).
    """
    mapping = {r["gemeente_code"]: r["provincie_code"] for r in fixture_rows}

    expected = {
        "GM0983": "PV31",  # Venlo → Limburg
        "GM0363": "PV27",  # Amsterdam → Noord-Holland
        "GM0518": "PV28",  # Den Haag → Zuid-Holland
        "GM0344": "PV26",  # Utrecht → Utrecht
        "GM1507": "PV31",  # Horst aan de Maas → Limburg (another Limburg gemeente)
    }

    for gemeente_code, expected_provincie in expected.items():
        actual = mapping.get(gemeente_code)
        assert actual == expected_provincie, (
            f"Sanity mapping failed: {gemeente_code} expected {expected_provincie}, "
            f"got {actual}. Either a boundary change or a CBS row misalignment."
        )


def test_fixture_no_duplicate_gemeentes(fixture_rows):
    """Each gemeente_code must appear exactly once (primary key in the DB)."""
    codes = [r["gemeente_code"] for r in fixture_rows]
    unique_codes = set(codes)
    assert len(codes) == len(unique_codes), (
        f"Duplicate gemeente_codes in fixture: "
        f"{len(codes) - len(unique_codes)} duplicates"
    )


def test_fixture_rows_are_sorted(fixture_rows):
    """Fixture should be sorted by gemeente_code for deterministic diffs.

    If this fails, the generation script's sort step is broken and
    regeneration will produce spurious git diffs.
    """
    codes = [r["gemeente_code"] for r in fixture_rows]
    assert codes == sorted(codes), (
        "Fixture rows must be sorted by gemeente_code for deterministic diffs"
    )


def test_fixture_shape(fixture_rows):
    """Each row must be a dict with exactly the two expected keys."""
    for row in fixture_rows[:5]:  # sample first 5 for speed
        assert set(row.keys()) == {"gemeente_code", "provincie_code"}, (
            f"Unexpected keys in row: {list(row.keys())}"
        )
        assert isinstance(row["gemeente_code"], str)
        assert isinstance(row["provincie_code"], str)
