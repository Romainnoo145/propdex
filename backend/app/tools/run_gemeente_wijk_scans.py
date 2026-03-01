"""Run wijk scans sequentially for a gemeente.

Usage:
    python -m app.tools.run_gemeente_wijk_scans --gemeente-code GM0983 --gemeente-naam Venlo
    python -m app.tools.run_gemeente_wijk_scans --gemeente-code GM0983 --gemeente-naam Venlo --force-failed
    python -m app.tools.run_gemeente_wijk_scans --gemeente-code GM0983 --gemeente-naam Venlo --force-all
"""

from __future__ import annotations

import argparse
import asyncio
import re
import uuid
from dataclasses import dataclass

from arq import create_pool
from shapely.geometry import shape
from sqlalchemy import func as sqla_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.http_client import create_government_api_client
from app.jobs.worker import get_redis_settings
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.scan_result import ScanResult
from app.scans import service as scan_service
from app.services.spatial_helpers import transform_bbox_to_rd
from app.services.wijk_service import get_wijken_in_gemeente


@dataclass(slots=True)
class WijkQueueItem:
    wijk_naam: str
    action: str
    scan_id: str | None = None


@dataclass(slots=True)
class WijkOutcome:
    wijk_naam: str
    status: str
    parcel_count: int = 0
    coverage_ratio: float | None = None
    address_resolution_ratio: float | None = None


def _normalize_area_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold().replace("’", "").replace("'", "")).strip()


def _resolve_wijk_bbox_from_geojson(
    geojson: dict,
    wijk_naam: str,
) -> tuple[float, float, float, float]:
    target = _normalize_area_name(wijk_naam)
    features = geojson.get("features", []) if isinstance(geojson, dict) else []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        props = feature.get("properties", {}) or {}
        statnaam = props.get("statnaam")
        if isinstance(statnaam, str) and _normalize_area_name(statnaam) == target:
            geometry = feature.get("geometry")
            if not isinstance(geometry, dict):
                break
            min_lon, min_lat, max_lon, max_lat = shape(geometry).bounds
            return (min_lon, min_lat, max_lon, max_lat)
    raise ValueError(f"Wijk bbox not found for {wijk_naam}")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run gemeente wijkscans sequentially through the normal ARQ queue.",
    )
    parser.add_argument(
        "--gemeente-code",
        required=True,
        help="CBS gemeentecode, e.g. GM0983",
    )
    parser.add_argument(
        "--gemeente-naam",
        required=True,
        help="Display name, e.g. Venlo",
    )
    parser.add_argument(
        "--organization-id",
        default=None,
        help="Tenant organization UUID. Defaults to the first organization in the database.",
    )
    parser.add_argument(
        "--force-failed",
        action="store_true",
        help="Re-run wijken with a latest failed scan.",
    )
    parser.add_argument(
        "--force-all",
        action="store_true",
        help="Re-run all finished wijken, including completed scans, for a homogeneous dataset pass.",
    )
    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=10,
        help="Polling interval while waiting for a scan to finish.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the planned queue without enqueuing scans.",
    )
    return parser.parse_args()


async def _resolve_organization_id(
    session_factory: async_sessionmaker,
    explicit_id: str | None,
) -> uuid.UUID:
    async with session_factory() as session:
        if explicit_id:
            org = await session.get(Organization, uuid.UUID(explicit_id))
            if org is None:
                raise ValueError(f"Organization not found: {explicit_id}")
            return org.id

        result = await session.execute(select(Organization).order_by(Organization.id).limit(1))
        org = result.scalar_one_or_none()
        if org is None:
            raise ValueError("No organizations found in database")
        return org.id


async def _resolve_wijken_geojson(gemeente_code: str) -> dict:
    client = create_government_api_client()
    try:
        return await get_wijken_in_gemeente(gemeente_code, client)
    finally:
        await client.aclose()


