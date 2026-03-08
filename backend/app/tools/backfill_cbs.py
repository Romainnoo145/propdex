"""Backfill CBS neighborhood_metrics for completed area scans.

Usage:
    python -m app.tools.backfill_cbs                  # all scans missing metrics
    python -m app.tools.backfill_cbs --gemeente Venlo  # filter by gemeente
    python -m app.tools.backfill_cbs --force           # re-fetch even if metrics exist
"""

import argparse
import asyncio
import logging

import httpx
from sqlalchemy import select

from app.core.database import async_session_factory
from app.government_apis.cbs_crime import cbs_crime_client
from app.government_apis.cbs_odata import cbs_client
from app.models.area_scan import AreaScan

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def backfill(gemeente: str | None = None, force: bool = False) -> None:
    async with async_session_factory() as session:
        stmt = select(AreaScan).where(AreaScan.status.in_(["completed", "completed_with_warnings"]))

        if gemeente:
            stmt = stmt.where(AreaScan.gemeente_naam.ilike(f"%{gemeente}%"))

        if not force:
            stmt = stmt.where(AreaScan.neighborhood_metrics.is_(None))

        scans = (await session.execute(stmt)).scalars().all()
        logger.info("Found %d scans to backfill", len(scans))

        if not scans:
            return

        async with httpx.AsyncClient() as http:
            for i, scan in enumerate(scans, 1):
                logger.info(
                    "[%d/%d] %s — %s (%s)",
                    i, len(scans), scan.gemeente_naam, scan.wijk_naam, scan.gemeente_code,
                )

                # 1. Core neighborhood metrics
                try:
                    cbs_data = await cbs_client.get_neighborhood_data(
                        client=http,
                        gemeente_naam=scan.gemeente_naam,
                        wijk_naam=scan.wijk_naam,
                        gemeente_code=scan.gemeente_code,
                    )
                    scan.neighborhood_metrics = cbs_data
                    if cbs_data:
                        logger.info("  CBS metrics OK")
                    else:
                        logger.warning("  CBS metrics: no data found")
                except Exception as e:
                    logger.warning("  CBS metrics failed: %s", e)

                # 2. Nabijheid (proximity)
                try:
                    nabijheid_data = await cbs_client.get_nabijheid_data(
                        client=http,
                        gemeente_naam=scan.gemeente_naam,
                        wijk_naam=scan.wijk_naam,
                        gemeente_code=scan.gemeente_code,
                    )
                    if nabijheid_data:
                        if scan.neighborhood_metrics:
                            scan.neighborhood_metrics = {
                                **scan.neighborhood_metrics,
                                "nabijheid": nabijheid_data,
                            }
                        else:
                            scan.neighborhood_metrics = {"nabijheid": nabijheid_data}
                        logger.info("  CBS nabijheid OK")
                except Exception as e:
                    logger.warning("  CBS nabijheid failed: %s", e)

                # 3. Crime data
                try:
                    aantal_inwoners = (
                        scan.neighborhood_metrics.get("data", {}).get("demografie", {}).get("aantal_inwoners")
                        if scan.neighborhood_metrics
                        else None
                    )
                    crime_data = await cbs_crime_client.get_crime_data(
                        client=http,
                        gemeente_code=scan.gemeente_code,
                        wijk_naam=scan.wijk_naam,
                        inwoners=aantal_inwoners,
                    )
                    if crime_data:
                        if scan.neighborhood_metrics:
                            scan.neighborhood_metrics = {
                                **scan.neighborhood_metrics,
                                "criminaliteit": crime_data,
                            }
                        else:
                            scan.neighborhood_metrics = {"criminaliteit": crime_data}
                        logger.info("  CBS crime OK")
                except Exception as e:
                    logger.warning("  CBS crime failed: %s", e)

                session.add(scan)

            await session.commit()
            logger.info("Done — committed %d scans", len(scans))


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill CBS neighborhood_metrics")
    parser.add_argument("--gemeente", help="Filter by gemeente name (case-insensitive)")
    parser.add_argument("--force", action="store_true", help="Re-fetch even if metrics exist")
    args = parser.parse_args()
    asyncio.run(backfill(gemeente=args.gemeente, force=args.force))


if __name__ == "__main__":
    main()
