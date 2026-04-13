"""
Generate gemeente_provincie_map.json from CBS Open Data table 85385NED.

Run this script ONCE during M045/S01 setup, and re-run only when CBS
publishes a new gemeente boundary update (typically January 1 of each
year when gemeentes merge or split). The output is committed to the repo
at backend/app/data/gemeente_provincie_map.json.

Usage:
    cd backend && source .venv/bin/activate
    python -m app.data.generate_gemeente_provincie_map

The script writes the JSON file next to itself and prints a summary.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

CBS_TABLE_ID = "85385NED"
CBS_BASE_URL = f"https://opendata.cbs.nl/ODataApi/odata/{CBS_TABLE_ID}"
OUTPUT_PATH = Path(__file__).parent / "gemeente_provincie_map.json"


def fetch_raw_rows() -> list[dict[str, object]]:
    """Fetch all rows from CBS TypedDataSet endpoint."""
    url = f"{CBS_BASE_URL}/TypedDataSet"
    rows: list[dict[str, object]] = []
    next_url: str | None = url

    # CBS OData paginates — follow @odata.nextLink until exhausted.
    with httpx.Client(timeout=60.0) as client:
        while next_url:
            response = client.get(next_url)
            response.raise_for_status()
            payload = response.json()
            rows.extend(payload.get("value", []))
            next_url = payload.get("odata.nextLink")

    return rows


def normalize_rows(raw_rows: list[dict[str, object]]) -> list[dict[str, str]]:
    """
    Filter and normalize rows to (gemeente_code, provincie_code) pairs.

    - Strip whitespace from code fields (CBS pads with trailing spaces)
    - Gemeente code is in Code_1 (starts with 'GM')
    - Provincie code is in Code_28 (starts with 'PV') — NOT Code_4
      (which is the COROP/arbeidsmarktregio area, prefixed 'AM').
      Code_28 is the official provincie (PV##) field in table 85385NED.
    - Filter for rows where gemeente code starts with 'GM' and provincie
      code starts with 'PV' (drops empty rows and non-gemeente entries)
    - Deduplicate by gemeente_code (CBS may have multiple rows per
      gemeente for historical reasons)
    """
    seen: dict[str, str] = {}

    for row in raw_rows:
        gemeente_raw = str(row.get("Code_1") or "")
        provincie_raw = str(row.get("Code_28") or "")

        gemeente = gemeente_raw.strip()
        provincie = provincie_raw.strip()

        if not gemeente.startswith("GM") or not provincie.startswith("PV"):
            continue

        # First occurrence wins if duplicates exist
        if gemeente not in seen:
            seen[gemeente] = provincie

    return [
        {"gemeente_code": gc, "provincie_code": pc}
        for gc, pc in sorted(seen.items())
    ]


def main() -> int:
    print(f"Fetching CBS table {CBS_TABLE_ID}...", file=sys.stderr)
    try:
        raw_rows = fetch_raw_rows()
    except httpx.HTTPError as exc:
        print(f"FAILED: CBS fetch error: {exc}", file=sys.stderr)
        return 1

    print(f"  {len(raw_rows)} raw rows", file=sys.stderr)

    mapping = normalize_rows(raw_rows)
    print(
        f"  {len(mapping)} unique (gemeente, provincie) pairs after filtering",
        file=sys.stderr,
    )

    if len(mapping) < 300:
        print(
            f"WARNING: expected ~350 rows, got {len(mapping)}. "
            "Verify the CBS table hasn't changed schema.",
            file=sys.stderr,
        )

    # Sanity checks: a few known gemeentes must be present
    sanity_checks = {
        "GM0983": "PV31",  # Venlo → Limburg
        "GM0363": "PV27",  # Amsterdam → Noord-Holland
        "GM0518": "PV28",  # Den Haag → Zuid-Holland
        "GM0344": "PV26",  # Utrecht → Utrecht
    }
    mapping_dict = {item["gemeente_code"]: item["provincie_code"] for item in mapping}
    for gc, expected_pc in sanity_checks.items():
        actual = mapping_dict.get(gc)
        if actual is None:
            print(
                f"WARNING: sanity check gemeente {gc} not in output — "
                "boundaries may have changed",
                file=sys.stderr,
            )
        elif actual != expected_pc:
            print(
                f"WARNING: sanity check {gc} expected {expected_pc}, got {actual}",
                file=sys.stderr,
            )

    OUTPUT_PATH.write_text(
        json.dumps(mapping, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_PATH} ({len(mapping)} rows)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
