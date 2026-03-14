"""Backfill existing saved reports with scan flags enrichment data.

Finds all saved_reports that have a source_parcel_id but lack scores_v3
in their report_data, looks up the latest scan_results.flags for that parcel,
and merges the enrichment fields into the report.

Usage:
    python -m app.tools.backfill_report_enrichment [--dry-run]
"""

import argparse
import asyncio
import logging

from sqlalchemy import select, update

from app.core.database import async_session_factory
from app.models.area_scan import AreaScan
from app.models.report import SavedReport
from app.models.scan_result import ScanResult
from app.reports.flags_assembler import assemble_enrichment_from_flags, build_flags_section_sources

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


async def backfill_reports(dry_run: bool = False) -> None:
    async with async_session_factory() as db:
        # Find all active reports with a linked parcel
        reports_q = select(SavedReport).where(
            SavedReport.deleted_at.is_(None),
            SavedReport.source_parcel_id.isnot(None),
        )
        reports = (await db.execute(reports_q)).scalars().all()
        logger.info("Found %d active reports with source_parcel_id", len(reports))

        enriched = 0
        skipped = 0
        no_flags = 0

        for report in reports:
            report_data = report.report_data or {}

            # Already enriched?
            if report_data.get("scores_v3") is not None:
                skipped += 1
                continue

            # Look up best scan flags for this parcel
            flags_q = (
                select(ScanResult.flags, ScanResult.created_at)
                .join(AreaScan, ScanResult.scan_id == AreaScan.id)
                .where(
                    ScanResult.parcel_id == report.source_parcel_id,
                    ScanResult.organization_id == report.organization_id,
                    AreaScan.status == "completed",
                )
                .order_by(ScanResult.created_at.desc())
                .limit(1)
            )
            flags_row = (await db.execute(flags_q)).one_or_none()

            if flags_row is None or not flags_row[0] or not isinstance(flags_row[0], dict):
                no_flags += 1
                logger.info(
                    "  SKIP %s — no scan flags (%s)",
                    report.report_name,
                    report.source_parcel_id,
                )
                continue

            scan_flags, scan_created_at = flags_row

            # Merge enrichment into report_data
            enrichment = assemble_enrichment_from_flags(scan_flags)
            updated_data = {**report_data}
            updated_data.update({k: v for k, v in enrichment.items() if v is not None})

            # Add section sources
            flag_sources = build_flags_section_sources(scan_flags, scan_created_at)
            existing_sources = updated_data.get("section_sources") or []
            existing_sources.extend([s.model_dump(mode="json") for s in flag_sources])
            updated_data["section_sources"] = existing_sources

            if dry_run:
                keys_added = [k for k, v in enrichment.items() if v is not None]
                logger.info(
                    "  DRY-RUN %s — would add: %s",
                    report.report_name,
                    ", ".join(keys_added),
                )
            else:
                await db.execute(
                    update(SavedReport)
                    .where(SavedReport.id == report.id)
                    .values(report_data=updated_data)
                )
                logger.info("  ENRICHED %s", report.report_name)

            enriched += 1

        if not dry_run:
            await db.commit()

        logger.info(
            "Done — enriched: %d, already enriched: %d, no flags: %d, total: %d",
            enriched,
            skipped,
            no_flags,
            len(reports),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill reports with scan flags enrichment")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()
    asyncio.run(backfill_reports(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