async def _latest_scan_for_wijk(
    session_factory: async_sessionmaker,
    org_id: uuid.UUID,
    gemeente_code: str,
    wijk_naam: str,
) -> AreaScan | None:
    async with session_factory() as session:
        result = await session.execute(
            select(AreaScan)
            .where(
                AreaScan.organization_id == org_id,
                AreaScan.gemeente_code == gemeente_code,
                AreaScan.wijk_naam == wijk_naam,
            )
            .order_by(AreaScan.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()


async def _build_queue(
    session_factory: async_sessionmaker,
    org_id: uuid.UUID,
    gemeente_code: str,
    wijk_names: list[str],
    force_failed: bool,
    force_all: bool,
) -> list[WijkQueueItem]:
    queue: list[WijkQueueItem] = []
    for wijk_naam in wijk_names:
        latest_scan = await _latest_scan_for_wijk(session_factory, org_id, gemeente_code, wijk_naam)
        if latest_scan and latest_scan.status in {"completed", "completed_with_warnings"}:
            if force_all:
                queue.append(WijkQueueItem(wijk_naam=wijk_naam, action="rescan", scan_id=str(latest_scan.id)))
                continue
            queue.append(WijkQueueItem(wijk_naam=wijk_naam, action="skip_completed", scan_id=str(latest_scan.id)))
            continue
        if latest_scan and latest_scan.status in {"pending", "running"}:
            if force_all:
                queue.append(WijkQueueItem(wijk_naam=wijk_naam, action="rescan", scan_id=str(latest_scan.id)))
                continue
            queue.append(WijkQueueItem(wijk_naam=wijk_naam, action="skip_in_progress", scan_id=str(latest_scan.id)))
            continue
        if latest_scan and latest_scan.status in {"failed", "cancelled"} and (force_failed or force_all):
            queue.append(WijkQueueItem(wijk_naam=wijk_naam, action="rescan", scan_id=str(latest_scan.id)))
            continue
        if latest_scan and latest_scan.status in {"failed", "cancelled"} and not (force_failed or force_all):
            queue.append(WijkQueueItem(wijk_naam=wijk_naam, action="skip_failed", scan_id=str(latest_scan.id)))
            continue
        queue.append(WijkQueueItem(wijk_naam=wijk_naam, action="enqueue"))
    return queue


async def _enqueue_scan(
    session_factory: async_sessionmaker,
    arq_pool,
    org_id: uuid.UUID,
    gemeente_code: str,
    gemeente_naam: str,
    wijk_naam: str,
    wijk_bbox_wgs84: tuple[float, float, float, float],
    existing_scan_id: str | None = None,
) -> str:
    async with session_factory() as session:
        minx, miny, maxx, maxy = transform_bbox_to_rd(*wijk_bbox_wgs84)
        if existing_scan_id is not None:
            existing_scan = await session.get(AreaScan, uuid.UUID(existing_scan_id))
            if existing_scan is None:
                raise ValueError(f"Existing scan not found: {existing_scan_id}")
            count_result = await session.execute(
                select(sqla_func.count(ScanResult.id)).where(ScanResult.scan_id == existing_scan.id)
            )
            existing_count = count_result.scalar() or 0
            print(f"  FORCE MODE: Deleting {existing_count} existing results for {wijk_naam}")
            scan = await scan_service.reset_scan_for_rescan(existing_scan, session)
        else:
            scan = await scan_service.create_scan(
                organization_id=org_id,
                gemeente_code=gemeente_code,
                gemeente_naam=gemeente_naam,
                bbox={
                    "minx": minx,
                    "miny": miny,
                    "maxx": maxx,
                    "maxy": maxy,
                },
                session=session,
                wijk_naam=wijk_naam,
            )
        job = await arq_pool.enqueue_job(
            "area_scan_job",
            str(scan.id),
            str(org_id),
        )
        scan.job_id = job.job_id
        session.add(scan)
        await session.flush()
        await session.commit()
        return str(scan.id)


async def _wait_for_scan(session_factory: async_sessionmaker, scan_id: str, poll_seconds: int) -> str:
    while True:
        async with session_factory() as session:
            scan = await session.get(AreaScan, scan_id)
            if scan is None:
                raise ValueError(f"Scan disappeared: {scan_id}")
            status = scan.status
            progress = scan.progress_pct
            phase = scan.current_phase or ""
            phase_label = f" ({phase})" if phase else ""
            print(f"[{scan.wijk_naam}] status={status} progress={progress}%{phase_label} processed={scan.parcels_processed}/{scan.parcels_total}")
            if status not in {"pending", "running"}:
                if status == "failed" and scan.error_message:
                    print(f"[{scan.wijk_naam}] error={scan.error_message}")
                return status
        await asyncio.sleep(poll_seconds)


async def main() -> None:
    args = _parse_args()
    engine = create_async_engine(settings.DATABASE_URL, pool_size=2, max_overflow=2)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    arq_pool = await create_pool(get_redis_settings())
    try:
        org_id = await _resolve_organization_id(session_factory, args.organization_id)
        wijken_geojson = await _resolve_wijken_geojson(args.gemeente_code)
        wijk_names = []
        for feature in wijken_geojson.get("features", []):
            props = feature.get("properties", {}) or {}
            name = props.get("statnaam")
            if isinstance(name, str) and name.strip():
                wijk_names.append(name.strip())
        queue = await _build_queue(
            session_factory,
            org_id,
            args.gemeente_code,
            wijk_names,
            args.force_failed,
            args.force_all,
        )

        print(f"Organization: {org_id}")
        print(f"Gemeente: {args.gemeente_naam} ({args.gemeente_code})")
        print(f"Wijken total: {len(wijk_names)}")

        outcomes: list[WijkOutcome] = []
        stopped_early = False

        for item in queue:
            if args.dry_run:
                print(f"[{item.wijk_naam}] {item.action} ({item.scan_id})")
                outcomes.append(WijkOutcome(wijk_naam=item.wijk_naam, status=item.action))
                continue
            if item.action not in {"enqueue", "rescan"}:
                print(f"[{item.wijk_naam}] {item.action} ({item.scan_id})")
                outcomes.append(WijkOutcome(wijk_naam=item.wijk_naam, status=item.action))
                continue

            print(f"[{item.wijk_naam}] {item.action}")
            wijk_bbox_wgs84 = _resolve_wijk_bbox_from_geojson(
                wijken_geojson,
                item.wijk_naam,
            )
            scan_id = await _enqueue_scan(
                session_factory,
                arq_pool,
                org_id,
                args.gemeente_code,
                args.gemeente_naam,
                item.wijk_naam,
                wijk_bbox_wgs84,
                existing_scan_id=item.scan_id if item.action == "rescan" else None,
            )
            final_status = await _wait_for_scan(session_factory, scan_id, args.poll_seconds)
            print(f"[{item.wijk_naam}] finished with status={final_status}")

            async with session_factory() as session:
                scan = await session.get(AreaScan, uuid.UUID(scan_id))
                outcome = WijkOutcome(
                    wijk_naam=item.wijk_naam,
                    status=final_status,
                    parcel_count=scan.parcels_total if scan else 0,
                    coverage_ratio=scan.coverage_ratio if scan else None,
                    address_resolution_ratio=scan.address_resolution_ratio if scan else None,
                )
            outcomes.append(outcome)

            if final_status not in {"completed", "completed_with_warnings"}:
                if args.force_all or args.force_failed:
                    print(f"  [{item.wijk_naam}] failed — continuing batch (force mode)")
                else:
                    print("Stopping batch after failure.")
                    stopped_early = True
                    break

        if stopped_early:
            processed = {o.wijk_naam for o in outcomes}
            for item in queue:
                if item.wijk_naam not in processed:
                    outcomes.append(WijkOutcome(wijk_naam=item.wijk_naam, status="not_started"))

        _print_summary(outcomes)
    finally:
        await arq_pool.close()
        await engine.dispose()


def _print_summary(outcomes: list[WijkOutcome]) -> None:
    print("\n" + "=" * 80)
    print("SCAN SUMMARY")
    print("=" * 80)
    print(f"{'Wijk':<30} {'Status':<25} {'Parcels':>8} {'Coverage':>10} {'Addresses':>10}")
    print("-" * 80)
    for o in outcomes:
        cov = f"{o.coverage_ratio * 100:.0f}%" if o.coverage_ratio is not None else "-"
        addr = (
            f"{o.address_resolution_ratio * 100:.0f}%"
            if o.address_resolution_ratio is not None
            else "-"
        )
        status_icon = {
            "completed": "OK",
            "completed_with_warnings": "WARN",
            "failed": "FAIL",
        }.get(o.status, o.status[:25])
        print(f"{o.wijk_naam:<30} {status_icon:<25} {o.parcel_count:>8} {cov:>10} {addr:>10}")
    print("=" * 80)

    completed = sum(1 for o in outcomes if o.status in {"completed", "completed_with_warnings"})
    failed = sum(1 for o in outcomes if o.status == "failed")
    skipped = sum(1 for o in outcomes if o.status.startswith("skip"))
    not_started = sum(1 for o in outcomes if o.status == "not_started")
    print(f"Completed: {completed}  Failed: {failed}  Skipped: {skipped}  Not started: {not_started}  Total: {len(outcomes)}")


if __name__ == "__main__":
    asyncio.run(main())
