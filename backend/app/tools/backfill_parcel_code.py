"""Backfill parcel_code for existing parcel_cache rows via PDOK WFS batch lookup.

Phase 1: Populate parcel_cache.parcel_code from PDOK WFS using the BRK numeric
         identificatie stored in parcel_id.

Phase 2: Populate parcel_favorites.parcel_cache_id FK by joining on
         parcel_favorites.parcel_id = parcel_cache.parcel_code.

Usage:
    python -m app.tools.backfill_parcel_code [--gemeente GM0983] [--dry-run] [--batch-size 200]

Options:
    --gemeente GM0983    Optional filter by gemeente_code (GM prefix stripped internally)
    --dry-run            Log planned actions without writing to the database
    --batch-size 200     Number of rows per processing batch (default: 200)
"""

from __future__ import annotations

import argparse
import asyncio
import re
import uuid
from dataclasses import dataclass, field

from sqlalchemy import select, text, update as sa_update

from app.core.database import async_session_factory
from app.core.http_client import create_government_api_client
from app.models.parcel_cache import ParcelCache

# PDOK Kadaster WFS endpoint for perceel data
PDOK_WFS_URL = "https://service.pdok.nl/kadaster/kadastralekaart/wfs/v5_0"

# Pattern: pure numeric identificatie (BRK format, e.g. "0983100000006658")
_NUMERIC_RE = re.compile(r"^\d+$")

# Max concurrent PDOK requests — polite to PDOK infrastructure
_SEMAPHORE_LIMIT = 10

# Sleep between batches (seconds) — rate-limit courtesy
_BATCH_SLEEP = 0.5


@dataclass(slots=True)
class BackfillStats:
    total_inspected: int = 0
    code_resolved: int = 0
    code_skipped_non_numeric: int = 0
    code_failed_pdok: int = 0
    favorites_fk_updated: int = 0
    favorites_fk_unmatched: int = 0
    batches_processed: int = 0
    errors: list[str] = field(default_factory=list)


async def _fetch_parcel_display_code(
    identificatie: str,
    client,  # httpx.AsyncClient
    semaphore: asyncio.Semaphore,
) -> str | None:
    """Fetch human-readable display string from PDOK WFS by BRK identificatie.

    Returns display string like "Venlo I 6658" or None on failure.
    """
    async with semaphore:
        try:
            response = await client.get(
                PDOK_WFS_URL,
                params={
                    "service": "WFS",
                    "version": "2.0.0",
                    "request": "GetFeature",
                    "typeName": "kadastralekaart:Perceel",
                    "CQL_FILTER": f"identificatie='{identificatie}'",
                    "outputFormat": "application/json",
                    "count": "1",
                },
                timeout=15.0,
            )
            if response.status_code >= 400:
                return None
            data = response.json()
            features = data.get("features") or []
            if not features:
                return None
            props = features[0].get("properties") or {}
            gemeente = (props.get("kadastrale_gemeente_waarde") or "").strip()
            sectie = (props.get("sectie") or "").strip()
            perceelnummer = props.get("perceelnummer")
            if not gemeente or not sectie or perceelnummer is None:
                return None
            return f"{gemeente} {sectie} {perceelnummer}"
        except Exception:  # noqa: BLE001
            return None


async def _backfill_phase1(
    *,
    gemeente_code: str | None,
    batch_size: int,
    dry_run: bool,
    stats: BackfillStats,
) -> None:
    """Phase 1: Populate parcel_cache.parcel_code from PDOK WFS lookup."""
    semaphore = asyncio.Semaphore(_SEMAPHORE_LIMIT)
    client = create_government_api_client()

    try:
        last_id: uuid.UUID | None = None
        batch_num = 0

        while True:
            # Fetch a batch of rows with parcel_code IS NULL
            async with async_session_factory() as session:
                stmt = (
                    select(ParcelCache.id, ParcelCache.parcel_id)
                    .where(ParcelCache.parcel_code.is_(None))
                    .order_by(ParcelCache.id)
                    .limit(batch_size)
                )
                if gemeente_code is not None:
                    stmt = stmt.where(ParcelCache.gemeente_code == gemeente_code)
                if last_id is not None:
                    stmt = stmt.where(ParcelCache.id > last_id)

                rows = (await session.execute(stmt)).all()

            if not rows:
                break

            batch_num += 1
            batch_resolved = 0
            batch_skipped = 0
            batch_failed = 0

            # Resolve display codes concurrently within the batch
            async def _resolve_one(
                row_id: uuid.UUID,
                parcel_id: str,
            ) -> tuple[uuid.UUID, str | None, str]:
                """Returns (id, parcel_code_or_none, status)."""
                if not _NUMERIC_RE.match(parcel_id):
                    return (row_id, None, "skipped")
                code = await _fetch_parcel_display_code(parcel_id, client, semaphore)
                if code is None:
                    return (row_id, None, "failed")
                return (row_id, code, "resolved")

            tasks = [_resolve_one(r[0], r[1]) for r in rows]
            results = await asyncio.gather(*tasks)

            updates: list[dict] = []
            for row_id, code, status in results:
                stats.total_inspected += 1
                if status == "skipped":
                    batch_skipped += 1
                    stats.code_skipped_non_numeric += 1
                elif status == "failed":
                    batch_failed += 1
                    stats.code_failed_pdok += 1
                else:
                    batch_resolved += 1
                    stats.code_resolved += 1
                    if code is not None:
                        updates.append({"row_id": row_id, "code": code})

            # Commit batch updates
            if updates and not dry_run:
                try:
                    async with async_session_factory() as session:
                        for item in updates:
                            await session.execute(
                                sa_update(ParcelCache)
                                .where(ParcelCache.id == item["row_id"])
                                .values(parcel_code=item["code"])
                            )
                        await session.commit()
                except Exception as exc:  # noqa: BLE001
                    stats.errors.append(f"Batch {batch_num} DB error: {exc}")

            stats.batches_processed += 1
            last_id = rows[-1][0]

            # Estimate total for progress display
            print(
                f"Batch {batch_num}: "
                f"{batch_resolved} resolved, "
                f"{batch_skipped} skipped (non-numeric), "
                f"{batch_failed} PDOK failures"
                + (" [DRY RUN]" if dry_run else "")
            )

            await asyncio.sleep(_BATCH_SLEEP)

    finally:
        await client.aclose()


