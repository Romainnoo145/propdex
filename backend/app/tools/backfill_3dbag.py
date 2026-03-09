"""Backfill actual building dimensions from 3D BAG into existing scan results.

Per wijk: BAG WFS spatial join → collect unique pand IDs → batch-fetch 3D BAG
(10 concurrent) → merge actual_bouwhoogte + actual_bouwlagen into building_metrics.

Usage:
    python -m app.tools.backfill_3dbag --gemeente Venlo
    python -m app.tools.backfill_3dbag --gemeente Venlo --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import uuid

import httpx
from geoalchemy2.shape import to_shape
from sqlalchemy import select, text

from app.core.database import async_session_factory
from app.government_apis.bag_wfs import bag_wfs_client
from app.jobs.area_scan import (
    MIN_BUILDING_OVERLAP_M2,
    _build_bag_spatial_index,
)
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Concurrent 3D BAG fetches (per wijk batch)
_CONCURRENCY = 10


_3DBAG_ITEM_URL = "https://api.3dbag.nl/collections/pand/items/{pand_id}"


def _parse_3dbag_response(data: dict) -> dict | None:
    """Extract actual dimensions from a single-pand 3D BAG CityJSON response."""
    feature = data.get("feature", data)
    city_objects = feature.get("CityObjects", {})
    for obj_id, obj in city_objects.items():
        if "-" in obj_id.split(".")[-1]:
            continue
        attrs = obj.get("attributes", {})
        dak = attrs.get("b3_h_dak_50p")
        mv = attrs.get("b3_h_maaiveld")
        hoogte = None
        if dak is not None and mv is not None:
            try:
                h = float(dak) - float(mv)
                if 1.5 <= h <= 200.0:
                    hoogte = round(h, 1)
            except (TypeError, ValueError):
                pass
        bouwlagen = None
        raw_bl = attrs.get("b3_bouwlagen")
        if raw_bl is not None:
            try:
                bl = int(round(float(raw_bl)))
                if 1 <= bl <= 100:
                    bouwlagen = bl
            except (TypeError, ValueError):
                pass
        return {"actual_bouwhoogte": hoogte, "actual_bouwlagen": bouwlagen}
    return None


async def _fetch_pand_batch(
    pand_ids: list[str],
    http_client: httpx.AsyncClient,
) -> dict[str, dict | None]:
    """Fetch 3D BAG data for pand IDs — 10 concurrent, no rate limiter."""
    sem = asyncio.Semaphore(_CONCURRENCY)
    results: dict[str, dict | None] = {}
    done = 0

    async def _fetch_one(pid: str) -> None:
        nonlocal done
        async with sem:
            url = _3DBAG_ITEM_URL.format(pand_id=pid)
            try:
                resp = await http_client.get(url, timeout=15.0)
                if resp.status_code == 200:
                    results[pid] = _parse_3dbag_response(resp.json())
                else:
                    results[pid] = None
            except Exception:
                results[pid] = None
            done += 1
            if done % 100 == 0:
                logger.info(f"  3D BAG progress: {done}/{len(pand_ids)}")

    await asyncio.gather(*[_fetch_one(pid) for pid in pand_ids])
    return results


async def _backfill_scan(
    scan: AreaScan,
    http_client: httpx.AsyncClient,
    *,
    dry_run: bool,
) -> tuple[int, int, int]:
    """Backfill one scan. Returns (processed, updated, skipped)."""
    scan_id = scan.id
    org_id = scan.organization_id
    wijk = scan.wijk_naam or scan.gemeente_naam
    bbox = (scan.bbox_minx, scan.bbox_miny, scan.bbox_maxx, scan.bbox_maxy)

    # Step 1: BAG WFS spatial index
    logger.info(f"[{wijk}] Fetching BAG WFS panden...")
    try:
        bag_features = await bag_wfs_client.get_panden_in_bbox(*bbox, http_client)
    except Exception as e:
        logger.error(f"[{wijk}] BAG WFS failed: {e}")
        return 0, 0, 0

    bag_index = _build_bag_spatial_index(bag_features)
    if bag_index is None:
        logger.warning(f"[{wijk}] No BAG buildings — skipping")
        return 0, 0, 0

    logger.info(f"[{wijk}] BAG index: {len(bag_index.geometries)} panden")

    # Step 2: Load all scan_results, spatial join → collect unique pand IDs per parcel
    parcel_pand_map: dict[uuid.UUID, list[str]] = {}  # sr_id → [full_pand_id, ...]
    parcel_data: dict[uuid.UUID, dict] = {}  # sr_id → flags
    all_pand_ids: set[str] = set()
    skipped = 0

    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))
        last_id: uuid.UUID | None = None

        while True:
            stmt = (
                select(ScanResult.id, ScanResult.flags, ParcelCache.geometry)
                .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
                .where(
                    ScanResult.scan_id == scan_id,
                    ScanResult.organization_id == org_id,
                    ParcelCache.organization_id == org_id,
                )
                .order_by(ScanResult.id)
                .limit(500)
            )
            if last_id is not None:
                stmt = stmt.where(ScanResult.id > last_id)

            rows = (await session.execute(stmt)).all()
            if not rows:
                break

            for sr_id, raw_flags, wkb_geom in rows:
                last_id = sr_id
                flags = raw_flags if isinstance(raw_flags, dict) else {}
                bm = flags.get("building_metrics")
                if isinstance(bm, dict) and (
                    bm.get("actual_bouwhoogte") is not None
                    or bm.get("actual_bouwlagen") is not None
                ):
                    skipped += 1
                    continue

                try:
                    parcel_geom = to_shape(wkb_geom)
                except Exception:
                    continue

                candidates = bag_index.tree.query(parcel_geom)
                if len(candidates) == 0:
                    continue

                iterable = candidates.tolist() if hasattr(candidates, "tolist") else candidates
                pand_ids: list[str] = []
                for raw_idx in iterable:
                    idx = int(raw_idx)
                    bag_geom = bag_index.geometries[idx]
                    if not bag_geom.intersects(parcel_geom):
                        continue
                    if bag_geom.intersection(parcel_geom).area < MIN_BUILDING_OVERLAP_M2:
                        continue
                    pid = bag_index.identificaties[idx]
                    if pid is not None:
                        full_id = f"NL.IMBAG.Pand.{pid}" if not pid.startswith("NL.") else pid
                        pand_ids.append(full_id)

                if pand_ids:
                    parcel_pand_map[sr_id] = pand_ids
                    parcel_data[sr_id] = flags
                    all_pand_ids.update(pand_ids)

    logger.info(
        f"[{wijk}] Spatial join: {len(parcel_pand_map)} parcels need 3D BAG, "
        f"{len(all_pand_ids)} unique panden, {skipped} already done"
    )

    if not all_pand_ids:
        return len(parcel_pand_map) + skipped, 0, skipped

    # Step 3: Batch-fetch all unique pand IDs (10 concurrent)
    logger.info(f"[{wijk}] Fetching {len(all_pand_ids)} panden from 3D BAG...")
    pand_data = await _fetch_pand_batch(list(all_pand_ids), http_client)
    found = sum(1 for v in pand_data.values() if v is not None)
    logger.info(f"[{wijk}] 3D BAG: {found}/{len(all_pand_ids)} panden found")

    # Step 4: Merge into scan_results
    updated = 0
    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))
        raw_sql = text("UPDATE scan_results SET flags = :new_flags WHERE id = :sr_id")
        batch_updates: list[dict] = []

        for sr_id, pand_ids in parcel_pand_map.items():
            flags = parcel_data[sr_id]
            bm = flags.get("building_metrics")
            if not isinstance(bm, dict):
                bm = {}

            actual_hoogte: float | None = None
            actual_lagen: int | None = None

            for full_id in pand_ids:
                entry = pand_data.get(full_id)
                if entry:
                    h = entry.get("actual_bouwhoogte")
                    bl = entry.get("actual_bouwlagen")
                    if h is not None:
                        actual_hoogte = h if actual_hoogte is None else max(actual_hoogte, h)
                    if bl is not None:
                        actual_lagen = bl if actual_lagen is None else max(actual_lagen, bl)

            if actual_hoogte is None and actual_lagen is None:
                continue

            new_bm = dict(bm)
            if actual_hoogte is not None:
                new_bm["actual_bouwhoogte"] = actual_hoogte
            if actual_lagen is not None:
                new_bm["actual_bouwlagen"] = actual_lagen

            new_flags = dict(flags)
            new_flags["building_metrics"] = new_bm
            batch_updates.append({"sr_id": str(sr_id), "new_flags": json.dumps(new_flags)})
            updated += 1

            if len(batch_updates) >= 500:
                if not dry_run:
                    for upd in batch_updates:
                        await session.execute(raw_sql, upd)
                    await session.commit()
                batch_updates = []

        if batch_updates and not dry_run:
            for upd in batch_updates:
                await session.execute(raw_sql, upd)
            await session.commit()

    processed = len(parcel_pand_map) + skipped
    logger.info(f"[{wijk}] Done: processed={processed}, updated={updated}, skipped={skipped}")
    return processed, updated, skipped


async def _run(
    *,
    gemeente: str | None,
    scan_id: uuid.UUID | None,
    dry_run: bool,
) -> int:
    async with async_session_factory() as session:
        result = await session.execute(select(Organization).order_by(Organization.id).limit(1))
        org = result.scalar_one_or_none()
        if org is None:
            logger.error("No organizations found")
            return 1
        org_id = org.id
        logger.info(f"Organization: {org_id}")

    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))
        stmt = (
            select(AreaScan)
            .where(
                AreaScan.organization_id == org_id,
                AreaScan.status.in_(["completed", "completed_with_warnings"]),
            )
            .order_by(AreaScan.wijk_naam)
        )
        if gemeente:
            stmt = stmt.where(AreaScan.gemeente_naam == gemeente)
        if scan_id:
            stmt = stmt.where(AreaScan.id == scan_id)
        scans = (await session.execute(stmt)).scalars().all()

    if not scans:
        logger.error(f"No completed scans found (gemeente={gemeente})")
        return 1

    logger.info(f"Found {len(scans)} scans to backfill")
    total_p = total_u = total_s = 0

    async with httpx.AsyncClient() as http_client:
        for i, scan in enumerate(scans, 1):
            wijk = scan.wijk_naam or scan.gemeente_naam
            logger.info(f"=== [{i}/{len(scans)}] {wijk} {'(dry-run)' if dry_run else ''} ===")
            p, u, s = await _backfill_scan(scan, http_client, dry_run=dry_run)
            total_p += p
            total_u += u
            total_s += s

    prefix = "[DRY-RUN] " if dry_run else ""
    logger.info(f"{prefix}Complete: scans={len(scans)}, processed={total_p}, updated={total_u}, skipped={total_s}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill 3D BAG building dimensions")
    parser.add_argument("--gemeente", type=str, help="Municipality name (e.g. Venlo)")
    parser.add_argument("--scan-id", type=lambda s: uuid.UUID(s), help="Single scan UUID")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be updated")
    args = parser.parse_args()
    if not args.gemeente and not args.scan_id:
        parser.error("Specify --gemeente or --scan-id")
    exit_code = asyncio.run(_run(gemeente=args.gemeente, scan_id=args.scan_id, dry_run=args.dry_run))
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
