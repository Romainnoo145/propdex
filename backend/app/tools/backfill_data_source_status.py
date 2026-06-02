"""Backfill data_source_status for type-B (open API) sources.

Runs the liveness probe for every gemeente that has completed scans, so the M049
data-hub panel reflects reality (live APIs show `live` instead of the empty-table
default of `missing`). Idempotent: re-running just refreshes last_checked.

Usage:
    python -m app.tools.backfill_data_source_status
    python -m app.tools.backfill_data_source_status --dry-run
    python -m app.tools.backfill_data_source_status --gemeente GM0983
"""

from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import text

from app.admin.data_source_probe import probe_gemeente
from app.core.database import async_session_factory

logger = logging.getLogger(__name__)


async def run(dry_run: bool, only_gemeente: str | None) -> None:
    async with async_session_factory() as session:
        if only_gemeente:
            gemeenten = [only_gemeente]
        else:
            rows = (
                await session.execute(
                    text(
                        "select distinct gemeente_code from area_scans "
                        "where status = 'completed' order by 1"
                    )
                )
            ).scalars().all()
            gemeenten = list(rows)

        logger.info("Probing %d gemeente(n): %s", len(gemeenten), gemeenten)

        for gc in gemeenten:
            results = await probe_gemeente(session, gc)
            live = sorted(k for k, v in results.items() if v == "live")
            missing = sorted(k for k, v in results.items() if v != "live")
            logger.info("%s — live %d/%d: %s", gc, len(live), len(results), live)
            logger.info("%s — not live: %s", gc, missing)

        if dry_run:
            await session.rollback()
            logger.info("DRY-RUN — rolled back, no writes.")
        else:
            await session.commit()
            logger.info("Committed data_source_status updates.")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--gemeente", default=None, help="only this gemeente_code")
    args = ap.parse_args()
    asyncio.run(run(dry_run=args.dry_run, only_gemeente=args.gemeente))


if __name__ == "__main__":
    main()
