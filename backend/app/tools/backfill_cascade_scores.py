"""Recompute scan_results score_breakdown with cascade factors (woonvisie_match).

Zero-cost approach: reads the woonvisie payload once from factor_extraction_cache
(a gemeente-level document produces identical payload for every parcel), then
applies it directly to all scan_results without any Claude API calls.

Usage:
    python -m app.tools.backfill_cascade_scores --gemeente GM0983
    python -m app.tools.backfill_cascade_scores --gemeente GM0983 --dry-run
    python -m app.tools.backfill_cascade_scores --gemeente GM0983 --organization-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import time
import uuid
from dataclasses import asdict

from sqlalchemy import func, select, text

from app.ai.factor_extraction_schemas import SCHEMA_VERSION
from app.ai.factors.woonvisie_match import WoonvisiePayload
from app.core.database import async_session_factory
from app.models.area_scan import AreaScan
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.policy_document import PolicyDocument
from app.models.scan_result import ScanResult
from app.services.score_v3 import compute_score_v3

logger = logging.getLogger(__name__)


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid UUID: {value}") from exc


async def _resolve_org_id(target_org_id: uuid.UUID | None) -> uuid.UUID | None:
    async with async_session_factory() as session:
        if target_org_id is not None:
            row = await session.execute(
                select(Organization.id).where(Organization.id == target_org_id)
            )
            return row.scalar_one_or_none()

        rows = (await session.execute(select(Organization.id))).scalars().all()
        if len(rows) == 1:
            return rows[0]
        logger.error(
            "Multiple organizations found — pass --organization-id explicitly. Found: %s", rows
        )
        return None


async def _load_woonvisie_payload(
    gemeente_code: str,
    org_id: uuid.UUID,
) -> WoonvisiePayload | None:
    """Fetch the woonvisie payload from cache (one entry is enough — all are identical).

    The woonvisie document is gemeente-level; the extracted payload doesn't
    depend on the specific parcel. We reuse one cached extraction for all parcels.
    """
    async with async_session_factory() as session:
        doc_stmt = (
            select(PolicyDocument)
            .where(
                PolicyDocument.entity_type == "gemeente",
                PolicyDocument.entity_code == gemeente_code,
                PolicyDocument.source_key == "woonvisie",
                PolicyDocument.organization_id == org_id,
                PolicyDocument.file_data.isnot(None),
            )
            .order_by(PolicyDocument.version_number.desc(), PolicyDocument.created_at.desc())
            .limit(1)
        )
        doc = (await session.execute(doc_stmt)).scalar_one_or_none()
        if doc is None:
            logger.error("No woonvisie document found for gemeente=%s org=%s", gemeente_code, org_id)
            return None

        cache_stmt = (
            select(FactorExtractionCache)
            .where(
                FactorExtractionCache.policy_document_id == doc.id,
                FactorExtractionCache.factor_id == "woonvisie_match",
                FactorExtractionCache.schema_version == SCHEMA_VERSION,
            )
            .limit(1)
        )
        cached = (await session.execute(cache_stmt)).scalar_one_or_none()
        if cached is None:
            logger.error(
                "No cached woonvisie_match extraction at SCHEMA_VERSION=%s for doc=%s "
                "— run rescore_cascade_job first to refresh the cache",
                SCHEMA_VERSION,
                doc.id,
            )
            return None

        try:
            payload = WoonvisiePayload.model_validate(cached.extracted_payload)
            logger.info(
                "Loaded woonvisie payload from cache: doc=%s parcel=%s extracted_at=%s",
                doc.id, cached.parcel_id, cached.extracted_at,
            )
            return payload
        except Exception:
            logger.exception("Failed to parse cached woonvisie payload from doc=%s", doc.id)
            return None


async def _backfill_gemeente(
    gemeente_code: str,
    org_id: uuid.UUID,
    woonvisie_payload: WoonvisiePayload,
    *,
    batch_size: int,
    dry_run: bool,
) -> tuple[int, int]:
    """Backfill scan_results for a gemeente. Returns (processed, updated)."""
    processed = 0
    updated = 0

    cascade_payloads = {"woonvisie_match": woonvisie_payload}

    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

        last_id: uuid.UUID | None = None
        batch_num = 0

        while True:
            batch_start = time.monotonic()
            batch_num += 1

            stmt = (
                select(
                    ScanResult,
                    ParcelCache,
                    AreaScan.wijk_naam,
                    func.ST_Perimeter(ParcelCache.geometry).label("perimeter_m"),
                )
                .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
                .join(AreaScan, AreaScan.id == ScanResult.scan_id)
                .where(ParcelCache.gemeente_code == gemeente_code)
                .order_by(ScanResult.id)
                .limit(batch_size)
            )
            if last_id is not None:
                stmt = stmt.where(ScanResult.id > last_id)

            rows = (await session.execute(stmt)).all()
            if not rows:
                break

            # Load neighborhood_metrics for unique scan_ids in batch
            unique_scan_ids = {sr.scan_id for sr, _pc, _wn, _pm in rows}
            nbhd_rows = (await session.execute(
                select(AreaScan.id, AreaScan.neighborhood_metrics)
                .where(AreaScan.id.in_(unique_scan_ids))
            )).all()
            nbhd_map = {row[0]: row[1] for row in nbhd_rows if row[1] is not None}

            batch_updated = 0
            for sr, pc, wijk_naam, perimeter_m in rows:
                processed += 1
                flags = dict(sr.flags) if sr.flags else {}

                parcel_data: dict = {
                    "parcel_id": str(pc.parcel_id),
                    "area_m2": pc.area_m2,
                    "perimeter_m": float(perimeter_m) if perimeter_m is not None else None,
                    "has_pand": pc.has_pand,
                    "bouwjaar": pc.bouwjaar,
                    "pand_status": pc.pand_status,
                    "bestemmingen": pc.bestemmingen,
                    "wijk_naam": wijk_naam,
                    "vacancy_signal": flags.get("vacancy_signal"),
                    "building_metrics": flags.get("building_metrics", {}),
                    "market_signals": flags.get("market_signals"),
                    "bodem": flags.get("bodem"),
                    "bodemtype": flags.get("bodemtype"),
                    "funderingsrisico": flags.get("funderingsrisico"),
                    "energielabel": flags.get("energielabel"),
                    "vergunningen": flags.get("vergunningen"),
                    "natura2000": flags.get("natura2000"),
                    "overstromingsrisico": flags.get("overstromingsrisico"),
                    "geluid": flags.get("geluid"),
                    "luchtkwaliteit": flags.get("luchtkwaliteit"),
                    "woz": flags.get("woz"),
                    "rijksmonument": flags.get("rijksmonument"),
                }

                v3_result = compute_score_v3(
                    parcel_data,
                    nbhd_map.get(sr.scan_id),
                    project_type="onbepaald",
                    cascade_payloads=cascade_payloads,
                )

                overall_clamped = max(0.0, min(100.0, v3_result.overall))

                flags["scores"] = {
                    "potentie": v3_result.potentie_score,
                    "risico": v3_result.risico_score,
                    "overall": v3_result.overall,
                }
                flags["score_breakdown"] = {
                    name: asdict(factor)
                    for name, factor in v3_result.score_breakdown.items()
                }
                flags["score_model_version"] = "score-v3.0"
                flags["category"] = v3_result.category

                if not dry_run:
                    sr.score = overall_clamped
                    sr.flags = flags
                    session.add(sr)

                batch_updated += 1
                updated += 1

            if not dry_run and batch_updated > 0:
                await session.flush()
                await session.commit()

            elapsed = time.monotonic() - batch_start
            last_id = rows[-1][0].id
            logger.info(
                "Batch %d: %d rows processed, %d updated, %.1fs",
                batch_num, len(rows), batch_updated, elapsed,
            )

    return processed, updated


async def _run(
    *,
    gemeente_code: str,
    organization_id: uuid.UUID | None,
    batch_size: int,
    dry_run: bool,
) -> int:
    org_id = await _resolve_org_id(organization_id)
    if org_id is None:
        return 1

    payload = await _load_woonvisie_payload(gemeente_code, org_id)
    if payload is None:
        return 1

    mode = "DRY RUN" if dry_run else "LIVE"
    logger.info(
        "Starting cascade score backfill (%s): gemeente=%s org=%s batch_size=%d — 0 Claude calls",
        mode, gemeente_code, org_id, batch_size,
    )

    processed, updated = await _backfill_gemeente(
        gemeente_code, org_id, payload, batch_size=batch_size, dry_run=dry_run
    )

    logger.info(
        "Cascade backfill complete: processed=%d updated=%d",
        processed, updated,
    )
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Backfill scan_results score_breakdown with woonvisie_match (zero Claude calls).",
    )
    parser.add_argument(
        "--gemeente",
        default="GM0983",
        help="Gemeente code to backfill (default: GM0983 = Venlo)",
    )
    parser.add_argument(
        "--organization-id",
        type=_parse_uuid,
        help="Optional organization UUID (required when multiple orgs exist)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Batch size for pagination (default: 200)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and log without writing to database",
    )
    return parser


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )

    parser = _build_parser()
    args = parser.parse_args()

    if args.batch_size < 1:
        parser.error("--batch-size must be >= 1")

    exit_code = asyncio.run(
        _run(
            gemeente_code=args.gemeente,
            organization_id=args.organization_id,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