async def _backfill_phase2(
    *,
    dry_run: bool,
    stats: BackfillStats,
) -> None:
    """Phase 2: Populate parcel_favorites.parcel_cache_id by joining on parcel_code."""
    # Use raw SQL for the UPDATE ... FROM join pattern
    update_sql = text("""
        UPDATE parcel_favorites pf
        SET parcel_cache_id = pc.id
        FROM parcel_cache pc
        WHERE pf.parcel_id = pc.parcel_code
          AND pf.organization_id = pc.organization_id
          AND pf.parcel_cache_id IS NULL
    """)

    unmatched_sql = text("""
        SELECT COUNT(*) FROM parcel_favorites
        WHERE parcel_cache_id IS NULL
    """)

    if dry_run:
        async with async_session_factory() as session:
            result = await session.execute(
                text("""
                    SELECT COUNT(*) FROM parcel_favorites pf
                    JOIN parcel_cache pc
                      ON pf.parcel_id = pc.parcel_code
                     AND pf.organization_id = pc.organization_id
                    WHERE pf.parcel_cache_id IS NULL
                """)
            )
            would_update = result.scalar_one()
            print(
                f"[DRY RUN] Phase 2: would update {would_update} favorites with parcel_cache_id FK"
            )
        return

    async with async_session_factory() as session:
        result = await session.execute(update_sql)
        updated = result.rowcount
        await session.commit()
        stats.favorites_fk_updated = updated
        print(f"Updated {updated} favorites with parcel_cache_id FK")

    async with async_session_factory() as session:
        result = await session.execute(unmatched_sql)
        unmatched = result.scalar_one()
        stats.favorites_fk_unmatched = unmatched
        if unmatched > 0:
            print(
                f"WARNING: {unmatched} favorites still have no parcel_cache_id "
                "(parcel_code not found in cache — may be non-numeric IDs or not yet scanned)"
            )


async def _run(
    *,
    gemeente: str | None,
    batch_size: int,
    dry_run: bool,
) -> int:
    """Run both phases of the parcel_code backfill."""
    # Strip GM prefix if provided (DB stores without prefix)
    gemeente_code: str | None = None
    if gemeente is not None:
        gemeente_code = gemeente.removeprefix("GM")

    stats = BackfillStats()

    print(
        f"Starting parcel_code backfill: "
        f"gemeente_code={gemeente_code}, batch_size={batch_size}, dry_run={dry_run}"
    )
    print()

    # Phase 1: PDOK WFS lookup → parcel_code
    print("=== Phase 1: Populate parcel_cache.parcel_code ===")
    await _backfill_phase1(
        gemeente_code=gemeente_code,
        batch_size=batch_size,
        dry_run=dry_run,
        stats=stats,
    )
    print()

    # Phase 2: JOIN parcel_favorites.parcel_id to parcel_cache.parcel_code
    print("=== Phase 2: Populate parcel_favorites.parcel_cache_id ===")
    await _backfill_phase2(dry_run=dry_run, stats=stats)
    print()

    # Final stats
    print("Backfill complete:")
    print(f"  Total rows inspected:              {stats.total_inspected}")
    print(f"  parcel_code resolved:              {stats.code_resolved}")
    print(f"  parcel_code skipped (non-numeric): {stats.code_skipped_non_numeric}")
    print(f"  parcel_code failed (PDOK error):   {stats.code_failed_pdok}")
    print(f"  favorites FK updated:              {stats.favorites_fk_updated}")
    print(f"  favorites FK unmatched:            {stats.favorites_fk_unmatched}")
    print(f"  Batches processed:                 {stats.batches_processed}")

    if stats.errors:
        print(f"\n  Errors encountered ({len(stats.errors)}):")
        for err in stats.errors:
            print(f"    - {err}")

    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Backfill parcel_code for existing parcel_cache rows via PDOK WFS, "
            "then populate parcel_favorites.parcel_cache_id FK by joining on parcel_code."
        )
    )
    parser.add_argument(
        "--gemeente",
        help="Optional gemeente_code filter (with GM prefix, e.g. GM0983)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Rows per PDOK batch (default: 200)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log planned actions without writing to the database",
    )
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.batch_size < 1:
        parser.error("--batch-size must be >= 1")

    exit_code = asyncio.run(
        _run(
            gemeente=args.gemeente,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
